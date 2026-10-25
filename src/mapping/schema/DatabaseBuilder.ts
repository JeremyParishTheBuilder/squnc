import { type ColumnValue } from "../../types/ColumnValue.js";
import { type Database } from "../../relational/Database.js";
import { type Databases } from "../../relational/Databases.js";
import { ImportResult } from "../import/oldTypes/ImportResult.js";
import { ImportRowIdentity } from "../import/ImportRowIdentity.js";
import { type DatabaseSchema } from "./DatabaseSchema.js";
import type { ColumnInput } from "../../types/ColumnInput.js";
import type { ColumnId } from "../../relational/Column.js";

export class DatabaseBuilder {
  constructor(
    private readonly dbName: string,
    private readonly schema: DatabaseSchema,
    private readonly imports: ImportResult[],
  ) {}

  build(databases: Databases): Databases {
    const updatedDatabases: Databases = databases.create({
      name: this.dbName,
    });

    let database = updatedDatabases.requireByName(this.dbName);

    for (const tableSchema of this.schema.tables.values()) {
      database = database.createTable({ name: tableSchema.name });

      let table = database.tables.requireByName(tableSchema.name);

      for (const columnSchema of tableSchema.columns.values()) {
        table = table.createColumn({
          name: columnSchema.name,
          type: columnSchema.requireType(),
        });
      }

      database = database.updateTable(table);
    }

    const groupedImports = groupImports(this.imports);
    const assembledLogicalRows = assembleLogicalRows(groupedImports);
    const resolvedInserts = bindLogicalRows(assembledLogicalRows, database);

    for (const insert of resolvedInserts) {
      database = database.addRows(insert.tableName, insert.insertRows);
    }

    return updatedDatabases.update(database);
  }
}

type TableName = string;
type GroupedImports = Map<TableName, ImportResult[]>;
// by tableName

// Phase 1: Group Imports.
function groupImports(imports: ImportResult[]): Map<string, ImportResult[]> {
  const groupedImports = new Map<string, ImportResult[]>();

  for (const importResult of imports) {
    if (!groupedImports.get(importResult.tableName)) {
      groupedImports.set(importResult.tableName, []);
    }

    groupedImports.get(importResult.tableName)!.push(importResult);
  }

  return groupedImports;
}

interface ResolvedInsert {
  tableName: string;
  insertRows: Map<ColumnId, ColumnInput>[];
}

interface LogicalRow {
  tableName: string;
  rowIdentity: ImportRowIdentity;
  values: Record<string, ColumnValue>;
}

type MergedGroupedImports = Map<TableName, Map<string, LogicalRow>>;

// Phase 2: Merge imports belonging to the same logical row.
function assembleLogicalRows(
  groupedImports: GroupedImports,
): MergedGroupedImports {
  const mergedGroupedImports = new Map<TableName, Map<string, LogicalRow>>();

  for (const [tableName, imports] of groupedImports) {
    const logicalRows = new Map<string, LogicalRow>();

    for (const importResult of imports) {
      const rowIdentity = importResult.rowIdentity;

      const key = rowIdentity.toString();

      if (!logicalRows.get(key)) {
        logicalRows.set(key, {
          tableName,
          rowIdentity,
          values: {},
        });
      }

      const logicalRow = logicalRows.get(key);

      for (const [propertyName, value] of importResult.values) {
        logicalRow!.values[propertyName] = value as ColumnValue;
      }

      mergedGroupedImports.set(tableName, logicalRows);
    }
  }

  return mergedGroupedImports;
}

// Phase 3: Bind to the schema.
function bindLogicalRows(
  mergedGroupedImports: MergedGroupedImports,
  database: Database,
): ResolvedInsert[] {
  const resolvedInserts: ResolvedInsert[] = [];

  //for each table,
  for (const [tableName, logicalRows] of mergedGroupedImports) {
    // find the table from db
    const table = database.tables.requireByName(tableName);

    const insertRows: Map<ColumnId, ColumnInput>[] = [];

    // for each LogicalRow
    for (const logicalRow of logicalRows.values()) {
      const insertRow = new Map<ColumnId, ColumnInput>();
      // for each property in values
      for (const [propertyName, value] of Object.entries(logicalRow.values)) {
        const column = table.columns.requireByName(propertyName);

        insertRow.set(column.id, value);
      }

      insertRows.push(insertRow);

      // add resolved insert to array
      const resolvedInsert: ResolvedInsert = {
        tableName,
        insertRows,
      };

      resolvedInserts.push(resolvedInsert);
    }
  }

  return resolvedInserts;
}
