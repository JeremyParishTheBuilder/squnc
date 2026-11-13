import type { ColumnId } from "../relational/Column.js";
import { CONSTRAINT_KIND } from "../relational/ConstraintKind.js";
import type { IndexId } from "../relational/Index.js";
import type { Table } from "../relational/Table.js";
import type {
  ColumnRename,
  ConstraintRename,
  IndexRename,
} from "../statements/index.js";
import type { SqlType } from "../types/SqlType.js";
import { normalizeIdentifier } from "../utils/normalizeIdentifier.js";
import type { PlanId } from "./alterTable.js";
import type { ColumnResolver } from "./relation/ColumnResolver.js";
import type { ResolvedColumn } from "./relation/ResolvedColumn.js";

export type PlannedColumnIdentity =
  | { kind: "existing"; columnId: ColumnId }
  | { kind: "planned"; planId: PlanId };

export type PlannedConstraintIdentity =
  | { kind: "existing"; constraintName: string }
  | { kind: "planned"; planId: PlanId };

export type PlannedIndexIdentity =
  { kind: "existing"; indexId: IndexId } | { kind: "planned"; planId: PlanId };

export interface TableSchemaColumn {
  name: string;
  type: SqlType;
  nullable: boolean;
  identity: PlannedColumnIdentity;
}

export interface TableSchemaConstraint {
  name: string;
  kind: CONSTRAINT_KIND;
  columns?: PlannedColumnIdentity[];
  index?: PlannedIndexIdentity;
  identity: PlannedConstraintIdentity;
}

export interface TableSchemaIndex {
  name: string;
  columns: PlannedColumnIdentity[];
  internal?: boolean;
  identity: PlannedIndexIdentity;
  unique?: boolean;
}

export class AlterTableSchema implements ColumnResolver {
  constructor(
    public readonly name: string,
    private columns: Map<string, TableSchemaColumn>,
    private constraints: Map<string, TableSchemaConstraint>,
    private indexes: Map<string, TableSchemaIndex>,
  ) {}

  renameTable(newName: string): AlterTableSchema {
    return new AlterTableSchema(
      newName,
      this.columns,
      this.constraints,
      this.indexes,
    );
  }

  resolveColumn(reference: string): ResolvedColumn {
    return {
      column: {
        column: this.requireColumn(reference),
      },
    };
  }

  static fromTable(table: Table): AlterTableSchema {
    const name = table.name;
    const columns = new Map<string, TableSchemaColumn>();
    const constraints = new Map<string, TableSchemaConstraint>();
    const indexes = new Map<string, TableSchemaIndex>();

    for (const column of table.columns.values()) {
      columns.set(normalizeIdentifier(column.name), {
        name: column.name,
        type: column.type,
        nullable: column.nullable,
        identity: {
          kind: "existing",
          columnId: column.id,
        },
      });
    }

    for (const constraint of table.uniques.values()) {
      constraints.set(normalizeIdentifier(constraint.name), {
        name: constraint.name,
        kind: CONSTRAINT_KIND.unique,
        identity: {
          kind: "existing",
          constraintName: constraint.name,
        },
        index: {
          kind: "existing",
          indexId: constraint.index,
        },
      });
    }
    for (const constraint of table.checks.values()) {
      constraints.set(normalizeIdentifier(constraint.name), {
        name: constraint.name,
        kind: CONSTRAINT_KIND.check,
        identity: {
          kind: "existing",
          constraintName: constraint.name,
        },
      });
    }
    for (const constraint of table.foreignKeys.values()) {
      constraints.set(normalizeIdentifier(constraint.name), {
        name: constraint.name,
        kind: CONSTRAINT_KIND.foreignKey,
        identity: {
          kind: "existing",
          constraintName: constraint.name,
        },
        index: {
          kind: "existing",
          indexId: constraint.reverseIndex,
        },
      });
    }
    if (table.primaryKey) {
      constraints.set(normalizeIdentifier(table.primaryKey.name), {
        name: table.primaryKey.name,
        kind: CONSTRAINT_KIND.primaryKey,
        identity: {
          kind: "existing",
          constraintName: table.primaryKey.name,
        },
        index: {
          kind: "existing",
          indexId: table.primaryKey.index,
        },
      });
    }

    for (const index of table.indexes.values()) {
      indexes.set(normalizeIdentifier(index.name), {
        name: index.name,
        columns: index.columns.map((columnId) => ({
          kind: "existing",
          columnId,
        })),
        unique: index.unique,
        internal: index.internal,
        identity: {
          kind: "existing",
          indexId: index.id,
        },
      });
    }

    return new AlterTableSchema(name, columns, constraints, indexes);
  }

