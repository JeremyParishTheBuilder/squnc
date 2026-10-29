import { Table, type TableId, type TablePolicy } from "./Table.js";
import { normalizeIdentifier } from "../utils/normalizeIdentifier.js";
import { type Column, type ColumnId } from "./Column.js";
import { type ColumnValue } from "../types/ColumnValue.js";
import { CompiledForeignKey, type ForeignKey } from "./ForeignKey.js";
import { Immutable } from "../infrastructure/Immutable.js";
import { type ReferentialAction } from "./ReferentialAction.js";
import { type RowView } from "./RowView.js";
import { IdAllocator } from "../types/IdAllocator.js";
import { NamedObjectStore } from "../infrastructure/NamedObjectStore.js";
import { type ResolvedUpdate } from "../types/ResolvedUpdate.js";
import { type ResolvedDelete } from "../types/ResolvedDelete.js";
import { arraysEqual } from "../utils/arrayHelpers.js";
import { ConstraintViolationError } from "./ConstraintViolationError.js";
import { CONSTRAINT_KIND } from "./ConstraintKind.js";
import type { UpdateAssignment } from "../types/UpdateAssignment.js";
import type { OrderedInputRow } from "../types/OrderedInputRow.js";
import type { ColumnInput } from "../types/ColumnInput.js";
import { DEFAULT } from "../dialect/keywords.js";
import { isAssignable, isSameType, type SqlType } from "../types/SqlType.js";

export type DatabaseId = number & { readonly __brand: "DatabaseId" };

export class Database extends Immutable {
  public readonly id: DatabaseId;
  public readonly name: string;

  public readonly tables: NamedObjectStore<Table, TableId>;
  public readonly tableIds: IdAllocator<TableId>;

  constructor(spec: { id: DatabaseId; name: string }) {
    super();

    this.id = spec.id;
    this.name = spec.name;

    this.tables = new NamedObjectStore();
    this.tableIds = new IdAllocator();

    this.validate();
    this.seal();
  }

  public validate() {}

  public static create(spec: { name: string; id: DatabaseId }): Database {
    return new Database(spec);
  }

  public addTable(table: Table): this {
    return this.with({
      tables: this.tables.add(table),
    } as Partial<this>);
  }

  public updateTable(table: Table): Database {
    return this.with({
      tables: this.tables.update(table),
    } as Partial<this>);
  }

  public createTable(spec: { name: string }, policy?: TablePolicy): this {
    this.tables.assertNameUnused(spec.name);

    const [id, tableIds] = this.tableIds.allocate();

    const table = Table.create({ ...spec, id }, policy);

    const updatedTables = this.tables.add(table);

    return this.with({
      tables: updatedTables,
      tableIds,
    } as Partial<this>);
  }

  public removeTable(name: string): Database {
    return this.removeTableById(this.tables.requireIdByName(name));
  }

  public removeTableById(id: TableId): Database {
    this.tables.require(id);

    for (const table of this.tables.values()) {
      table.assertTableUnreferenced(id);
    }

    const updatedTables = this.tables.remove(id);

    return this.with({
      tables: updatedTables,
    } as Partial<this>);
  }

  public renameTable(name: string, newName: string): Database {
    return this.renameTableById(this.tables.requireIdByName(name), newName);
  }

  public renameTableById(id: TableId, newName: string): Database {
    const table = this.tables.require(id);

    const oldName = table.name;

    if (oldName === newName) return this;

    const normalizedOldName = normalizeIdentifier(oldName);
    const normalizedNewName = normalizeIdentifier(newName);

    if (normalizedOldName !== normalizedNewName) {
      this.assertTableNameUnused(newName);
    }

    const renamedTable = table.rename(newName);

    const updatedTables = this.tables.update(renamedTable);

    return this.with({
      tables: updatedTables,
    } as Partial<this>);
  }

  private assertTableNameUnused(name: string): void {
    if (this.tables.hasName(name)) {
      throw new Error(`Table name ${name} is already used`);
    }
  }

