import { describe, it, expect } from 'vitest';
import { buildDatabase, createColumnTestSpec } from '../utils/buildSchema.js';
import type { ColumnId } from '../../src/relational/Column.js';
import type { ColumnInput } from '../../src/types/ColumnInput.js';
import { SQL_DECIMAL } from '../../src/types/SqlType.js';

describe('Database::addRows', () => {
  it("allows inserting a batch of rows with valid foreign key references", () => {
    let database = buildDatabase()
      .createTable({ name: "Roles" })
      .createTable({ name: "Users" });

    const roles = database.tables
      .requireByName("Roles")
      .createColumn(
        createColumnTestSpec({
          name: "Id",
          type: SQL_DECIMAL,
          nullable: false,
        }),
      )
      .createIndex({
        name: "PK_Roles",
        columns: ["Id"],
        unique: true,
      });

    const users = database.tables
      .requireByName("Users")
      .createColumn(
        createColumnTestSpec({
          name: "RoleId",
          type: SQL_DECIMAL,
        }),
      );

    database = database
      .updateTable(roles)
      .updateTable(users)
      .createForeignKey("Users", {
        name: "FK_Users_Roles",
        columns: ["RoleId"],
        reverseIndex: "FKRI_Roles",
        parentTable: "Roles",
        parentColumns: ["Id"],
      });

    const columnId = users.columns.requireByName("RoleId").id;

    database = database.addRows("Roles", [
      new Map([[columnId, 1]]),
      new Map([[columnId, 2]]),
    ]);

    const updated = database.addRows("Users", [
      new Map([[columnId, 1]]),
      new Map([[columnId, 2]]),
    ]);

    const usersTable = updated.tables.requireByName("Users");

    expect(usersTable.numRows).toBe(2);
    expect(usersTable.requireRow(0)).toEqual([1]);
    expect(usersTable.requireRow(1)).toEqual([2]);
  });

  it('allows NULL foreign key values', () => {
    let database = buildDatabase()
      .createTable({name: "Roles"})
      .createTable({name: "Users"});

    const roles = database.tables.requireByName("Roles")
      .createColumn(createColumnTestSpec({
        name: "Id",
        type: SQL_DECIMAL,
        nullable: false,
      }))
      .createIndex({
        name: "PK_Roles",
        columns: ["Id"],
        unique: true,
      });

    const users = database.tables.requireByName("Users")
      .createColumn(createColumnTestSpec({
        name: "RoleId",
        type: SQL_DECIMAL,
      }));

    database = database
      .updateTable(roles)
      .updateTable(users);

    database = database.createForeignKey(
      "Users",
      {
        name: "FK_Users_Roles",
        columns: ["RoleId"],
        reverseIndex: "FKRI_Roles",
        parentTable: "Roles",
        parentColumns: ["Id"],
      }
    );

    const columnId = users.columns.requireByName("RoleId").id;

    expect(() => {
      database.addRows(
        "Users",
        [new Map<ColumnId, ColumnInput>().set(columnId, null)]
      );
    }).not.toThrow();
  });

  it('rejects insertion when foreign key reference does not exist', () => {
    let database = buildDatabase()
      .createTable({name: "Roles"})
      .createTable({name: "Users"});

    let parent = database.tables.requireByName("Roles")
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createIndex({
        name: "PK_Roles",
        columns: ["id"],
        unique: true,
      });

    parent = parent.addRows([[1]]);

    const child = database.tables.requireByName("Users")
      .createColumn(createColumnTestSpec({
        name: "roleId",
        type: SQL_DECIMAL,
      }));

    database = database
      .updateTable(parent)
      .updateTable(child)
      .createForeignKey("users", {
        name: "FK_Users_Roles",
        columns: ["roleId"],
        reverseIndex: "FKRI_Roles",
        parentTable: "Roles",
        parentColumns: ["id"],
        onDelete: "restrict",
        onUpdate: "restrict",
      });

    const columnId = child.columns.requireByName("RoleId").id;

    expect(() => {
      database.addRows(
        "Users",
        [new Map<ColumnId, ColumnInput>().set(columnId, 2)]
      );
    }).toThrow();
  });

  it('allows insertion when foreign key contains NULL components', () => {
    let database = buildDatabase()
      .createTable({name: "Roles"})
      .createTable({name: "Users"});

    const parent = database.tables.requireByName("Roles")
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createIndex({
        name: "PK_Roles",
        columns: ["id"],
        unique: true,
      });

    const child = database.tables.requireByName("Users")
      .createColumn(createColumnTestSpec({
        name: "roleId",
        type: SQL_DECIMAL,
      }));

    database = database
      .updateTable(parent)
      .updateTable(child)
      .createForeignKey("users", {
        name: "FK_Users_Roles",
        columns: ["roleId"],
        reverseIndex: "FKRI_Roles",
        parentTable: "Roles",
        parentColumns: ["id"],
        onDelete: "restrict",
        onUpdate: "restrict",
      });

    const columnId = child.columns.requireByName("RoleId").id;

    expect(() => {
      database.addRows(
        "Users",
        [new Map<ColumnId, ColumnInput>().set(columnId, null)]
      );
    }).not.toThrow();
  });
});