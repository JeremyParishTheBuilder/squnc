import {
  type ColumnSpec,
  Column,
  assertTypeIndexable,
  type ColumnId,
  type ColumnPolicy,
} from "./Column.js";
import { type ColumnValue } from "../types/ColumnValue.js";
import { PrimaryKey } from "./PrimaryKey.js";
import { ForeignKey, type ForeignKeyId } from "./ForeignKey.js";
import { Check, type CheckId } from "./Check.js";
import { Unique, type UniqueId } from "./Unique.js";
import {
  Index,
  type IndexId,
  type IndexSpec,
  IndexUniquenessError,
  requiresIndexRebuild,
} from "./Index.js";
import { Immutable } from "../infrastructure/Immutable.js";
import { type RowView } from "./RowView.js";
import { normalizeIdentifier } from "../utils/normalizeIdentifier.js";
import { type CheckSpec, type TableConstraint } from "./Constraint.js";
import { type ReferentialAction } from "./ReferentialAction.js";
import { type ColumnInput } from "../types/ColumnInput.js";
import { IdAllocator } from "../types/IdAllocator.js";
import { NamedObjectStore } from "../infrastructure/NamedObjectStore.js";
import { type ResolvedUpdate } from "../types/ResolvedUpdate.js";
import { type ResolvedDelete } from "../types/ResolvedDelete.js";
import { bindPredicate, resolvePredicate } from "../semantic/predicate.js";
import {
  ConstraintViolationError,
  type ConstraintViolationParticipant,
} from "./ConstraintViolationError.js";
import { CONSTRAINT_KIND } from "./ConstraintKind.js";
import { arraysEqual } from "../utils/arrayHelpers.js";
import type { OrderedInputRow } from "../types/OrderedInputRow.js";
import type { SqlType } from "../types/SqlType.js";
import { RelationScope } from "../semantic/relation/RelationScope.js";
import { relationBindingFromTable } from "../semantic/relation/RelationBinding.js";
import type {
  ColumnRename,
  ConstraintRename,
  IndexRename,
} from "../statements/index.js";

export type TableId = number & { readonly __brand: "TableId" };

export type TablePolicy = {
  allowMultipleAutoIncrementColumns?: boolean;
};

export class Table extends Immutable {
  public id: TableId;
  public name: string;

  public columns: NamedObjectStore<Column, ColumnId>;

  public primaryKey: PrimaryKey | undefined;
  public indexes: NamedObjectStore<Index, IndexId>;
  public uniques: NamedObjectStore<Unique, UniqueId>;
  public foreignKeys: NamedObjectStore<ForeignKey, ForeignKeyId>;
  public checks: NamedObjectStore<Check, CheckId>;

  public rowAlive: boolean[];
  public numRows: number;

  public readonly columnIds;
  public readonly indexIds;
  public readonly uniqueIds;
  public readonly foreignKeyIds;
  public readonly checkIds;

  public readonly allowMultipleAutoIncrementColumns: boolean;

  public validate(): void {
    for (const column of this.columns.values()) {
      if (column.data.length !== this.numRows) {
        throw new Error(
          `Column ${column.name} contains ${column.data.length} values, expected ${this.numRows}.`,
        );
      }
    }
  }

  constructor(spec: { id: TableId; name: string }, policy?: TablePolicy) {
    super();

    this.id = spec.id;
    this.name = spec.name;

    this.columns = new NamedObjectStore();

    this.primaryKey = undefined;
    this.indexes = new NamedObjectStore();
    this.uniques = new NamedObjectStore();
    this.foreignKeys = new NamedObjectStore();
    this.checks = new NamedObjectStore();

    this.rowAlive = [];
    this.numRows = 0;

    this.columnIds = new IdAllocator<ColumnId>();
    this.indexIds = new IdAllocator<IndexId>();
    this.uniqueIds = new IdAllocator<UniqueId>();
    this.foreignKeyIds = new IdAllocator<ForeignKeyId>();
    this.checkIds = new IdAllocator<CheckId>();

    // Policy
    this.allowMultipleAutoIncrementColumns =
      policy?.allowMultipleAutoIncrementColumns ?? true;

    this.validate();
    this.seal();
  }

  public static create(
    spec: { id: TableId; name: string },
    policy?: TablePolicy,
  ): Table {
    return new Table(spec, policy);
  }

  public rename(newName: string): Table {
    return this.with({
      name: newName,
    } as Partial<this>);
  }

  public getColumnsInOrder(): Column[] {
    return Array.from(this.columns.values()).sort(
      (a, b) => a.position - b.position,
    );
  }

  public hasAutoIncrementColumn(): boolean {
    return this.columns.some((c) => c.isAutoIncrement());
  }

