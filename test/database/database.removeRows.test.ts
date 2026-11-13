import { describe, it, expect } from 'vitest';
import {
  buildDatabase,
  buildTable,
  createColumnTestSpec,
  createDelete,
  createForeignKeyTestSpec_Database
} from '../utils/buildSchema.js';
import { SQL_DECIMAL, SQL_VARCHAR } from '../../src/types/SqlType.js';

describe('Database::removeRow', () => {

  it('removes an unreferenced row', () => {
    let users = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }));

    users = users.addRows([[1]]);

    const db = buildDatabase()
      .addTable(users);

    const updated = db.removeRows(
      "Users",
      [createDelete(users, 0)]
    );

    expect(
      updated
        .tables.requireByName("Users")
        .getRow(0)
    ).toBeUndefined();
  });

  it('rejects deleting a parent row referenced by a child row', () => {
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
        reverseIndex: "FKRI_Roles",
        parentTable: "Roles",
        parentColumns: ["id"],
        onDelete: "restrict",
        onUpdate: "restrict",
      }));

    expect(() =>
      db.removeRows(
        "Roles",
        [createDelete(roles, 0)]
      )
    ).toThrow();
  });

  it('allows deleting a parent row once referencing child rows are deleted', () => {
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

    let db = buildDatabase()
      .addTable(roles)
      .addTable(users)
      .createForeignKey("users", createForeignKeyTestSpec_Database({
        name: "FK_Users_Roles",
        columns: ["roleId"],
        reverseIndex: "FKRI_Roles",
        parentTable: "Roles",
        parentColumns: ["id"],
        onDelete: "restrict",
        onUpdate: "restrict",
      }));

    db = db.removeRows(
      "Users",
      [createDelete(users, 0)]
    );

    const updated = db.removeRows(
      "Roles",
      [createDelete(roles, 0)]
    );

    expect(
      updated
        .tables.requireByName("Roles")
        .getRow(0)
    ).toBeUndefined();
  });

  it('ignores deleted child rows during FK delete checks', () => {
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

    users = users.removeRows(
      [createDelete(users, 0)]
    );

    const db = buildDatabase()
      .addTable(roles)
      .addTable(users)
      .createForeignKey("users", createForeignKeyTestSpec_Database({
        name: "FK_Users_Roles",
        columns: ["roleId"],
        reverseIndex: "FKRI_Roles",
        parentTable: "Roles",
        parentColumns: ["id"],
        onDelete: "restrict",
        onUpdate: "restrict",
      }));

    expect(() =>
      db.removeRows(
        "Roles",
        [createDelete(roles, 0)]
      )
    ).not.toThrow();
  });

  it('rejects deleting invalid row numbers', () => {
    const users = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }));

    const db = buildDatabase()
      .addTable(users);

    expect(() =>
      db.removeRows(
        "Users",
        [createDelete(users, 999)]
      )
    ).toThrow();
  });

  it('rejects deleting already deleted rows', () => {
    let users = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }));

    users = users.addRows([[1]]);

    let db = buildDatabase()
      .addTable(users);

    db = db.removeRows(
      "Users",
      [createDelete(users, 0)]
    );

    const updatedUsers = db.tables.require(users.id);

    expect(() =>
      db.removeRows(
        "Users",
        [createDelete(updatedUsers, 0)]
      )
    ).toThrow();
  });

  it('preserves immutable database state during deletion', () => {
    let users = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }));

    users = users.addRows([[1]]);

    const db = buildDatabase()
      .addTable(users);

    const updated = db.removeRows(
      "Users",
      [createDelete(users, 0)]
    );

    expect(
      db
        .tables.requireByName("Users")
        .requireRow(0)
    ).toEqual([1]);

    expect(
      updated
        .tables.requireByName("Users")
        .getRow(0)
    ).toBeUndefined();

    expect(updated).not.toBe(db);
    expect(
      updated.tables.requireByName("Users")
    ).not.toBe(
      db.tables.requireByName("Users")
    );
  });

  it('preserves unrelated tables during deletion', () => {
    let users = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }));

    users = users.addRows([[1]]);

    let roles = buildTable({name: "Roles"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }));

    roles = roles.addRows([[10]]);

    const db = buildDatabase()
      .addTable(users)
      .addTable(roles);

    const updated = db.removeRows(
      "Users",
      [createDelete(users, 0)]
    );

    expect(
      updated
        .tables.requireByName("Roles")
        .requireRow(0)
    ).toEqual([10]);
  });

  it("removes multiple rows", () => {
    let users = buildTable({ name: "Users" })
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createColumn(createColumnTestSpec({
        name: "name",
        type: SQL_VARCHAR,
      }));

    users = users.addRows([[1, "Alice"]]);
    users = users.addRows([[2, "Bob"]]);
    users = users.addRows([[3, "Charlie"]]);

    const db = buildDatabase()
      .addTable(users);

    const updated = db.removeRows(
      "Users",
      [
        createDelete(users, 0),
        createDelete(users, 2),
      ],
    );

    const updatedUsers =
      updated.tables.requireByName("Users");

    expect([...updatedUsers.iterateAliveRows()])
      .toHaveLength(1);

    expect(updatedUsers.requireRow(1))
      .toEqual([2, "Bob"]);
  });

  it("cascades multiple parent deletes in a single operation", () => {
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

    roles = roles.addRows([[1]]);
    roles = roles.addRows([[2]]);

    let users = buildTable({ name: "Users" })
      .createColumn(createColumnTestSpec({
        name: "roleId",
        type: SQL_DECIMAL,
      }));

    users = users.addRows([[1]]);
    users = users.addRows([[2]]);

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
          onDelete: "cascade",
          onUpdate: "restrict",
        }),
      );

    const updated = db.removeRows(
      "Roles",
      [
        createDelete(roles, 0),
        createDelete(roles, 1),
      ],
    );

    const updatedRoles =
      updated.tables.requireByName("Roles");

    const updatedUsers =
      updated.tables.requireByName("Users");

    expect([...updatedRoles.iterateAliveRows()])
      .toHaveLength(0);

    expect([...updatedUsers.iterateAliveRows()])
      .toHaveLength(0);
  });
});