  //Database is where ForeignKey should resolve names to ids
  public createForeignKey(
    tableName: string,
    spec: {
      name: string;
      columns: string[];
      reverseIndex: string;
      parentTable: string;
      parentColumns: string[];
      onDelete?: ReferentialAction;
      onUpdate?: ReferentialAction;
    },
  ): Database {
    const childTable = this.tables.requireByName(tableName);

    const childColumnIds = spec.columns.map((c) =>
      childTable.columns.requireIdByName(c),
    );
    const childColumns = childColumnIds.map((c) =>
      childTable.columns.require(c),
    );

    const reverseIndex = childTable.indexes.requireByName(spec.reverseIndex);

    const parentTable = this.tables.requireByName(spec.parentTable);

    const parentColumnIds = spec.parentColumns.map((c) =>
      parentTable.columns.requireIdByName(c),
    );
    const parentColumns = parentColumnIds.map((c) =>
      parentTable.columns.require(c),
    );

    const parentIndex =
      parentTable.requireUniqueIndexByColumns(parentColumnIds);

    assertForeignKeyColumnCompatibility(childColumns, parentColumns);

    const updatedChildTable = childTable.createForeignKey({
      ...spec,
      columns: childColumnIds,
      reverseIndex: reverseIndex.id,
      parentTable: parentTable.id,
      parentColumns: parentColumnIds,
      parentIndex: parentIndex.id,
    });

    const foreignKey = updatedChildTable.foreignKeys.requireByName(spec.name);

    this.assertExistingRowsSatisfyForeignKey(childTable, foreignKey);

    return this.updateTable(updatedChildTable);
  }

  public assertExistingRowsSatisfyForeignKey(
    childTable: Table,
    foreignKey: ForeignKey,
  ) {
    const parentIndex = this.tables
      .require(foreignKey.parentTable)
      .indexes.require(foreignKey.parentIndex);

    const reverseIndex = childTable.indexes.require(foreignKey.reverseIndex);

    for (const row of childTable.iterateAliveRows()) {
      const projected = reverseIndex.projectValues(row.values);

      if (projected.includes(null)) continue;

      if (!parentIndex.hasProjectedValues(projected)) {
        throw new ConstraintViolationError({
          constraintName: foreignKey.name,
          constraintKind: CONSTRAINT_KIND.foreignKey,
          participants: [
            {
              table: childTable.id,
              rowId: row.index,
              columns: foreignKey.columns,
              columnValues: projected,
              referencedTable: foreignKey.parentTable,
              referencedColumns: foreignKey.parentColumns,
            },
          ],
          message: `Foreign key violation on existing row ${row.index}. ${projected}`,
        });
      }
    }
  }
  //  </foreignKey>

  //Used in Database::removeColumn()
  public assertNoForeignKeyReferencesAny(
    tableId: TableId,
    columns: ColumnId[],
  ): void {
    const target = new Set(columns);

    for (const table of this.tables.values()) {
      for (const fk of table.foreignKeys.values()) {
        if (
          fk.parentTable === tableId &&
          fk.parentColumns.some((col) => target.has(col))
        ) {
          throw new Error(
            `Foreign key '${fk.name}' in table '${table.name}' references column(s) being modified'`,
          );
        }
      }
    }
  }

  private findImpactedChildRowReferences(
    parentTableId: TableId,
    parentRow: RowView,
  ): Array<{
    foreignKey: ForeignKey;
    childTableId: TableId;
    childRowNum: number;
  }> {
    const childRowReferences = [];

    const parentTable = this.tables.require(parentTableId);

    for (const table of this.tables.values()) {
      for (const foreignKey of table.foreignKeys.values()) {
        if (foreignKey.parentTable !== parentTable.id) continue;

        const reverseIndex = table.indexes.require(foreignKey.reverseIndex);

        const parentIndex = parentTable.indexes.require(foreignKey.parentIndex);
        const projection = parentIndex.projectValues(parentRow.values);

        const currentRows = reverseIndex.getRowNumsFromProjection(projection);

        if (!currentRows?.length) continue;
        for (const childRowNum of currentRows) {
          // No-op when no impact to parent projection
          if (parentTable.isRowAlive(parentRow.index)) {
            const replacementRow = parentTable.requireRow(parentRow.index);
            const replacementRowProjection =
              parentIndex.projectValues(replacementRow);

            if (arraysEqual(projection, replacementRowProjection)) continue;
          }

          childRowReferences.push({
            foreignKey,
            childTableId: table.id,
            childRowNum,
          });
        }
      }
    }

    return childRowReferences;
  }