  public createColumn(spec: ColumnSpec, policy?: ColumnPolicy): Table {
    this.columns.assertNameUnused(spec.name);

    if (
      spec.nullable === false &&
      spec.defaultValue === undefined &&
      this.numRows > 0
    ) {
      throw new Error(
        `New non-nullable column ${spec.name} unable to backfill without a default value`,
      );
    }

    const [id, columnIds] = this.columnIds.allocate();

    const position = this.columns.size();

    const emptyColumn = Column.create({ ...spec, id, position }, policy);

    if (
      !this.allowMultipleAutoIncrementColumns &&
      emptyColumn.isAutoIncrement() &&
      this.hasAutoIncrementColumn()
    ) {
      throw new Error(`Table is not allowed multiple autoIncrement columns`);
    }

    const backfillValue = spec.defaultValue ?? null;

    const initializedColumn = emptyColumn.backfill(this.numRows, backfillValue);

    const updatedColumns = this.columns.add(initializedColumn);

    return this.with({
      columns: updatedColumns,
      columnIds,
    } as Partial<this>);
  }

  public removeColumn(name: string): Table {
    return this.removeColumnById(this.columns.requireIdByName(name));
  }

  public removeColumnById(id: ColumnId): Table {
    const column = this.columns.require(id);

    this.assertColumnUnreferenced(id);

    const updatedColumns = this.columns
      .mapValues((c) => c.tryDecrementPosition(column.position))
      .remove(id);

    const columnIdToPositionMap = new Map<ColumnId, number>();
    for (const column of updatedColumns.values()) {
      columnIdToPositionMap.set(column.id, column.position);
    }

    const updatedIndexes = this.indexes.mapValues((i) =>
      i.tryUpdateColumnIndexes(columnIdToPositionMap),
    );

    const tableWithUpdatedPositions = this.with({
      columns: updatedColumns,
      indexes: updatedIndexes,
    } as Partial<this>);

    const updatedChecks = this.checks.mapValues((chk) =>
      chk.tryBindPredicate(tableWithUpdatedPositions),
    );

    return tableWithUpdatedPositions.with({
      checks: updatedChecks,
    } as Partial<this>);
  }

  public renameColumns(columnRenames: ColumnRename[]): Table {
    const resolvedRenames = columnRenames.map((rename) => ({
      columnId: this.columns.requireByName(rename.from).id,
      newName: rename.to,
    }));

    return this.renameColumnsById(resolvedRenames);
  }

  public renameConstraints(constraintRenames: ConstraintRename[]): Table {
    if (constraintRenames.length === 0) {
      return this;
    }

    const constraintsToRename = new Map<string, TableConstraint>();
    const destinationNames = new Set<string>();

    // Resolve columns and reject duplicate sources.
    const resolvedRenames = constraintRenames.map((rename) => {
      const constraint = this.requireConstraintByName(rename.from);

      const constraintName = constraint.name;
      const normalizedName = normalizeIdentifier(constraintName);

      if (constraintsToRename.has(normalizedName)) {
        throw new Error(`Duplicate constraint rename for "${constraintName}"`);
      }

      constraintsToRename.set(normalizedName, constraint);

      return {
        constraint,
        newName: rename.to,
        normalizedNewName: normalizeIdentifier(rename.to),
      };
    });

    // Reject duplicate destination names.
    for (const rename of resolvedRenames) {
      if (destinationNames.has(rename.normalizedNewName)) {
        throw new Error(
          `Duplicate destination constraint name "${rename.newName}"`,
        );
      }

      destinationNames.add(rename.normalizedNewName);
    }

    // Reject collisions with constraints that are not being renamed.
    for (const rename of resolvedRenames) {
      const existingConstraint = this.getConstraintByName(rename.newName);

      if (
        existingConstraint !== undefined &&
        !constraintsToRename.has(normalizeIdentifier(existingConstraint.name))
      ) {
        throw new Error(`Constraint name "${rename.newName}" is already taken`);
      }
    }

    // Ignore no-op renames.
    const changedRenames = resolvedRenames.filter(
      (rename) => rename.constraint.name !== rename.newName,
    );

    if (changedRenames.length === 0) {
      return this;
    }

    // Rename each constraint
    const renamedConstraints = changedRenames.map((rename) =>
      rename.constraint.rename(rename.newName),
    );

    // Separate array of constraints by kind
    const renamedUniques = renamedConstraints.filter(
      (constraint): constraint is Unique => constraint instanceof Unique,
    );

    const renamedForeignKeys = renamedConstraints.filter(
      (constraint): constraint is ForeignKey =>
        constraint instanceof ForeignKey,
    );

    const renamedChecks = renamedConstraints.filter(
      (constraint): constraint is Check => constraint instanceof Check,
    );

    const renamedPrimaryKey = renamedConstraints.find(
      (constraint): constraint is PrimaryKey =>
        constraint instanceof PrimaryKey,
    );

    // Update constraint storage
    const updatedUniques = this.uniques.updateMany(renamedUniques);

    const updatedForeignKeys = this.foreignKeys.updateMany(renamedForeignKeys);

    const updatedChecks = this.checks.updateMany(renamedChecks);

    // Return table with updated constraint storage
    return this.with({
      primaryKey: renamedPrimaryKey ?? this.primaryKey,
      uniques: updatedUniques,
      foreignKeys: updatedForeignKeys,
      checks: updatedChecks,
    } as Partial<this>);
  }