  getColumn(name: string): TableSchemaColumn | undefined {
    const column = this.columns.get(normalizeIdentifier(name));

    return column;
  }

  requireColumn(name: string): TableSchemaColumn {
    const column = this.getColumn(name);

    if (column === undefined) {
      throw new Error(`Column ${name} not found in working schema`);
    }

    return column;
  }

  withColumn(column: TableSchemaColumn): AlterTableSchema {
    const key = normalizeIdentifier(column.name);

    if (this.columns.has(key)) {
      throw new Error(`Column: ${column.name} already in working table schema`);
    }

    const columns = new Map(this.columns);
    columns.set(key, column);

    return new AlterTableSchema(
      this.name,
      columns,
      this.constraints,
      this.indexes,
    );
  }

  withoutColumn(name: string): AlterTableSchema {
    const key = normalizeIdentifier(name);
    const column = this.requireColumn(name);

    for (const constraint of this.constraints.values()) {
      if (
        constraint.columns?.some((columnId) =>
          sameColumnIdentity(columnId, column.identity),
        )
      ) {
        throw new Error(
          `Cannot remove column '${name}': referenced by constraint '${constraint.name}'`,
        );
      }
    }

    for (const index of this.indexes.values()) {
      if (
        index.columns?.some((columnId) =>
          sameColumnIdentity(columnId, column.identity),
        )
      ) {
        throw new Error(
          `Cannot remove column '${name}': referenced by index '${index.name}'`,
        );
      }
    }

    const columns = new Map(this.columns);
    columns.delete(key);

    return new AlterTableSchema(
      this.name,
      columns,
      this.constraints,
      this.indexes,
    );
  }

  getConstraint(name: string): TableSchemaConstraint | undefined {
    const constraint = this.constraints.get(normalizeIdentifier(name));

    return constraint;
  }

  requireConstraint(name: string): TableSchemaConstraint {
    const constraint = this.getConstraint(name);

    if (constraint === undefined) {
      throw new Error(`Constraint ${name} not found in working schema`);
    }

    return constraint;
  }

  requirePrimaryKey(): TableSchemaConstraint {
    const constraint = Array.from(this.constraints.values()).find(
      (c) => c.kind === CONSTRAINT_KIND.primaryKey,
    );

    if (constraint === undefined) {
      throw new Error(`Primary key not found in working schema`);
    }

    return constraint;
  }

  withConstraint(constraint: TableSchemaConstraint): AlterTableSchema {
    const key = normalizeIdentifier(constraint.name);

    if (this.constraints.has(key)) {
      throw new Error(
        `Constraint: ${constraint.name} already in working table schema`,
      );
    }

    const constraints = new Map(this.constraints);
    constraints.set(key, constraint);

    return new AlterTableSchema(
      this.name,
      this.columns,
      constraints,
      this.indexes,
    );
  }

  withoutConstraint(name: string): AlterTableSchema {
    const key = normalizeIdentifier(name);
    const constraint = this.requireConstraint(name);

    const constraints = new Map(this.constraints);
    constraints.delete(key);

    const indexes = new Map(this.indexes);

    if (constraint.index !== undefined) {
      const indexEntry = Array.from(indexes.entries()).find(([, index]) =>
        sameIndexIdentity(index.identity, constraint.index!),
      );

      if (indexEntry) {
        const [indexKey, index] = indexEntry;

        const stillReferenced = Array.from(constraints.values()).some(
          (other) =>
            other.index !== undefined &&
            sameIndexIdentity(other.index, index.identity),
        );

        if (index.internal === true && !stillReferenced) {
          indexes.delete(indexKey);
        }
      }
    }

    return new AlterTableSchema(this.name, this.columns, constraints, indexes);
  }