  public addRows(
    tableName: string,
    inserts: Map<ColumnId, ColumnInput>[],
  ): Database {
    if (inserts.length === 0) {
      return this;
    }

    const table: Table = this.tables.requireByName(tableName);

    const orderedRows = inserts.map((insert) => table.orderInputs(insert));

    const updatedTable = table.addRows(orderedRows);

    const updatedDatabase = this.updateTable(updatedTable);

    updatedDatabase.assertAllForeignKeysValid();

    return updatedDatabase;
  }

  public removeRows(tableName: string, deletes: ResolvedDelete[]): Database {
    const tableId = this.tables.requireIdByName(tableName);

    let updatedDatabase = this.applyResolvedDeletes(tableId, deletes);

    updatedDatabase = updatedDatabase.applyReferentialWork({
      kind: "delete",
      tableId,
      deletes,
    });

    updatedDatabase.assertAllForeignKeysValid();

    return updatedDatabase;
  }

  public updateRows(
    tableName: string,
    rowNums: readonly number[],
    rows: readonly OrderedInputRow[],
  ): Database {
    const table = this.tables.requireByName(tableName);

    const resolved = table.updateRows(rowNums, rows);

    let updatedDatabase = this.updateTable(resolved.table);

    updatedDatabase = updatedDatabase.applyReferentialWork({
      kind: "update",
      tableId: table.id,
      updates: resolved.updates,
    });

    updatedDatabase.assertAllForeignKeysValid();

    return updatedDatabase;
  }

  public resolveAndUpdateRows(
    tableName: string,
    affectedRows: Iterable<RowView>,
    assignments: Map<ColumnId, UpdateAssignment>,
  ): Database {
    const table = this.tables.requireByName(tableName);

    const rowNums: number[] = [];
    const orderedInputRows: OrderedInputRow[] = [];

    // evaluates expressions
    for (const row of affectedRows) {
      const inputs = new Map<ColumnId, ColumnInput>();

      for (const [columnId, assignment] of assignments) {
        if (assignment === DEFAULT) {
          inputs.set(columnId, DEFAULT);
        } else {
          inputs.set(columnId, assignment.evaluate(row));
        }
      }

      const orderedInputs = table.orderInputs(inputs);

      orderedInputRows.push(orderedInputs);
      rowNums.push(row.index);
    }

    return this.updateRows(table.name, rowNums, orderedInputRows);
  }

  private applyResolvedUpdates(
    tableId: TableId,
    updates: ResolvedUpdate[],
  ): Database {
    if (updates.length === 0) {
      return this;
    }

    const table: Table = this.tables.require(tableId);

    const updatedTable = table.applyResolvedUpdates(updates);

    return this.updateTable(updatedTable);
  }

  private applyResolvedDeletes(
    tableId: TableId,
    deletes: ResolvedDelete[],
  ): Database {
    if (deletes.length === 0) {
      return this;
    }

    const table: Table = this.tables.require(tableId);

    const updatedTable = table.removeRows(deletes);

    return this.updateTable(updatedTable);
  }