  public renameColumnsById(
    columnRenames: { columnId: ColumnId; newName: string }[],
  ): Table {
    if (columnRenames.length === 0) {
      return this;
    }

    const columnsToRename = new Map<ColumnId, Column>();
    const destinationNames = new Set<string>();

    // Resolve columns and reject duplicate sources.
    const resolvedRenames = columnRenames.map((rename) => {
      const column = this.columns.require(rename.columnId);

      if (columnsToRename.has(column.id)) {
        throw new Error(`Duplicate column rename for "${column.name}"`);
      }

      columnsToRename.set(column.id, column);

      return {
        column,
        newName: rename.newName,
        normalizedNewName: normalizeIdentifier(rename.newName),
      };
    });

    // Reject duplicate destination names.
    for (const rename of resolvedRenames) {
      if (destinationNames.has(rename.normalizedNewName)) {
        throw new Error(
          `Duplicate destination column name "${rename.newName}"`,
        );
      }

      destinationNames.add(rename.normalizedNewName);
    }

    // Reject collisions with columns that are not being renamed.
    for (const rename of resolvedRenames) {
      const existingColumn = this.columns.getByName(rename.newName);

      if (
        existingColumn !== undefined &&
        !columnsToRename.has(existingColumn.id)
      ) {
        throw new Error(`Column name "${rename.newName}" is already taken`);
      }
    }

    // Ignore no-op renames.
    const changedRenames = resolvedRenames.filter(
      (rename) => rename.column.name !== rename.newName,
    );

    if (changedRenames.length === 0) {
      return this;
    }

    const renamedColumns = changedRenames.map((rename) =>
      rename.column.rename(rename.newName),
    );

    // This must update the collection atomically.
    const updatedColumns = this.columns.updateMany(renamedColumns);

    return this.with({
      columns: updatedColumns,
    } as Partial<this>);
  }

  public renameIndexes(indexRenames: IndexRename[]): Table {
    const resolvedRenames = indexRenames.map((rename) => ({
      indexId: this.indexes.requireByName(rename.from).id,
      newName: rename.to,
    }));

    return this.renameIndexesById(resolvedRenames);
  }

  public renameIndexesById(
    indexRenames: { indexId: IndexId; newName: string }[],
  ): Table {
    if (indexRenames.length === 0) {
      return this;
    }

    const indexesToRename = new Map<IndexId, Index>();
    const destinationNames = new Set<string>();

    // Resolve indexes and reject duplicate sources.
    const resolvedRenames = indexRenames.map((rename) => {
      const index = this.indexes.require(rename.indexId);

      if (indexesToRename.has(index.id)) {
        throw new Error(`Duplicate index rename for "${index.name}"`);
      }

      indexesToRename.set(index.id, index);

      return {
        index,
        newName: rename.newName,
        normalizedNewName: normalizeIdentifier(rename.newName),
      };
    });

    // Reject duplicate destination names.
    for (const rename of resolvedRenames) {
      if (destinationNames.has(rename.normalizedNewName)) {
        throw new Error(`Duplicate destination index name "${rename.newName}"`);
      }

      destinationNames.add(rename.normalizedNewName);
    }

    // Reject collisions with indexes that are not being renamed.
    for (const rename of resolvedRenames) {
      const existingIndex = this.indexes.getByName(rename.newName);

      if (
        existingIndex !== undefined &&
        !indexesToRename.has(existingIndex.id)
      ) {
        throw new Error(`Index name "${rename.newName}" is already taken`);
      }
    }

    // Ignore no-op renames.
    const changedRenames = resolvedRenames.filter(
      (rename) => rename.index.name !== rename.newName,
    );

    if (changedRenames.length === 0) {
      return this;
    }

    const renamedIndexes = changedRenames.map((rename) =>
      rename.index.rename(rename.newName),
    );

    // This must update the collection atomically.
    const updatedIndexes = this.indexes.updateMany(renamedIndexes);

    return this.with({
      indexes: updatedIndexes,
    } as Partial<this>);
  }

  public updateColumn(column: Column): Table {
    return this.with({
      columns: this.columns.update(column),
    } as Partial<this>);
  }

  public updateColumnNullable(columnName: string, nullable: boolean): this {
    return this.updateColumnNullableById(
      this.columns.requireIdByName(columnName),
      nullable,
    );
  }