  renameConstraints(renames: ConstraintRename[]): AlterTableSchema {
    if (renames.length === 0) {
      return this;
    }

    const sourceConstraints = new Map<string, TableSchemaConstraint>();
    const destinationNames = new Set<string>();

    // Resolve sources and reject duplicate sources.
    for (const rename of renames) {
      const sourceKey = normalizeIdentifier(rename.from);
      const destinationKey = normalizeIdentifier(rename.to);

      const constraint = this.constraints.get(sourceKey);

      if (constraint === undefined) {
        throw new Error(`Constraint '${rename.from}' does not exist`);
      }

      if (sourceConstraints.has(sourceKey)) {
        throw new Error(`Duplicate source constraint '${rename.from}'`);
      }

      if (destinationNames.has(destinationKey)) {
        throw new Error(`Duplicate destination constraint '${rename.to}'`);
      }

      sourceConstraints.set(sourceKey, constraint);
      destinationNames.add(destinationKey);
    }

    // Reject destinations occupied by constraints not being renamed.
    for (const rename of renames) {
      const destinationKey = normalizeIdentifier(rename.to);
      const existingConstraint = this.constraints.get(destinationKey);

      if (
        existingConstraint !== undefined &&
        !sourceConstraints.has(destinationKey)
      ) {
        throw new Error(
          `Replacement constraint name '${rename.to}' already taken`,
        );
      }
    }

    // Remove all sources before inserting destinations.
    const constraints = new Map(this.constraints);

    for (const sourceKey of sourceConstraints.keys()) {
      constraints.delete(sourceKey);
    }

    for (const rename of renames) {
      const sourceKey = normalizeIdentifier(rename.from);
      const destinationKey = normalizeIdentifier(rename.to);
      const constraint = sourceConstraints.get(sourceKey)!;

      constraints.set(destinationKey, {
        ...constraint,
        name: rename.to,
      });
    }

    return new AlterTableSchema(
      this.name,
      this.columns,
      constraints,
      this.indexes,
    );
  }

  renameColumns(renames: ColumnRename[]): AlterTableSchema {
    if (renames.length === 0) {
      return this;
    }

    const sourceColumns = new Map<string, TableSchemaColumn>();
    const destinationNames = new Set<string>();

    // Resolve sources and reject duplicate sources.
    for (const rename of renames) {
      const sourceKey = normalizeIdentifier(rename.from);
      const destinationKey = normalizeIdentifier(rename.to);

      const column = this.columns.get(sourceKey);

      if (column === undefined) {
        throw new Error(`Column '${rename.from}' does not exist`);
      }

      if (sourceColumns.has(sourceKey)) {
        throw new Error(`Duplicate source column '${rename.from}'`);
      }

      if (destinationNames.has(destinationKey)) {
        throw new Error(`Duplicate destination column '${rename.to}'`);
      }

      sourceColumns.set(sourceKey, column);
      destinationNames.add(destinationKey);
    }

    // Reject destinations occupied by columns not being renamed.
    for (const rename of renames) {
      const destinationKey = normalizeIdentifier(rename.to);
      const existingColumn = this.columns.get(destinationKey);

      if (existingColumn !== undefined && !sourceColumns.has(destinationKey)) {
        throw new Error(`Replacement column name '${rename.to}' already taken`);
      }
    }

    // Remove all sources before inserting destinations.
    const columns = new Map(this.columns);

    for (const sourceKey of sourceColumns.keys()) {
      columns.delete(sourceKey);
    }

    for (const rename of renames) {
      const sourceKey = normalizeIdentifier(rename.from);
      const destinationKey = normalizeIdentifier(rename.to);
      const column = sourceColumns.get(sourceKey)!;

      columns.set(destinationKey, {
        ...column,
        name: rename.to,
      });
    }

    return new AlterTableSchema(
      this.name,
      columns,
      this.constraints,
      this.indexes,
    );
  }

  withUpdatedColumn(column: TableSchemaColumn): AlterTableSchema {
    const key = normalizeIdentifier(column.name);

    if (!this.columns.has(key)) {
      throw new Error(`Column '${column.name}' does not exist`);
    }

    const columns = new Map(this.columns);
    columns.set(key, column);

    return new AlterTableSchema(
      this.name,
      columns,
      this.constraints,
      this.indexes,
    );
  }