  private applyReferentialWork(initialWork: ReferentialWork): Database {
    let db: Database = this as this;

    const queue: ReferentialWork[] = [initialWork];

    while (queue.length > 0) {
      const current = queue.shift()!;

      const tableId = current.tableId;
      const table = db.tables.require(tableId);

      const childDeletesByTable = new Map<TableId, ResolvedDelete[]>();
      const childUpdatesByTable = new Map<TableId, ResolvedUpdate[]>();

      const compiledFks = new Map<ForeignKey, CompiledForeignKey>();

      const rows =
        current.kind === "update" ? current.updates : current.deletes;

      for (const row of rows) {
        const oldRowView: RowView = {
          index: row.rowNum,
          values: row.oldRow,
        };

        const refs = db.findImpactedChildRowReferences(tableId, oldRowView);

        for (const ref of refs) {
          const fk = ref.foreignKey;
          let compiledFk = compiledFks.get(fk);

          if (!compiledFk) {
            const childReferenceTable = db.tables.require(ref.childTableId);
            compiledFk = new CompiledForeignKey(
              fk,
              childReferenceTable.indexes.require(fk.reverseIndex)
                .columnIndexes,
              table.indexes.require(fk.parentIndex).columnIndexes,
            );
            compiledFks.set(fk, compiledFk);
          }

          const compiledChildRowReference = {
            ...ref,
            foreignKey: compiledFk,
          };

          let childMutation: ResolvedDelete | ResolvedUpdate | undefined;

          if (current.kind === "update") {
            childMutation = db.resolveReferentialUpdateAction(
              compiledChildRowReference,
              (row as ResolvedUpdate).newRow,
            );
          } else {
            childMutation = db.resolveReferentialDeleteAction(
              compiledChildRowReference,
            );
          }

          if (!childMutation) continue;

          if ("newRow" in childMutation) {
            let tableUpdates = childUpdatesByTable.get(ref.childTableId);

            if (!tableUpdates) {
              tableUpdates = [];
              childUpdatesByTable.set(ref.childTableId, tableUpdates);
            }

            tableUpdates.push(childMutation);
          } else {
            let tableDeletes = childDeletesByTable.get(ref.childTableId);

            if (!tableDeletes) {
              tableDeletes = [];
              childDeletesByTable.set(ref.childTableId, tableDeletes);
            }

            tableDeletes.push(childMutation);
          }
        }
      }

      for (const [tableId, deletes] of childDeletesByTable) {
        db = db.applyResolvedDeletes(tableId, deletes);

        queue.push({
          kind: "delete",
          tableId,
          deletes,
        });
      }

      for (const [tableId, updates] of childUpdatesByTable) {
        db = db.applyResolvedUpdates(tableId, updates);

        queue.push({
          kind: "update",
          tableId,
          updates,
        });
      }
    }

    return db;
  }

  private resolveReferentialUpdateAction(
    compiledChildRowReference: {
      foreignKey: CompiledForeignKey;
      childTableId: TableId;
      childRowNum: number;
    },
    newParentRow: readonly ColumnValue[],
  ): ResolvedUpdate | undefined {
    const fk = compiledChildRowReference.foreignKey.fk;

    const childTable = this.tables.require(
      compiledChildRowReference.childTableId,
    );

    const childRow = childTable.requireRow(
      compiledChildRowReference.childRowNum,
    );

    switch (fk.onUpdate) {
      case "noAction":
        return undefined;

      case "restrict":
        throw new Error(`Child Table references Parent Row`);

      case "setNull": {
        const updatedChildRow =
          compiledChildRowReference.foreignKey.applyReferentialActionToRow(
            childRow,
            newParentRow,
            "setNull",
          );

        if (arraysEqual(childRow, updatedChildRow)) {
          return undefined;
        }

        return {
          rowNum: compiledChildRowReference.childRowNum,
          oldRow: childRow,
          newRow: updatedChildRow,
        };
      }

      case "cascade": {
        const updatedChildRow =
          compiledChildRowReference.foreignKey.applyReferentialActionToRow(
            childRow,
            newParentRow,
            "cascade",
          );

        if (arraysEqual(childRow, updatedChildRow)) {
          return undefined;
        }

        return {
          rowNum: compiledChildRowReference.childRowNum,
          oldRow: childRow,
          newRow: updatedChildRow,
        };
      }

      default:
        throw new Error(`Unsupported referential action`);
    }
  }

  private resolveReferentialDeleteAction(compiledChildRowReference: {
    foreignKey: CompiledForeignKey;
    childTableId: TableId;
    childRowNum: number;
  }): ResolvedUpdate | ResolvedDelete | undefined {
    const fk = compiledChildRowReference.foreignKey.fk;

    const childTable = this.tables.require(
      compiledChildRowReference.childTableId,
    );

    const childRow = childTable.requireRow(
      compiledChildRowReference.childRowNum,
    );

    switch (fk.onDelete) {
      case "noAction":
        return undefined;

      case "restrict":
        throw new Error(`Child Table references Parent Row`);

      case "setNull": {
        const updatedChildRow =
          compiledChildRowReference.foreignKey.applyReferentialActionToRow(
            childRow,
            undefined,
            "setNull",
          );

        if (arraysEqual(childRow, updatedChildRow)) {
          return undefined;
        }

        return {
          rowNum: compiledChildRowReference.childRowNum,
          oldRow: childRow,
          newRow: updatedChildRow,
        };
      }

      case "cascade": {
        return {
          rowNum: compiledChildRowReference.childRowNum,
          oldRow: childRow,
        };
      }

      default:
        throw new Error(`Unsupported referential action`);
    }
  }