  public updateColumnNullableById(columnId: ColumnId, nullable: boolean): this {
    const column = this.columns.require(columnId);

    if (
      nullable === true &&
      this.primaryKey &&
      this.indexes.require(this.primaryKey.index).columns.includes(columnId)
    ) {
      throw new Error(`Primary Key column cannot drop NOT NULL`);
    }

    if (nullable === false && column.nullable === true) {
      for (const row of this.iterateAliveRows()) {
        if (column.data[row.index] === null) {
          throw new Error(
            `Existing NULL values prohibit setting column to NOT NULL`,
          );
        }
      }
    }

    return this.with({
      columns: this.columns.update(column.updateNullable(nullable)),
    } as Partial<this>);
  }

  public alterColumn(name: string, newType: SqlType): Table {
    return this.alterColumnById(this.columns.requireIdByName(name), newType);
  }

  public alterColumnById(id: ColumnId, newType: SqlType): Table {
    const column = this.columns.require(id);

    if (column.type === newType) return this;

    if (this.indexes.some((i) => i.referencesColumn(id))) {
      assertTypeIndexable(newType);
    }

    const updatedColumns = this.columns.update(column.alter(newType));

    const tableWithUpdatedColumns = this.with({
      columns: updatedColumns,
    } as Partial<this>);

    const updatedChecks = this.checks.mapValues((chk) =>
      chk.tryBindPredicate(tableWithUpdatedColumns),
    );

    for (const check of updatedChecks.values()) {
      tableWithUpdatedColumns.assertCheckAgainstExistingRows(check);
    }

    let updatedIndexes = this.indexes;
    if (requiresIndexRebuild(column.type, newType)) {
      updatedIndexes = this.indexes.mapValues((index) =>
        index.referencesColumn(id)
          ? index.build(tableWithUpdatedColumns.iterateAliveRows())
          : index,
      );
    }

    return tableWithUpdatedColumns.with({
      checks: updatedChecks,
      indexes: updatedIndexes,
    } as Partial<this>);
  }

  private assertUniqueConstraintNotDuplicated(columns: ColumnId[]): void {
    for (const index of this.indexes.values()) {
      if (index.unique && sameColumnSet(index.columns, columns)) {
        throw new Error(
          `Unique constraint on columns [${columns.join(", ")}] already exists`,
        );
      }
    }
  }

  public *iterateAliveRows(): IterableIterator<RowView> {
    for (let i = 0; i < this.numRows; i++) {
      const row = this.getRowView(i);

      if (!row) continue;

      yield row;
    }
  }

  public createForeignKey(spec: {
    name: string;
    columns: string[];
    reverseIndex?: string;
    parentTable: TableId;
    parentColumns: ColumnId[];
    parentIndex: IndexId;
    onDelete?: ReferentialAction;
    onUpdate?: ReferentialAction;
  }): Table {
    this.assertConstraintNameUnused(spec.name);

    const reverseIndexName =
      spec.reverseIndex ?? ForeignKey.defaultIndexName(spec.name);

    const tableWithReverseIndex = this.createIndex({
      name: reverseIndexName,
      columns: spec.columns,
      unique: false,
      internal: true,
      nullsDistinct: true,
    });

    const ri_id =
      tableWithReverseIndex.indexes.requireIdByName(reverseIndexName);

    const [fk_id, foreignKeyIds] = this.foreignKeyIds.allocate();

    const foreignKey = ForeignKey.create({
      ...spec,
      id: fk_id,
      columns: spec.columns.map((c) => this.columns.requireIdByName(c)),
      reverseIndex: ri_id,
    });

    const foreignKeys = this.foreignKeys.add(foreignKey);

    return tableWithReverseIndex.with({
      foreignKeys,
      foreignKeyIds,
    } as Partial<this>);
  }

  public removeForeignKey(name: string): Table {
    return this.removeForeignKeyById(this.foreignKeys.requireIdByName(name));
  }

  public removeForeignKeyById(id: ForeignKeyId): Table {
    const fk = this.foreignKeys.require(id);

    const tableWithoutForeignKey = this.with({
      foreignKeys: this.foreignKeys.remove(id),
    } as Partial<this>);

    const indexes = tableWithoutForeignKey.removeIndexIfUnused(fk.reverseIndex);

    return tableWithoutForeignKey.with({
      indexes,
    } as Partial<this>);
  }

  private assertCheckAgainstExistingRows(check: Check): void {
    for (const row of this.iterateAliveRows()) {
      if (check.predicate.evaluate(row)) {
        continue;
      }

      throw new ConstraintViolationError({
        constraintName: check.name,
        constraintKind: CONSTRAINT_KIND.check,
        participants: [
          {
            table: this.id,
            rowId: row.index,
            columns: check.columns,
            columnValues: Index.projectRow(
              row.values,
              check.columns.map((c) => this.columns.require(c).position),
            ),
          },
        ],
      });
    }
  }