  getIndex(name: string): TableSchemaIndex | undefined {
    const index = this.indexes.get(normalizeIdentifier(name));

    return index;
  }

  requireIndex(name: string): TableSchemaIndex {
    const index = this.getIndex(name);

    if (index === undefined || index.internal) {
      throw new Error(`Index ${name} not found in working schema`);
    }

    return index;
  }

  renameIndexes(renames: IndexRename[]): AlterTableSchema {
    if (renames.length === 0) {
      return this;
    }

    const sourceIndexes = new Map<string, TableSchemaIndex>();
    const destinationNames = new Set<string>();

    // Resolve sources and reject duplicate sources.
    for (const rename of renames) {
      const sourceKey = normalizeIdentifier(rename.from);
      const destinationKey = normalizeIdentifier(rename.to);

      const index = this.indexes.get(sourceKey);

      if (index === undefined) {
        throw new Error(`Index '${rename.from}' does not exist`);
      }

      if (sourceIndexes.has(sourceKey)) {
        throw new Error(`Duplicate source index '${rename.from}'`);
      }

      if (destinationNames.has(destinationKey)) {
        throw new Error(`Duplicate destination index '${rename.to}'`);
      }

      sourceIndexes.set(sourceKey, index);
      destinationNames.add(destinationKey);
    }

    // Reject destinations occupied by indexes not being renamed.
    for (const rename of renames) {
      const destinationKey = normalizeIdentifier(rename.to);
      const existingIndex = this.indexes.get(destinationKey);

      if (existingIndex !== undefined && !sourceIndexes.has(destinationKey)) {
        throw new Error(`Replacement index name '${rename.to}' already taken`);
      }
    }

    // Remove all sources before inserting destinations.
    const indexes = new Map(this.indexes);

    for (const sourceKey of sourceIndexes.keys()) {
      indexes.delete(sourceKey);
    }

    for (const rename of renames) {
      const sourceKey = normalizeIdentifier(rename.from);
      const destinationKey = normalizeIdentifier(rename.to);
      const index = sourceIndexes.get(sourceKey)!;

      indexes.set(destinationKey, {
        ...index,
        name: rename.to,
      });
    }

    return new AlterTableSchema(
      this.name,
      this.columns,
      this.constraints,
      indexes,
    );
  }

  withIndex(index: TableSchemaIndex): AlterTableSchema {
    const key = normalizeIdentifier(index.name);

    if (this.indexes.has(key)) {
      throw new Error(`Index: ${index.name} already in working table schema`);
    }

    const indexes = new Map(this.indexes);
    indexes.set(key, index);

    return new AlterTableSchema(
      this.name,
      this.columns,
      this.constraints,
      indexes,
    );
  }

  withoutIndex(name: string): AlterTableSchema {
    const key = normalizeIdentifier(name);
    const index = this.requireIndex(name);

    for (const constraint of this.constraints.values()) {
      if (sameIndexIdentity(constraint.index, index.identity)) {
        throw new Error(
          `Cannot remove index '${name}': referenced by constraint '${constraint.name}'`,
        );
      }
    }

    const indexes = new Map(this.indexes);
    indexes.delete(key);

    return new AlterTableSchema(
      this.name,
      this.columns,
      this.constraints,
      indexes,
    );
  }
}

function sameColumnIdentity(
  a: PlannedColumnIdentity | undefined,
  b: PlannedColumnIdentity | undefined,
): boolean {
  if (a === undefined || b === undefined) return false;

  if (a.kind !== b.kind) return false;

  return a.kind === "existing"
    ? a.columnId ===
        (b as Extract<PlannedColumnIdentity, { kind: "existing" }>).columnId
    : a.planId ===
        (b as Extract<PlannedColumnIdentity, { kind: "planned" }>).planId;
}

function sameIndexIdentity(
  a: PlannedIndexIdentity | undefined,
  b: PlannedIndexIdentity | undefined,
): boolean {
  if (a === undefined || b === undefined) return false;

  if (a.kind !== b.kind) return false;

  return a.kind === "existing"
    ? a.indexId ===
        (b as Extract<PlannedIndexIdentity, { kind: "existing" }>).indexId
    : a.planId ===
        (b as Extract<PlannedIndexIdentity, { kind: "planned" }>).planId;
}
