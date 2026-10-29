
import type { ColumnId } from "../../relational/Column.js";
import type { Databases } from "../../relational/Databases.js";
import type { ColumnInput } from "../../types/ColumnInput.js";
import type { DiscoveryResults } from "../discovery/DiscoveryResults.js";
import type { DiscoveryIdentity } from "../discovery/DiscoveryIdentity.js";
import type { DatabaseSchema } from "./DatabaseSchema.js";
import type { StructuredValue } from "../value/StructuredValue.js";
import { SQL_JSON, SQL_VARCHAR } from "../../types/SqlType.js";

const IDENTITY_COLUMN = "identity";
const PARENT_NODE_TYPE_COLUMN = "parentNodeType";
const PARENT_IDENTITY_COLUMN = "parentIdentity";

type RowValues = Map<string, ColumnInput>;

interface ParentRow {
  nodeType: string;
  identity: DiscoveryIdentity;
}

export class DatabaseBuilder {
  constructor(
    private readonly databaseName: string,
    private readonly schema: DatabaseSchema,
    private readonly discoveryResults: DiscoveryResults,
    private readonly rootNodeType: string,
  ) {}

  build(databases: Databases): Databases {
    if (databases.getByName(this.databaseName)) {
      throw new Error(
        `Database '${this.databaseName}' already exists.`,
      );
    }

    this.validateStructuralColumns();

    let updatedDatabases = databases.create({
      name: this.databaseName,
    });

    let database = updatedDatabases.requireByName(
      this.databaseName,
    );

    // Create all tables and columns before inserting any rows.
    for (const tableSchema of this.schema.tables.values()) {
      database = database.createTable({
        name: tableSchema.name,
      });

      let table = database.tables.requireByName(
        tableSchema.name,
      );

      for (const columnSchema of tableSchema.columns.values()) {
        table = table.createColumn({
          name: columnSchema.name,
          type: columnSchema.requireType(),
          nullable: columnSchema.nullable,
        });
      }

      table = table.createColumn({
        name: IDENTITY_COLUMN,
        type: SQL_JSON,
        nullable: false,
      });

      if (tableSchema.parentTableName !== undefined) {
        table = table.createColumn({
          name: PARENT_NODE_TYPE_COLUMN,
          type: SQL_VARCHAR,
          nullable: false,
        });

        table = table.createColumn({
          name: PARENT_IDENTITY_COLUMN,
          type: SQL_JSON,
          nullable: false,
        });
      }

      database = database.updateTable(table);
    }

    // Materialize rows from the already-discovered payloads.
    const rowsByTable = new Map<string, RowValues[]>();

    for (const result of this.discoveryResults.getAll()) {
      if (result.nodeType !== this.rootNodeType) continue;

      const value = result.value;

      if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value)
      ) {
        continue;
      }

      this.appendObjectRow(
        this.rootNodeType,
        value as Record<string, unknown>,
        result.identity,
        undefined,
        rowsByTable,
      );
    }

    // Bind column names to IDs and insert all rows.
    for (const [tableName, rows] of rowsByTable) {
      const table = database.tables.requireByName(tableName);

      const inserts: Map<ColumnId, ColumnInput>[] = rows.map(
        (row) => {
          const insert = new Map<ColumnId, ColumnInput>();

          for (const column of table.columns.values()) {
            const value = row.has(column.name)
              ? row.get(column.name)!
              : null;

            insert.set(column.id, value);
          }

          return insert;
        },
      );

      database = database.addRows(tableName, inserts);
    }

    return updatedDatabases.update(database);
  }

  private validateStructuralColumns(): void {
    for (const table of this.schema.tables.values()) {
      const reserved = [
        IDENTITY_COLUMN,
        ...(table.parentTableName !== undefined
          ? [
              PARENT_NODE_TYPE_COLUMN,
              PARENT_IDENTITY_COLUMN,
            ]
          : []),
      ];

      for (const name of reserved) {
        if (table.columns.has(name)) {
          throw new Error(
            `Inferred column '${name}' in table '${table.name}' ` +
              "conflicts with a structural column.",
          );
        }
      }

      if (
        table.parentTableName !== undefined &&
        !this.schema.tables.has(table.parentTableName)
      ) {
        throw new Error(
          `Parent table '${table.parentTableName}' for ` +
            `'${table.name}' does not exist in the inferred schema.`,
        );
      }
    }
  }

  private appendObjectRow(
    tableName: string,
    object: Record<string, unknown>,
    identity: DiscoveryIdentity,
    parent: ParentRow | undefined,
    rowsByTable: Map<string, RowValues[]>,
  ): void {
    const row: RowValues = new Map();

    row.set(
      IDENTITY_COLUMN,
      [...identity.parts] as StructuredValue,
    );

    if (parent !== undefined) {
      row.set(PARENT_NODE_TYPE_COLUMN, parent.nodeType);
      row.set(
        PARENT_IDENTITY_COLUMN,
        [...parent.identity.parts] as StructuredValue,
      );
    }

    const arrays: {
      tableName: string;
      sourcePath: string[];
      values: unknown[];
    }[] = [];

    const visit = (
      current: Record<string, unknown>,
      path: readonly string[] = [],
    ): void => {
      for (const [key, value] of Object.entries(current)) {
        const childPath = [...path, key];

        if (Array.isArray(value)) {
          arrays.push({
            tableName: [
              tableName,
              ...childPath,
            ].join("__"),
            sourcePath: [...childPath],
            values: value,
          });

          continue;
        }

        if (
          value !== null &&
          typeof value === "object"
        ) {
          visit(
            value as Record<string, unknown>,
            childPath,
          );

          continue;
        }

        row.set(
          childPath.join("__"),
          value as ColumnInput,
        );
      }
    };

    visit(object);

    this.addRow(rowsByTable, tableName, row);

    for (const array of arrays) {
      const childTable = this.schema.tables.get(
        array.tableName,
      );

      if (!childTable) {
        throw new Error(
          `No inferred table '${array.tableName}' exists.`,
        );
      }

      if (childTable.parentTableName !== tableName) {
        throw new Error(
          `Inferred parent mismatch for table '${array.tableName}'.`,
        );
      }

      array.values.forEach((element, index) => {
        const childIdentity = identity.append(index);
        const childParent: ParentRow = {
          nodeType: tableName,
          identity,
        };

        if (
          element !== null &&
          typeof element === "object" &&
          !Array.isArray(element)
        ) {
          this.appendObjectRow(
            array.tableName,
            element as Record<string, unknown>,
            childIdentity,
            childParent,
            rowsByTable,
          );

          return;
        }

        if (Array.isArray(element)) {
          throw new Error(
            `Nested array element in '${array.tableName}' ` +
              "is not supported as a scalar value.",
          );
        }

        this.addRow(
          rowsByTable,
          array.tableName,
          new Map<string, ColumnInput>([
            ["value", element as ColumnInput],
            [
              IDENTITY_COLUMN,
              [...childIdentity.parts] as StructuredValue,
            ],
            [PARENT_NODE_TYPE_COLUMN, tableName],
            [
              PARENT_IDENTITY_COLUMN,
              [...identity.parts] as StructuredValue,
            ],
          ]),
        );
      });
    }
  }

  private addRow(
    rowsByTable: Map<string, RowValues[]>,
    tableName: string,
    row: RowValues,
  ): void {
    let rows = rowsByTable.get(tableName);

    if (!rows) {
      rows = [];
      rowsByTable.set(tableName, rows);
    }

    rows.push(row);
  }
}