  public createCheck(spec: Omit<CheckSpec, "kind">): Table {
    this.assertConstraintNameUnused(spec.name);

    const scope = new RelationScope([relationBindingFromTable(this)]);
    const resolvedPredicate = resolvePredicate(spec.predicate, scope);
    const boundPredicate = bindPredicate(resolvedPredicate, scope);

    const [id, checkIds] = this.checkIds.allocate();

    const check = Check.create({
      ...spec,
      id,
      resolvedPredicate,
      predicate: boundPredicate,
    });

    this.assertCheckAgainstExistingRows(check);

    const updatedChecks = this.checks.add(check);

    return this.with({
      checks: updatedChecks,
      checkIds,
    } as Partial<this>);
  }

  private assertRowAgainstChecks(row: ColumnValue[]) {
    const rowView = {
      index: 0,
      values: row,
    };

    for (const check of this.checks.values()) {
      if (!check.predicate.evaluate(rowView)) {
        throw new Error(`Check constraint '${check.name}' violated`);
      }
    }
  }

  private assertColumnUnreferenced(id: ColumnId) {
    if (
      this.foreignKeys.some((c) => c.referencesColumn(id)) ||
      this.indexes.some((i) => i.referencesColumn(id)) ||
      this.checks.some((c) => c.referencesColumn(id))
    ) {
      throw new Error(
        `Column Id: ${id} is referenced by some Constraint or Index`,
      );
    }
  }

  public getPrimaryKey(): PrimaryKey | undefined {
    return this.primaryKey;
  }

  public requirePrimaryKey(): PrimaryKey {
    const primaryKey = this.primaryKey;
    if (!primaryKey) {
      throw new Error(`No Primary Key exists.`);
    }
    return primaryKey;
  }

  public getConstraintByName(
    name: string,
  ): PrimaryKey | ForeignKey | Check | Unique | undefined {
    const n = normalizeIdentifier(name);

    if (this.primaryKey && normalizeIdentifier(this.primaryKey.name) === n) {
      return this.primaryKey;
    }

    return (
      this.foreignKeys.getByName(name) ??
      this.checks.getByName(name) ??
      this.uniques.getByName(name)
    );
  }

  public requireConstraintByName(
    name: string,
  ): PrimaryKey | ForeignKey | Check | Unique {
    const constraint = this.getConstraintByName(name);
    if (!constraint) {
      throw new Error(`No constraint named: ${name}`);
    }
    return constraint;
  }

  private assertConstraintNameUnused(name: string): void {
    if (this.getConstraintByName(name)) {
      throw new Error(`Constraint name: ${name} already used`);
    }
  }

  public assertTableUnreferenced(id: TableId): void {
    for (const fk of this.foreignKeys.values()) {
      if (fk.parentTable === id) {
        throw new Error(`Foreign Key ${fk.name} references table: ${id}`);
      }
    }
  }

  private removeIndexIfUnused(
    indexId: IndexId,
  ): NamedObjectStore<Index, IndexId> {
    const index = this.indexes.require(indexId);

    return !this.isIndexReferenced(indexId) && index.internal === true
      ? this.indexes.remove(indexId)
      : this.indexes;
  }

  private isIndexReferenced(indexId: IndexId): boolean {
    if (this.primaryKey?.index === indexId) {
      return true;
    }

    for (const unique of this.uniques.values()) {
      if (unique.index === indexId) {
        return true;
      }
    }

    for (const foreignKey of this.foreignKeys.values()) {
      if (foreignKey.reverseIndex === indexId) {
        return true;
      }
    }

    return false;
  }

  private createResolvedPrimaryKey(spec: {
    name: string;
    indexId: IndexId;
  }): Table {
    if (this.primaryKey) {
      throw new Error(`Primary Key ${this.primaryKey} already exists`);
    }

    this.assertConstraintNameUnused(spec.name);

    const index = this.indexes.require(spec.indexId);

    if (index.unique !== true) {
      throw new Error("Referenced index is not unique");
    }

    index.columns.forEach((id) => {
      const column = this.columns.require(id);
      if (column.nullable !== false) {
        throw new Error(`Column ${column.name} must be 'NOT NULL'.`);
      }
    });

    return this.with({
      primaryKey: PrimaryKey.create({
        name: spec.name,
        index: index.id,
      }),
    } as Partial<this>);
  }

  public removePrimaryKey(): Table {
    if (!this.primaryKey) {
      throw new Error("No primary key");
    }

    const tableWithoutPrimaryKey = this.with({
      primaryKey: undefined,
    } as Partial<this>);

    const indexes = tableWithoutPrimaryKey.removeIndexIfUnused(
      this.primaryKey.index,
    );

    return this.with({
      primaryKey: undefined,
      indexes,
    } as Partial<this>);
  }