  private assertAllForeignKeysValid(): void {
    for (const table of this.tables.values()) {
      for (const fk of table.foreignKeys.values()) {
        this.assertExistingRowsSatisfyForeignKey(table, fk);
      }
    }
  }

  public removeColumn(tableName: string, columnName: string): Database {
    const table = this.tables.requireByName(tableName);

    const columnId = table.columns.requireIdByName(columnName);

    this.assertNoForeignKeyReferencesAny(table.id, [columnId]);

    const updatedTable = table.removeColumnById(columnId);

    return this.updateTable(updatedTable);
  }

  public removeIndex(tableName: string, indexName: string): Database {
    const table = this.tables.requireByName(tableName);

    const index = table.indexes.requireByName(indexName);

    for (const childTable of this.tables.values()) {
      for (const fk of childTable.foreignKeys.values()) {
        if (fk.parentTable === table.id) {
          const fkParentIndex = table.indexes.require(fk.parentIndex);
          if (fkParentIndex === index) {
            throw new Error(
              `Index is Parent for Foreign Key: ${fk.name} of Child Table: ${childTable.name}`,
            );
          }
        }
      }
    }

    const updatedTable = table.removeIndex(indexName);

    return this.updateTable(updatedTable);
  }

  public alterColumn(
    tableName: string,
    columnName: string,
    newType: SqlType,
  ): Database {
    const table = this.tables.requireByName(tableName);

    const columnId = table.columns.requireIdByName(columnName);

    this.assertColumnCanBeAltered(table, columnId, newType);

    return this.updateTable(table.alterColumnById(columnId, newType));
  }

  private assertColumnCanBeAltered(
    alteredTable: Table,
    columnId: ColumnId,
    newType: SqlType,
  ): void {
    for (const table of this.tables.values()) {
      for (const fk of table.foreignKeys.values()) {
        if (table.id === alteredTable.id && fk.columns.includes(columnId)) {
          const fkColumnPositionIndex = fk.columns.findIndex(
            (c) => c === columnId,
          );
          const counterpartColumnId = fk.parentColumns[fkColumnPositionIndex];
          const parentTable = this.tables.require(fk.parentTable);

          assertTypeAlters(
            parentTable.columns.require(counterpartColumnId).type,
            newType,
          );
        }

        if (
          fk.parentTable === alteredTable.id &&
          fk.parentColumns.includes(columnId)
        ) {
          const fkColumnPositionIndex = fk.parentColumns.findIndex(
            (c) => c === columnId,
          );
          const counterpartColumnId = fk.columns[fkColumnPositionIndex];

          assertTypeAlters(
            table.columns.require(counterpartColumnId).type,
            newType,
          );
        }
      }
    }
  }
}

function assertTypeAlters(oldType: SqlType, newType: SqlType): void {
  if (!isAssignable(oldType, newType)) {
    throw new Error(`Old column type ${oldType} not assignable to ${newType}`);
  }
}

//used for: addForeignKey
function assertForeignKeyColumnCompatibility(
  childColumns: Column[],
  parentColumns: Column[],
): void {
  if (childColumns.length !== parentColumns.length) {
    throw new Error("Column count mismatch");
  }

  for (let i = 0; i < childColumns.length; i++) {
    const child = childColumns[i];
    const parent = parentColumns[i];

    if (!isSameType(child.type, parent.type)) {
      throw new Error(
        `Column type mismatch: ` +
          `'${child.name}' (${child.type}) ` +
          `!= '${parent.name}' (${parent.type})`,
      );
    }
  }
}

type ReferentialWork =
  | {
      kind: "delete";
      tableId: TableId;
      deletes: ResolvedDelete[];
    }
  | {
      kind: "update";
      tableId: TableId;
      updates: ResolvedUpdate[];
    };
