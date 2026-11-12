import { describe, it, expect } from 'vitest';
import { 
  buildDatabase,
  buildTable,
  createColumnTestSpec,
  createForeignKeyTestSpec_Database,
  createIndexTestSpec
} from '../utils/buildSchema.js';
import { SQL_DECIMAL, SQL_VARCHAR } from '../../src/types/SqlType.js';

describe('Database::removeIndex', () => {
  it('removes an index from a table', () => {
    const db = buildDatabase()
      .addTable(
        buildTable({columns: ["c1"]})
          .createIndex(createIndexTestSpec({
            name: "i1",
            columns: ["c1"],
          })));

    const updated = db.removeIndex(
      "t1",
      "i1",
    );

    expect(
      updated
        .tables.requireByName("t1")
        .indexes.getByName("i1")
    ).toBeUndefined();
  });

  it('does not mutate original database state', () => {
    const db = buildDatabase()
      .addTable(
        buildTable({columns: ["c1"]})
          .createIndex(createIndexTestSpec({name: "i1", columns: ["c1"]}))
      );

    const updated = db.removeIndex(
      "t1",
      "i1",
    );

    expect(
      db
        .tables.requireByName("t1")
        .indexes.requireByName("i1")
    ).toBeDefined();

    expect(
      updated
        .tables.requireByName("t1")
        .indexes.getByName("i1")
    ).toBeUndefined();

    expect(updated).not.toBe(db);

    expect(
      updated.tables.requireByName("t1")
    ).not.toBe(
      db.tables.requireByName("t1")
    );
  });

  it('preserves unrelated tables during index removal', () => {

    const users = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "email",
        type: SQL_VARCHAR,
      }))
      .createIndex(createIndexTestSpec({
        name: "IDX_Email",
        columns: ["email"],
      }));

    const roles = buildTable({name: "Roles"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }));

    const db = buildDatabase()
      .addTable(users)
      .addTable(roles);

    const updated = db.removeIndex(
      "Users",
      "IDX_Email",
    );

    expect(
      updated
        .tables.requireByName("Roles")
    ).toBe(
      db.tables.requireByName("Roles")
    );
  });

  it('throws when removing a non-existent index', () => {
    const table = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "email",
        type: SQL_VARCHAR,
      }));

    const db = buildDatabase()
      .addTable(table);

    expect(() =>
      db.removeIndex(
        "Users",
        "IDX_Missing",
      )
    ).toThrow();
  });

  it('rejects removing an index referenced by a foreign key', () => {
    const parent = buildTable({name: "Roles"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createIndex(createIndexTestSpec({
        name: "PK_Roles",
        columns: ["id"],
        unique: true,
      }));

    const child = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "roleId",
        type: SQL_DECIMAL,
      }));

    const db = buildDatabase()
      .addTable(parent)
      .addTable(child)
      .createForeignKey("users", createForeignKeyTestSpec_Database({
        name: "FK_Users_Roles",
        columns: ["roleId"],
        reverseIndex: "FKR_Id",
        parentTable: "Roles",
        parentColumns: ["id"],
        onDelete: "restrict",
        onUpdate: "restrict",
      }));

    expect(() =>
      db.removeIndex(
        "Roles",
        "PK_Roles",
      )
    ).toThrow();
  });

  it('allows removing an index not referenced by a foreign key', () => {
    const parent = buildTable({name: "Roles"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createIndex(createIndexTestSpec({
        name: "PK_Roles",
        columns: ["id"],
        unique: true,
      }))
      .createIndex(createIndexTestSpec({
        name: "IDX_Extra",
        columns: ["id"],
      }));

    const child = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "roleId",
        type: SQL_DECIMAL,
      }));

    const db = buildDatabase()
      .addTable(parent)
      .addTable(child)
      .createForeignKey("users", createForeignKeyTestSpec_Database({
        name: "FK_Users_Roles",
        columns: ["roleId"],
        reverseIndex: "FKR_Id",
        parentTable: "Roles",
        parentColumns: ["id"],
        onDelete: "restrict",
        onUpdate: "restrict",
      }));

    const updated = db.removeIndex(
      "Roles",
      "IDX_Extra",
    );

    expect(
      updated
        .tables.requireByName("Roles")
        .indexes.getByName("IDX_Extra")
    ).toBeUndefined();

    expect(
      updated
        .tables.requireByName("Roles")
        .indexes.requireByName("PK_Roles")
    ).toBeDefined();
  });

  it('rejects removing indexes required by self-referencing foreign keys', () => {
    const employees = buildTable({name: "Employees"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createColumn(createColumnTestSpec({
        name: "managerId",
        type: SQL_DECIMAL,
      }))
      .createIndex(createIndexTestSpec({
        name: "PK_Employees",
        columns: ["id"],
        unique: true,
      }));

    const db = buildDatabase()
      .addTable(employees)
      .createForeignKey("employees", createForeignKeyTestSpec_Database({
        name: "FK_Manager",
        columns: ["managerId"],
        reverseIndex: "FKR_Employees",
        parentTable: "Employees",
        parentColumns: ["id"],
        onDelete: "restrict",
        onUpdate: "restrict",
      }));

    expect(() =>
      db.removeIndex(
        "Employees",
        "PK_Employees",
      )
    ).toThrow();
  });

  it('preserves existing rows after index removal', () => {
    let table = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "email",
        type: SQL_VARCHAR,
      }))
      .createIndex(createIndexTestSpec({
        name: "IDX_Email",
        columns: ["email"],
      }));

    table = table.addRows([["a@test.com"]]);

    const db = buildDatabase()
      .addTable(table);

    const updated = db.removeIndex(
      "Users",
      "IDX_Email",
    );

    expect(
      updated
        .tables.requireByName("Users")
        .requireRow(0)
    ).toEqual(["a@test.com"]);
  });

  it('preserves remaining indexes after index removal', () => {
    const table = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "email",
        type: SQL_VARCHAR,
      }))
      .createIndex(createIndexTestSpec({
        name: "IDX_Email",
        columns: ["email"],
      }))
      .createIndex(createIndexTestSpec({
        name: "IDX_Email_2",
        columns: ["email"],
      }));

    const db = buildDatabase()
      .addTable(table);

    const updated = db.removeIndex(
      "Users",
      "IDX_Email",
    );

    expect(
      updated
        .tables.requireByName("Users")
        .indexes.getByName("IDX_Email")
    ).toBeUndefined();

    expect(
      updated
        .tables.requireByName("Users")
        .indexes.requireByName("IDX_Email_2")
    ).toBeDefined();
  });

  it('creates an internal reverse index for a foreign key', () => {
    const parent = buildTable({name: "Roles"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createIndex(createIndexTestSpec({
        name: "PK_Roles",
        columns: ["id"],
        unique: true,
      }));

    const child = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "roleId",
        type: SQL_DECIMAL,
      }));

    const db = buildDatabase()
      .addTable(parent)
      .addTable(child)
      .createForeignKey("Users", createForeignKeyTestSpec_Database({
        name: "FK_Users_Roles",
        columns: ["roleId"],
        reverseIndex: "FKR_RoleId",
        parentTable: "Roles",
        parentColumns: ["id"],
      }));

    const updatedChild = db.tables.requireByName("Users");

    expect(
      updatedChild.indexes.requireByName("FKR_RoleId").internal
    ).toBe(true);
  });

  it('preserves a parent index while multiple foreign keys reference it', () => {
    const parent = buildTable({name: "Roles"})
      .createColumn(createColumnTestSpec({
        name: "id",
        type: SQL_DECIMAL,
      }))
      .createIndex(createIndexTestSpec({
        name: "PK_Roles",
        columns: ["id"],
        unique: true,
      }));

    const users = buildTable({name: "Users"})
      .createColumn(createColumnTestSpec({
        name: "roleId",
        type: SQL_DECIMAL,
      }));

    const admins = buildTable({name: "Admins"})
      .createColumn(createColumnTestSpec({
        name: "roleId",
        type: SQL_DECIMAL,
      }));

    const db = buildDatabase()
      .addTable(parent)
      .addTable(users)
      .addTable(admins)
      .createForeignKey("Users", createForeignKeyTestSpec_Database({
        name: "FK_Users_Roles",
        columns: ["roleId"],
        reverseIndex: "FKR_Users",
        parentTable: "Roles",
        parentColumns: ["id"],
      }))
      .createForeignKey("Admins", createForeignKeyTestSpec_Database({
        name: "FK_Admins_Roles",
        columns: ["roleId"],
        reverseIndex: "FKR_Admins",
        parentTable: "Roles",
        parentColumns: ["id"],
      }));

    expect(() =>
      db.removeIndex("Roles", "PK_Roles")
    ).toThrow();
  });
});