  private createResolvedUnique(spec: {
    name: string;
    indexId: IndexId;
  }): Table {
    this.assertConstraintNameUnused(spec.name);

    const index = this.indexes.require(spec.indexId);

    if (index.unique !== true) {
      throw new Error("Referenced index is not unique");
    }

    const [id, uniqueIds] = this.uniqueIds.allocate();

    const unique = Unique.create({
      id,
      name: spec.name,
      index: index.id,
    });

    const updatedUniques = this.uniques.add(unique);

    return this.with({
      uniques: updatedUniques,
      uniqueIds,
    } as Partial<this>);
  }

  public removeUnique(name: string): Table {
    return this.removeUniqueById(this.uniques.requireIdByName(name));
  }

  public removeUniqueById(id: UniqueId): Table {
    const unique = this.uniques.require(id);

    const uniques = this.uniques.remove(id);

    const tableWithUniqueRemoved = this.with({
      uniques,
    } as Partial<this>);

    const indexes = tableWithUniqueRemoved.removeIndexIfUnused(unique.index);

    return tableWithUniqueRemoved.with({
      indexes,
    } as Partial<this>);
  }

  public resolveOrCreateBackingIndex(spec: {
    name: string;
    columns?: string[];
    using?: string;
    nullsDistinct?: boolean;
  }): {
    table: Table;
    index: Index;
  } {
    let index: Index | undefined;

    if (spec.using) {
      index = this.indexes.requireByName(spec.using);

      return {
        table: this,
        index,
      };
    }

    if (!spec.columns || spec.columns.length < 1) {
      throw new Error(`Column names not provided for backing index`);
    }

    const columnIds = spec.columns.map((columnName) =>
      this.columns.requireIdByName(columnName),
    );

    index = this.getUniqueIndexByColumns(columnIds);

    if (index) {
      return {
        table: this,
        index,
      };
    }

    if (spec.nullsDistinct === undefined) {
      throw new Error(`nullsDistinct rule value not provided`);
    }

    const tableWithNewIndex = this.createIndex({
      name: spec.name,
      columns: spec.columns,
      unique: true,
      nullsDistinct: spec.nullsDistinct,
      internal: true,
    });

    return {
      table: tableWithNewIndex,
      index: tableWithNewIndex.indexes.requireByName(spec.name),
    };
  }

  private createConstraintViolationError(
    error: IndexUniquenessError,
    constraintName: string,
    constraintKind: CONSTRAINT_KIND.unique | CONSTRAINT_KIND.primaryKey,
  ): ConstraintViolationError {
    const participants: ConstraintViolationParticipant[] = [];

    const columnPositions = error.columns.map(
      (c) => this.columns.require(c).position,
    );

    for (const row of this.iterateAliveRows()) {
      const rowProjection = Index.projectRow(row.values, columnPositions);

      if (!arraysEqual(rowProjection, error.projection)) {
        continue;
      }

      participants.push({
        table: this.id,
        rowId: row.index,
        columns: error.columns,
        columnValues: error.projection,
      });
    }

    return new ConstraintViolationError({
      constraintName,
      constraintKind,
      participants,
    });
  }

  private createUniqueConstraintInternal(
    spec: {
      name: string;
      columns?: string[];
      using?: string;
      nullsDistinct?: boolean;
    },
    kind: CONSTRAINT_KIND.unique | CONSTRAINT_KIND.primaryKey,
  ): Table {
    try {
      const defaultBackingIndexName: string =
        kind === CONSTRAINT_KIND.unique
          ? Unique.defaultIndexName(spec.name)
          : PrimaryKey.defaultIndexName(spec.name);

      const backing = this.resolveOrCreateBackingIndex({
        ...spec,
        name: defaultBackingIndexName,
        // PK columns are NOT NULL, so this setting has no
        // practical effect on valid PK rows.
        nullsDistinct: spec.nullsDistinct ?? true,
      });

      return kind === CONSTRAINT_KIND.unique
        ? backing.table.createResolvedUnique({
            name: spec.name,
            indexId: backing.index.id,
          })
        : backing.table.createResolvedPrimaryKey({
            name: spec.name,
            indexId: backing.index.id,
          });
    } catch (error) {
      if (error instanceof IndexUniquenessError) {
        throw this.createConstraintViolationError(error, spec.name, kind);
      }

      throw error;
    }
  }

  public createUnique(spec: {
    name: string;
    columns?: string[];
    using?: string;
    nullsDistinct?: boolean;
  }): Table {
    return this.createUniqueConstraintInternal(spec, CONSTRAINT_KIND.unique);
  }

  public createPrimaryKey(spec: {
    name: string;
    columns?: string[];
    using?: string;
    nullsDistinct?: boolean;
  }): Table {
    return this.createUniqueConstraintInternal(
      spec,
      CONSTRAINT_KIND.primaryKey,
    );
  }

