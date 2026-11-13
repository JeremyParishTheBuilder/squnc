import { describe, it, expect } from 'vitest';
import { buildDatabase, buildTable, createColumnTestSpec, createForeignKeyTestSpec_Database } from '../utils/buildSchema.js';
import { SQL_DECIMAL } from '../../src/types/SqlType.js';

describe('Database::updateRow', () => {

  it('allows updating a child row to another valid parent reference', () => {
    let roles = buildTable({name: "Roles"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createIndex({
        name: "PK_Roles",
        columns: ["id"],
        unique: true,
      });

    roles = roles.addRows([[1],[2]]);

    let users = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "roleId",
        type: SQL_DECIMAL,
      }));

    users = users.addRows([[1]]);

    const db = buildDatabase()
      .addTable(roles)
      .addTable(users)
      .createForeignKey("users", createForeignKeyTestSpec_Database({
        name: "FK_Users_Roles",
        columns: ["roleId"],
        reverseIndex: "FKRI_Users",
        parentTable: "Roles",
        parentColumns: ["id"],
        onDelete: "restrict",
        onUpdate: "restrict",
      }));

    const updates = [2];

    const updated = db.updateRows(
      "Users",
      [0],
      [updates]
    );

    expect(
      updated
        .tables.requireByName("Users")
        .requireRow(0)
    ).toEqual([2]);
  });

  it('rejects updating a child row to an invalid foreign key reference', () => {
    let roles = buildTable({name: "Roles"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createIndex({
        name: "PK_Roles",
        columns: ["id"],
        unique: true,
      });

    roles = roles.addRows([[1]]);

    let users = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "roleId",
        type: SQL_DECIMAL,
      }));

    users = users.addRows([[1]]);

    const db = buildDatabase()
      .addTable(roles)
      .addTable(users)
      .createForeignKey("users", createForeignKeyTestSpec_Database({
        name: "FK_Users_Roles",
        columns: ["roleId"],
        reverseIndex: "FKRI_Users",
        parentTable: "Roles",
        parentColumns: ["id"],
        onDelete: "restrict",
        onUpdate: "restrict",
      }));

    const updates = [999];

    expect(() =>
      db.updateRows(
        "Users", [0], [updates]
      )
    ).toThrow();
  });

  it('rejects updating a parent row that would orphan child rows', () => {
    let roles = buildTable({name: "Roles"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createIndex({
        name: "PK_Roles",
        columns: ["id"],
        unique: true,
      });

    roles = roles.addRows([[1]]);

    let users = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "roleId",
        type: SQL_DECIMAL,
      }));

    users = users.addRows([[1]]);

    const db = buildDatabase()
      .addTable(roles)
      .addTable(users)
      .createForeignKey("users", createForeignKeyTestSpec_Database({
        name: "FK_Users_Roles",
        columns: ["roleId"],
        reverseIndex: "FKRI_Users",
        parentTable: "Roles",
        parentColumns: ["id"],
        onDelete: "restrict",
        onUpdate: "restrict",
      }));

    const updates = [2];

    expect(() =>
      db.updateRows(
        "Roles", [0], [updates]
      )
    ).toThrow();
  });

  it('allows updating a parent row when no child rows reference it', () => {
    let roles = buildTable({name: "Roles"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createIndex({
        name: "PK_Roles",
        columns: ["id"],
        unique: true,
      });

    roles = roles.addRows([[1]]);

    const users = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "roleId",
        type: SQL_DECIMAL,
      }));

    const db = buildDatabase()
      .addTable(roles)
      .addTable(users)
      .createForeignKey("users", createForeignKeyTestSpec_Database({
        name: "FK_Users_Roles",
        columns: ["roleId"],
        reverseIndex: "FKRI_Users",
        parentTable: "Roles",
        parentColumns: ["id"],
        onDelete: "restrict",
        onUpdate: "restrict",
      }));

    const updates = [2];

    const updated = db.updateRows(
      "Roles", [0], [updates]
    );

    expect(
      updated
        .tables.requireByName("Roles")
        .requireRow(0)
    ).toEqual([2]);
  });

  it('allows self-referencing foreign key updates that remain valid', () => {
    let employees = buildTable({name: "Employees"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createColumn(createColumnTestSpec({
        name: "managerId",
        type: SQL_DECIMAL,
      }))
      .createIndex({
        name: "PK_Employees",
        columns: ["id"],
        unique: true,
      });

    employees = employees.addRows([[1, null],[2, 1]]);

    const db = buildDatabase()
      .addTable(employees)
      .createForeignKey("employees", createForeignKeyTestSpec_Database({
        name: "FK_Manager",
        columns: ["managerId"],
        reverseIndex: "FKRI_Employees",
        parentTable: "Employees",
        parentColumns: ["id"],
        onDelete: "restrict",
        onUpdate: "restrict",
      }));

    const updates = [2, 2];

    const updated = db.updateRows(
      "Employees", [1], [updates]
    );

    expect(
      updated
        .tables.requireByName("Employees")
        .requireRow(1)
    ).toEqual([2, 2]);
  });

  it('rejects self-referencing foreign key updates that become invalid', () => {
    let employees = buildTable({name: "Employees"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createColumn(createColumnTestSpec({
        name: "managerId",
        type: SQL_DECIMAL,
      }))
      .createIndex({
        name: "PK_Employees",
        columns: ["id"],
        unique: true,
      });

    employees = employees.addRows([[1, null]]);

    const db = buildDatabase()
      .addTable(employees)
      .createForeignKey("employees", createForeignKeyTestSpec_Database({
        name: "FK_Manager",
        columns: ["managerId"],
        parentTable: "Employees",
        parentColumns: ["id"],
        reverseIndex: "FKR_Employees",
        onDelete: "restrict",
        onUpdate: "restrict",
      }));
      
    const updates = [2, 999];

    expect(() =>
      db.updateRows(
        "Employees", [0], [updates]
      )
    ).toThrow();
  });

  it("updates multiple rows in a single operation", () => {
    let users = buildTable({ name: "Users" })
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createIndex({
        name: "PK_Users",
        columns: ["id"],
        unique: true,
      });

    users = users.addRows([[1],[2],[3]]);

    const db = buildDatabase()
      .addTable(users);

    const updated = db.updateRows(
      "Users", [0, 2], [[10], [30]]
    );

    const updatedUsers =
      updated.tables.requireByName("Users");

    expect(updatedUsers.requireRow(0)).toEqual([10]);
    expect(updatedUsers.requireRow(1)).toEqual([2]);
    expect(updatedUsers.requireRow(2)).toEqual([30]);
  });

  it("cascades multiple parent updates in a single operation", () => {
    let roles = buildTable({ name: "Roles" })
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createIndex({
        name: "PK_Roles",
        columns: ["id"],
        unique: true,
      });

    roles = roles.addRows([[1],[2]]);

    let users = buildTable({ name: "Users" })
      .createColumn(createColumnTestSpec({
        name: "roleId",
        type: SQL_DECIMAL,
      }));

    users = users.addRows([[1],[2]]);

    const db = buildDatabase()
      .addTable(roles)
      .addTable(users)
      .createForeignKey(
        "Users",
        createForeignKeyTestSpec_Database({
          name: "FK_Users_Roles",
          columns: ["roleId"],
          reverseIndex: "FKRI_Users",
          parentTable: "Roles",
          parentColumns: ["id"],
          onDelete: "restrict",
          onUpdate: "cascade",
        }),
      );

    const updated = db.updateRows(
      "Roles", [0, 1], [[10], [20]]
    );

    const updatedRoles =
      updated.tables.requireByName("Roles");

    const updatedUsers =
      updated.tables.requireByName("Users");

    expect(updatedRoles.requireRow(0))
      .toEqual([10]);

    expect(updatedRoles.requireRow(1))
      .toEqual([20]);

    expect(updatedUsers.requireRow(0))
      .toEqual([10]);

    expect(updatedUsers.requireRow(1))
      .toEqual([20]);
  });
});