  public createIndex(spec: IndexSpec & { internal?: boolean }): Table {
    this.assertIndexNameUnused(spec.name);

    const columnIds = spec.columns.map((c) => this.columns.requireIdByName(c));

    if (spec.unique) {
      this.assertConstraintNameUnused(spec.name);
      this.assertUniqueConstraintNotDuplicated(columnIds);
    }

    const columnIndexes = columnIds
      .map((c) => this.columns.require(c))
      .map((c) => c.position);

    const [id, indexIds] = this.indexIds.allocate();

    let index = Index.create({
      ...spec,
      id,
      columns: columnIds,
      columnIndexes,
    });

    index = index.build(this.iterateAliveRows());

    const updatedIndexes = this.indexes.add(index);

    return this.with({
      indexes: updatedIndexes,
      indexIds,
    } as Partial<this>);
  }

  public removeIndex(name: string): Table {
    return this.removeIndexById(this.indexes.requireIdByName(name));
  }

  public removeIndexById(id: IndexId): Table {
    this.indexes.require(id);

    if (id === this.primaryKey?.index) {
      throw new Error(`Cannot remove index when referenced by Primary Key`);
    }

    if (
      Array.from(this.foreignKeys.values()).some((f) => f.reverseIndex === id)
    ) {
      throw new Error(`Cannot remove index when referenced by Foreign Key`);
    }

    if (Array.from(this.uniques.values()).some((u) => u.index === id)) {
      throw new Error(
        `Cannot remove index when referenced by Unique constraint`,
      );
    }

    const indexes = this.indexes.remove(id);

    return this.with({
      indexes,
    } as Partial<this>);
  }

  public removeCheck(name: string): Table {
    return this.removeCheckById(this.checks.requireIdByName(name));
  }

  public removeCheckById(id: CheckId): Table {
    this.checks.require(id);

    const updatedChecks = this.checks.remove(id);

    return this.with({
      checks: updatedChecks,
    } as Partial<this>);
  }

  private assertIndexNameUnused(name: string): void {
    if (this.indexes.hasName(name)) {
      throw new Error(`Index name ${name} is already used`);
    }
  }

  public isRowAlive(rowNum: number): boolean {
    return (
      rowNum >= 0 && rowNum < this.numRows && this.rowAlive[rowNum] !== false
    );
  }

  public assertRowAlive(rowNum: number): void {
    if (!this.isRowAlive(rowNum)) {
      throw new Error(`Row ${rowNum} not alive`);
    }
  }

  public getRow(rowNum: number): ColumnValue[] | undefined {
    if (!this.isRowAlive(rowNum)) return undefined;

    const row: ColumnValue[] = [];
    for (const column of this.columns.values()) {
      const value = column.getDatumAtRow(rowNum);

      if (value === undefined) {
        return undefined;
      }

      row.push(value);
    }
    return row;
  }

  public requireRow(rowNum: number): ColumnValue[] {
    const row = this.getRow(rowNum);
    if (!row) {
      throw new Error(`Row Number ${rowNum} does not exist`);
    }
    return row;
  }

  public getRowView(rowNum: number): RowView | undefined {
    const values = this.getRow(rowNum);

    if (!values) return undefined;

    return {
      index: rowNum,
      values: values,
    };
  }

  public requireRowView(rowNum: number): RowView {
    const row = this.getRowView(rowNum);
    if (!row) {
      throw new Error(`Row Number ${rowNum} does not exist`);
    }
    return row;
  }

  private assertRowLength(row: unknown[]): void {
    if (row.length !== this.columns.size()) {
      throw new Error(`Resolved row length mismatch with table columns`);
    }
  }

  public addRows(rows: readonly OrderedInputRow[]): Table {
    let updatedColumns = this.columns;

    for (const row of rows) {
      this.assertRowLength(row);

      updatedColumns = updatedColumns.mapValues((column) =>
        column.addCell(row[column.position]),
      );
    }

    const updateNumRows = this.numRows + rows.length;

    const tableWithUpdatedColumns = this.with({
      columns: updatedColumns,
      numRows: updateNumRows,
    } as Partial<this>);

    for (let i = 0; i < rows.length; i++) {
      const resolvedRow = tableWithUpdatedColumns.requireRow(this.numRows + i);

      this.assertRowAgainstChecks(resolvedRow);
    }

    const updatedIndexes = this.indexes.mapValues((index) =>
      index.build(tableWithUpdatedColumns.iterateAliveRows()),
    );

    return tableWithUpdatedColumns.with({
      indexes: updatedIndexes,
    } as Partial<this>);
  }

  public orderInputs(inputs: Map<ColumnId, ColumnInput>): OrderedInputRow {
    const row = new Array<ColumnInput | undefined>(this.columns.size());

    for (const [columnId, input] of inputs) {
      const column = this.columns.require(columnId);
      row[column.position] = input;
    }

    return row;
  }

  public applyResolvedUpdates(updates: ResolvedUpdate[]): Table {
    let updatedColumns = this.columns;

    for (const update of updates) {
      this.assertRowLength(update.newRow);

      this.assertRowAgainstChecks(update.newRow);

      updatedColumns = updatedColumns.mapValues((column) =>
        column.updateCell(update.newRow[column.position], update.rowNum),
      );
    }

    const tableWithUpdatedColumns = this.with({
      columns: updatedColumns,
    } as Partial<this>);

    const updatedIndexes = this.indexes.mapValues((index) =>
      index.build(tableWithUpdatedColumns.iterateAliveRows()),
    );

    return tableWithUpdatedColumns.with({
      indexes: updatedIndexes,
    } as Partial<this>);
  }

  public updateRows(
    rowNums: readonly number[],
    rows: readonly OrderedInputRow[],
  ): {
    table: Table;
    updates: ResolvedUpdate[];
  } {
    if (rowNums.length !== rows.length) {
      throw new Error(
        "Number of row numbers must match number of update rows.",
      );
    }

    if (rowNums.length === 0) {
      return { table: this, updates: [] };
    }

    let updatedColumns = this.columns;

    const seen = new Set<number>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = rowNums[i];

      if (rowNum < 0 || rowNum >= this.numRows) {
        throw new Error(`Row Number: ${rowNum} does not exist.`);
      }

      if (seen.has(rowNum)) {
        throw new Error(
          `Row Number: ${rowNum} already updated in this operation.`,
        );
      }

      seen.add(rowNum);

      this.assertRowLength(row);

      updatedColumns = updatedColumns.mapValues((column) =>
        row[column.position] === undefined
          ? column
          : column.updateCell(row[column.position]!, rowNum),
      );
    }

    const tableWithUpdatedColumns = this.with({
      columns: updatedColumns,
    } as Partial<this>);

    const resolvedUpdates: ResolvedUpdate[] = [];

    for (const rowNum of rowNums) {
      const oldRow = this.requireRow(rowNum);
      const newRow = tableWithUpdatedColumns.requireRow(rowNum);

      this.assertRowAgainstChecks(newRow);

      resolvedUpdates.push({
        rowNum,
        newRow: [...newRow],
        oldRow: [...oldRow],
      });
    }

    const updatedIndexes = this.indexes.mapValues((index) =>
      index.build(tableWithUpdatedColumns.iterateAliveRows()),
    );

    return {
      table: tableWithUpdatedColumns.with({
        indexes: updatedIndexes,
      } as Partial<this>),
      updates: resolvedUpdates,
    };
  }

  public removeRows(deletes: ResolvedDelete[]): Table {
    const newRowAlive = [...this.rowAlive];
    for (const deleteRow of deletes) {
      newRowAlive[deleteRow.rowNum] = false;
    }

    const tableWithUpdatedRowAlive = this.with({
      rowAlive: newRowAlive,
    } as Partial<this>);

    const updatedIndexes = this.indexes.mapValues((index) =>
      index.build(tableWithUpdatedRowAlive.iterateAliveRows()),
    );

    return tableWithUpdatedRowAlive.with({
      indexes: updatedIndexes,
    } as Partial<this>);
  }

  public publishIndex(indexName: string): this {
    const index = this.indexes.requireByName(indexName);

    const publisehdIndex = index.publish();

    const updatedIndexes = this.indexes.update(publisehdIndex);

    return this.with({
      indexes: updatedIndexes,
    } as Partial<this>);
  }

  public getUniqueIndexByColumns(columns: ColumnId[]): Index | undefined {
    for (const index of this.indexes.values()) {
      if (index.unique && arraysEqual(index.columns, columns)) {
        return index;
      }
    }
  }

  public requireUniqueIndexByColumns(columns: ColumnId[]): Index {
    const index = this.getUniqueIndexByColumns(columns);

    if (index) {
      return index;
    }

    throw new Error(
      `No UNIQUE index found for columns [${columns.join(", ")}] in this exact order`,
    );
  }

  public getSatisfactoryParentIndex(columns: ColumnId[]): Index | undefined {
    for (const index of this.indexes.values()) {
      if (
        index.unique &&
        arraysEqual(index.columns, columns) &&
        index.predicate === undefined
      ) {
        return index;
      }
    }
  }

  public requireSatisfactoryParentIndex(columns: ColumnId[]): Index {
    const index = this.getSatisfactoryParentIndex(columns);

    if (index) {
      return index;
    }

    throw new Error(
      `No satisfactory parent index found for columns [${columns.join(", ")}]`,
    );
  }
}

//used for: addUnique()
function sameColumnSet(a: ColumnId[], b: ColumnId[]): boolean {
  if (a.length !== b.length) return false;

  const setA = new Set(a);
  for (const col of b) {
    if (!setA.has(col)) return false;
  }
  return true;
}
