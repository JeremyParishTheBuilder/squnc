import { describe, it, expect } from 'vitest';
import { createTestMySqlSql, createTestPostgresSql, freshEngine } from '../utils/engineHelpers.ts';
import { SQL_BOOLEAN, SQL_DECIMAL, SQL_INTEGER, SQL_VARCHAR } from '../../src/types/SqlType.ts';
import { col } from '../../src/ast/dsl.ts';
import { createTableTestSpec } from '../utils/buildSchema.ts';
import { EngineRegistry } from '../../src/engine/EngineRegistry.ts';
import { Unique } from '../../src/relational/Unique.ts';

describe("Integration::alter", () => {
  const getIndexColumnNames = (tableName: string, indexName: string) => {
    const table = EngineRegistry.getInstance()
      .engine()
      .databases.getByName("DB1")
      ?.tables.getByName(tableName);

    const index = table?.indexes.getByName(indexName);

    return index?.columns.map((columnId) => (
      table?.columns.require(columnId).name
    ));
  };

  const getIndex = (tableName: string, indexName: string) => {
    const table = EngineRegistry.getInstance()
      .engine()
      .databases.getByName("DB1")
      ?.tables.getByName(tableName);

    return table?.indexes.getByName(indexName);
  };

  describe("ADD COLUMN", () => {
    it("adds multiple columns in a single ALTER TABLE ADD", () => {
      const engine = freshEngine();
      const sql = createTestPostgresSql(engine);

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        {
          name: "Id",
          type: SQL_INTEGER,
          nullable: false,
        },
      ]).execute();

      sql.alterTable("Users").add([
        {
          name: "Age",
          type: SQL_INTEGER,
          nullable: true,
        },
        {
          name: "Name",
          type: SQL_VARCHAR,
          nullable: true,
        },
      ]).execute();

      const result = sql.select("*").from("Users").fetch();

      expect(result.rows).toEqual([]);
    });

    it("rejects duplicate column names in a single ADD operation", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(...createTableTestSpec("Users", {
        Id: {
          type: SQL_INTEGER,
          nullable: false,
        },
      })).execute();

      expect(() => {
        sql.alterTable("Users").add([
          {
            name: "Age",
            type: SQL_INTEGER,
            nullable: true,
          },
          {
            name: "age",
            type: SQL_INTEGER,
            nullable: true,
          },
        ]).execute();
      }).toThrow(/age already in working table schema/i);
    });

    it("rejects adding a column whose name already exists", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(...createTableTestSpec("Users", {
        Id: {
          type: SQL_INTEGER,
          nullable: false,
        },
        Name: {
          type: SQL_VARCHAR,
          nullable: true,
        },
      })).execute();

      expect(() => {
        sql.alterTable("Users").add([
          {
            name: "name",
            type: SQL_VARCHAR,
            nullable: true,
          },
        ]).execute();
      }).toThrow(/name already/i);
    });
  });

  describe("DROP COLUMN", () => {
    it("drops a column while preserving remaining column data", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        {
          name: "Id",
          type: SQL_INTEGER,
          nullable: false,
        },
        {
          name: "Name",
          type: SQL_VARCHAR,
          nullable: false,
        },
      ]).execute();

      sql.insertInto("Users", ["Id", "Name"]).values([
        [1, "Alice"],
        [2, "Bob"],
      ]).execute();

      sql.alterTable("Users").dropColumn(["Name"]).execute();

      const result = sql.select("*").from("Users").fetch();

      expect(result.columns.map((column) => column.name)).toEqual(["Id"]);
      expect(result.rows.map((row) => row.values)).toEqual([[1], [2]]);
    });

    it("rejects references to a dropped column", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        {
          name: "Id",
          type: SQL_INTEGER,
          nullable: false,
        },
        {
          name: "Name",
          type: SQL_VARCHAR,
          nullable: false,
        },
      ]).execute();

      sql.alterTable("Users").dropColumn(["Name"]).execute();

      expect(() =>
        sql.select([col("Name")]).from("Users").fetch(),
      ).toThrow(/column|binding/i);
    });

    it("rejects duplicate column names in a single DROP operation", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(...createTableTestSpec("Users", {
        Id: {
          type: SQL_INTEGER,
          nullable: false,
        },
        Name: {
          type: SQL_VARCHAR,
          nullable: true,
        },
      })).execute();

      expect(() => {
        sql.alterTable("Users")
          .dropColumn(["Name", "name"])
          .execute();
      }).toThrow(/name not found/i);
    });
  });

  describe("RENAME COLUMN", () => {
    it("renames a column while preserving its data", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        {
          name: "Id",
          type: SQL_INTEGER,
          nullable: false,
        },
        {
          name: "Name",
          type: SQL_VARCHAR,
          nullable: false,
        },
      ]).execute();

      sql.insertInto("Users", ["Id", "Name"]).values([
        [1, "Alice"],
        [2, "Bob"],
      ]).execute();

      sql.alterTable("Users")
        .renameColumn("Name").to("DisplayName")
        .execute();

      const result = sql.select("*").from("Users").fetch();

      expect(result.columns.map((column) => column.name)).toEqual([
        "Id",
        "DisplayName",
      ]);
      expect(result.rows.map((row) => row.values)).toEqual([
        [1, "Alice"],
        [2, "Bob"],
      ]);
    });

    it("rejects references to the old column name", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        {
          name: "Id",
          type: SQL_INTEGER,
          nullable: false,
        },
        {
          name: "Name",
          type: SQL_VARCHAR,
          nullable: false,
        },
      ]).execute();

      sql.alterTable("Users")
        .renameColumn("Name").to("DisplayName")
        .execute();

      expect(() =>
        sql.select([col("Name")]).from("Users").fetch(),
      ).toThrow(/column|binding/i);
    });

    it("rejects renaming a column to an existing column name", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(...createTableTestSpec("Users", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
          primaryKey: true,
        },
        Name: {
          type: SQL_VARCHAR,
          nullable: true,
        },
        DisplayName: {
          type: SQL_VARCHAR,
          nullable: true,
        },
      })).execute();

      expect(() => {
        sql.alterTable("Users")
          .renameColumn("Name").to("displayname")
          .execute();
      }).toThrow(/already taken/i);
    });

    it("renames multiple columns in a single statement", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: {
            type: SQL_DECIMAL,
            nullable: false,
            primaryKey: true,
          },
          Name: {
            type: SQL_VARCHAR,
            nullable: false,
          },
          Age: {
            type: SQL_DECIMAL,
            nullable: false,
          },
        }),
      ).execute();

      sql.alterTable("Users")
        .renameColumn("Name").to("DisplayName")
        .renameColumn("Age").to("Years")
        .execute();

      // Verify both renamed columns can subsequently be resolved.
      expect(() => {
        sql.alterTable("Users")
          .renameColumn("DisplayName").to("FullName")
          .execute();
      }).not.toThrow();

      expect(() => {
        sql.alterTable("Users")
          .renameColumn("Years").to("AgeInYears")
          .execute();
      }).not.toThrow();
    });

    it("rejects more than the permitted number of column renames", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: {
            type: SQL_DECIMAL,
            nullable: false,
            primaryKey: true,
          },
          Name: {
            type: SQL_VARCHAR,
            nullable: false,
          },
          Age: {
            type: SQL_DECIMAL,
            nullable: false,
          },
        }),
      ).execute();

      expect(() => {
        sql.alterTable("Users")
          .renameColumn("Name").to("DisplayName")
          .renameColumn("Age").to("Years")
          .execute();
      }).toThrow();

      // The rejected statement must not have partially applied.
      expect(() => {
        sql.alterTable("Users")
          .renameColumn("Name").to("DisplayName")
          .execute();
      }).not.toThrow();
    });

    it("supports swapping two column names in a single statement", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: {
            type: SQL_DECIMAL,
            nullable: false,
            primaryKey: true,
          },
          FirstName: {
            type: SQL_VARCHAR,
            nullable: false,
          },
          LastName: {
            type: SQL_VARCHAR,
            nullable: false,
          },
        }),
      ).execute();

      sql.insertInto("Users", ["Id", "FirstName", "LastName"])
        .values([[1, "Alice", "Smith"]])
        .execute();

      sql.alterTable("Users")
        .renameColumn("FirstName").to("LastName")
        .renameColumn("LastName").to("FirstName")
        .execute();

      const result = sql.select("*").from("Users").fetch();

      expect(result.rows).toEqual([{
        index: 0,
        values: [
          1,
          "Alice",
          "Smith",
        ]
      }]);

      expect(result.columns.map(qc => qc.name)).toEqual([
        "Id", "LastName", "FirstName",
      ]);
    });

    it("supports cycling three column names in a single statement", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: {
            type: SQL_DECIMAL,
            nullable: false,
            primaryKey: true,
          },
          FirstName: {
            type: SQL_VARCHAR,
            nullable: false,
          },
          MiddleName: {
            type: SQL_VARCHAR,
            nullable: false,
          },
          LastName: {
            type: SQL_VARCHAR,
            nullable: false,
          },
        }),
      ).execute();

      sql.insertInto("Users", [
        "Id",
        "FirstName",
        "MiddleName",
        "LastName",
      ]).values([[1, "Alice", "Marie", "Smith"]]).execute();

      sql.alterTable("Users")
        .renameColumn("FirstName").to("MiddleName")
        .renameColumn("MiddleName").to("LastName")
        .renameColumn("LastName").to("FirstName")
        .execute();

      const result = sql.select("*").from("Users").fetch();

      expect(result.rows).toEqual([{
        index: 0,
        values: [
          1,
          "Alice",
          "Marie",
          "Smith",
        ]
      }]);

      expect(result.columns.map(qc => qc.name)).toEqual([
        "Id", "MiddleName", "LastName", "FirstName",
      ]);
    });
  });

  describe("ALTER COLUMN", () => {
    it("changes a column's type", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Age: { type: SQL_INTEGER, nullable: true },
        }),
      ).execute();

      sql.insertInto("Users", ["Id", "Age"]).values([
        [1, 25],
      ]).execute();

      sql.alterTable("Users")
        .alterColumn("Age")
        .setDataType(SQL_DECIMAL)
        .execute();

      const result = sql.select("*").from("Users").fetch();

      expect(result.columns.find((column) => column.name === "Age")?.type)
        .toBe(SQL_DECIMAL);

      expect(result.rows.map((row) => row.values)).toEqual([
        [1, 25],
      ]);
    });

    it("sets and drops column NOT NULL", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Age: { type: SQL_INTEGER, nullable: true },
        }),
      ).execute();

      sql.insertInto("Users", ["Id", "Age"]).values([
        [1, 25],
      ]).execute();

      sql.alterTable("Users")
        .alterColumn("Age")
        .setNotNull()
        .execute();

      let result = sql.select("*").from("Users").fetch();

      expect(result.columns.find((column) => column.name === "Age")?.nullable)
        .toBe(false);

      sql.alterTable("Users")
        .alterColumn("Age")
        .dropNotNull()
        .execute();

      result = sql.select("*").from("Users").fetch();

      expect(result.columns.find((column) => column.name === "Age")?.nullable)
        .toBe(true);
    });

    it("rejects setting NOT NULL when existing rows contain NULL", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Age: { type: SQL_INTEGER, nullable: true },
        }),
      ).execute();

      sql.insertInto("Users", ["Id", "Age"]).values([
        [1, null],
        [2, 25],
      ]).execute();

      expect(() =>
        sql.alterTable("Users")
          .alterColumn("Age")
          .setNotNull()
          .execute(),
      ).toThrow();

      const result = sql.select("*").from("Users").fetch();

      expect(result.columns.find((column) => column.name === "Age")?.nullable)
        .toBe(true);

      expect(result.rows.map((row) => row.values)).toEqual([
        [1, null],
        [2, 25],
      ]);
    });

    it("applies multiple ALTER COLUMN operations sequentially", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Age: { type: SQL_INTEGER, nullable: true },
        }),
      ).execute();

      sql.insertInto("Users", ["Id", "Age"]).values([
        [1, 25],
      ]).execute();

      sql.alterTable("Users")
        .alterColumn("Age")
          .setDataType(SQL_DECIMAL)
        .alterColumn("Age")
          .setNotNull()
        .execute();

      const result = sql.select("*").from("Users").fetch();

      const ageColumn = result.columns.find(
        (column) => column.name === "Age",
      );

      expect(ageColumn?.type).toBe(SQL_DECIMAL);
      expect(ageColumn?.nullable).toBe(false);

      expect(result.rows.map((row) => row.values)).toEqual([
        [1, 25],
      ]);
    });

    it("sets a column default used by subsequent inserts", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Age: { type: SQL_INTEGER, nullable: true },
        }),
      ).execute();

      sql.alterTable("Users")
        .alterColumn("Age")
        .setDefault(0)
        .execute();

      sql.insertInto("Users", ["Id"]).values([
        [1],
      ]).execute();

      const result = sql.select("*").from("Users").fetch();

      expect(result.rows.map((row) => row.values)).toEqual([
        [1, 0],
      ]);
    });

    it("drops a column default", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Age: { type: SQL_INTEGER, nullable: true },
        }),
      ).execute();

      sql.alterTable("Users")
        .alterColumn("Age")
        .setDefault(25)
        .execute();

      sql.insertInto("Users", ["Id"]).values([
        [1],
      ]).execute();

      sql.alterTable("Users")
        .alterColumn("Age")
        .dropDefault()
        .execute();

      sql.insertInto("Users", ["Id"]).values([
        [2],
      ]).execute();

      const result = sql.select("*").from("Users").fetch();

      expect(result.rows.map((row) => row.values)).toEqual([
        [1, 25],
        [2, null],
      ]);
    });

    it("accepts falsy column defaults", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Values", {
          Id: { type: SQL_INTEGER, nullable: false },
          NumberValue: { type: SQL_INTEGER, nullable: true },
          BooleanValue: { type: SQL_BOOLEAN, nullable: true },
          TextValue: { type: SQL_VARCHAR, nullable: true },
        }),
      ).execute();

      sql.alterTable("Values")
        .alterColumn("NumberValue").setDefault(0)
        .alterColumn("BooleanValue").setDefault(false)
        .alterColumn("TextValue").setDefault("")
        .execute();

      sql.insertInto("Values", ["Id"]).values([
        [1],
      ]).execute();

      const result = sql.select("*").from("Values").fetch();

      expect(result.rows.map((row) => row.values)).toEqual([
        [1, 0, false, ""],
      ]);
    });

    it("rejects a default incompatible with the column type", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Age: { type: SQL_INTEGER, nullable: true },
        }),
      ).execute();

      expect(() =>
        sql.alterTable("Users")
          .alterColumn("Age")
          .setDefault("invalid")
          .execute(),
      ).toThrow();

      sql.insertInto("Users", ["Id"]).values([
        [1],
      ]).execute();

      const result = sql.select("*").from("Users").fetch();

      expect(result.rows.map((row) => row.values)).toEqual([
        [1, null],
      ]);
    });

    it("does not partially apply ALTER COLUMN operations when a later operation fails", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Age: { type: SQL_INTEGER, nullable: true },
        }),
      ).execute();

      sql.insertInto("Users", ["Id", "Age"]).values([
        [1, 25],
      ]).execute();

      expect(() =>
        sql.alterTable("Users")
          .alterColumn("Age")
          .setDataType(SQL_DECIMAL)
          .alterColumn("Missing")
          .setNotNull()
          .execute(),
      ).toThrow();

      const result = sql.select("*").from("Users").fetch();

      const ageColumn = result.columns.find(
        (column) => column.name === "Age",
      );

      expect(ageColumn?.type).toBe(SQL_INTEGER);
      expect(ageColumn?.nullable).toBe(true);

      expect(result.rows.map((row) => row.values)).toEqual([
        [1, 25],
      ]);
    });
  });

  describe("Multiple operations", () => {
    it("adds and alters a column in the same statement", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addColumn({name: "Age", type: SQL_INTEGER})
        .alterColumn("Age")
          .setNotNull()
        .alterColumn("Age")
          .setDefault(0)
        .execute();

      const result = sql.select("*").from("Users").fetch();

      const ageColumn = result.columns.find(
        (column) => column.name === "Age",
      );

      expect(ageColumn?.type).toBe(SQL_INTEGER);
      expect(ageColumn?.nullable).toBe(false);

      sql.insertInto("Users", ["Id"]).values([
        [1],
      ]).execute();

      expect(
        sql.select("*").from("Users").fetch().rows.map((row) => row.values),
      ).toEqual([[1, 0]]);
    });

    it("adds, renames, and alters a planned column", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addColumn({name: "Age", type: SQL_INTEGER})
        .renameColumn("Age").to("UserAge")
        .alterColumn("UserAge")
        .setNotNull()
        .alterColumn("UserAge")
        .setDefault(0)
        .execute();

      const result = sql.select("*").from("Users").fetch();

      expect(result.columns.map((column) => column.name)).toEqual([
        "Id",
        "UserAge",
      ]);

      expect(
        result.columns.find((column) => column.name === "UserAge")?.nullable,
      ).toBe(false);

      sql.insertInto("Users", ["Id"]).values([
        [1],
      ]).execute();

      expect(
        sql.select("*").from("Users").fetch().rows.map((row) => row.values),
      ).toEqual([[1, 0]]);
    });

    it("alters an existing column using its renamed name", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Age: { type: SQL_INTEGER, nullable: true },
        }),
      ).execute();

      sql.insertInto("Users", ["Id", "Age"]).values([
        [1, 25],
      ]).execute();

      sql.alterTable("Users")
        .renameColumn("Age").to("UserAge")
        .alterColumn("UserAge")
        .setDataType(SQL_DECIMAL)
        .alterColumn("UserAge")
        .setNotNull()
        .execute();

      const result = sql.select("*").from("Users").fetch();

      expect(result.columns.map((column) => column.name)).toEqual([
        "Id",
        "UserAge",
      ]);

      const ageColumn = result.columns.find(
        (column) => column.name === "UserAge",
      );

      expect(ageColumn?.type).toBe(SQL_DECIMAL);
      expect(ageColumn?.nullable).toBe(false);

      expect(result.rows.map((row) => row.values)).toEqual([
        [1, 25],
      ]);
    });

    it("cancels a planned column when it is dropped in the same statement", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addColumn({name: "Age", type: SQL_INTEGER})
        .dropColumn("Age")
        .execute();

      const result = sql.select("*").from("Users").fetch();

      expect(result.columns.map((column) => column.name)).toEqual([
        "Id",
      ]);
    });

    it("cancels a renamed planned column when it is subsequently dropped", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addColumn({name: "Age", type: SQL_INTEGER})
        .renameColumn("Age").to("UserAge")
        .dropColumn("UserAge")
        .execute();

      const result = sql.select("*").from("Users").fetch();

      expect(result.columns.map((column) => column.name)).toEqual([
        "Id",
      ]);
    });

    it("preserves existing column renames when a planned column is dropped", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Age: { type: SQL_INTEGER, nullable: true },
        }),
      ).execute();

      sql.alterTable("Users")
        .addColumn({name: "Temporary", type: SQL_INTEGER})
        .renameColumn("Age").to("UserAge")
        .renameColumn("Temporary").to("TemporaryRenamed")
        .dropColumn("TemporaryRenamed")
        .execute();

      const result = sql.select("*").from("Users").fetch();

      expect(result.columns.map((column) => column.name)).toEqual([
        "Id",
        "UserAge",
      ]);
    });

    it("does not partially apply column renames and alterations when a later operation fails", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Age: { type: SQL_INTEGER, nullable: true },
        }),
      ).execute();

      sql.insertInto("Users", ["Id", "Age"]).values([
        [1, 25],
      ]).execute();

      expect(() =>
        sql.alterTable("Users")
          .renameColumn("Age").to("UserAge")
          .alterColumn("UserAge")
          .setDataType(SQL_DECIMAL)
          .alterColumn("Missing")
          .setNotNull()
          .execute(),
      ).toThrow();

      const result = sql.select("*").from("Users").fetch();

      expect(result.columns.map((column) => column.name)).toEqual([
        "Id",
        "Age",
      ]);

      expect(result.columns.find((column) => column.name === "Age")?.type)
        .toBe(SQL_INTEGER);

      expect(result.rows.map((row) => row.values)).toEqual([
        [1, 25],
      ]);
    });
  });

  describe("ADD CONSTRAINT", () => {
    it("adds a primary key constraint", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Name: { type: SQL_VARCHAR, nullable: true },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("pk_users")
        .primaryKey(["Id"])
        .execute();

      sql.insertInto("Users", ["Id", "Name"]).values([
        [1, "Alice"],
      ]).execute();

      expect(() =>
        sql.insertInto("Users", ["Id", "Name"]).values([
          [1, "Bob"],
        ]).execute(),
      ).toThrow();

      expect(sql.select("*").from("Users").fetch().rows.map((row) => row.values))
        .toEqual([[1, "Alice"]]);
    });

    it("adds a unique constraint", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Email: { type: SQL_VARCHAR, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("uq_users_email")
        .unique(["Email"])
        .execute();

      sql.insertInto("Users", ["Id", "Email"]).values([
        [1, "alice@example.com"],
      ]).execute();

      expect(() =>
        sql.insertInto("Users", ["Id", "Email"]).values([
          [2, "alice@example.com"],
        ]).execute(),
      ).toThrow();
    });

    it("adds a check constraint", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Age: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("ck_users_age")
        .check(col("Age").gte(18))
        .execute();

      sql.insertInto("Users", ["Id", "Age"]).values([
        [1, 25],
      ]).execute();

      expect(() =>
        sql.insertInto("Users", ["Id", "Age"]).values([
          [2, 16],
        ]).execute(),
      ).toThrow();

      expect(sql.select("*").from("Users").fetch().rows.map((row) => row.values))
        .toEqual([[1, 25]]);
    });

    it("adds a foreign key constraint", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Organizations", {
          Id: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          OrganizationId: { type: SQL_INTEGER, nullable: true },
        }),
      ).execute();

      sql.alterTable("Organizations")
        .addConstraint("pk_organizations")
        .primaryKey(["Id"])
        .execute();

      sql.alterTable("Users")
        .addConstraint("fk_users_organizations")
        .foreignKey(["OrganizationId"])
        .references("Organizations", ["Id"])
        .execute();

      sql.insertInto("Organizations", ["Id"]).values([
        [10],
      ]).execute();

      sql.insertInto("Users", ["Id", "OrganizationId"]).values([
        [1, 10],
      ]).execute();

      expect(() =>
        sql.insertInto("Users", ["Id", "OrganizationId"]).values([
          [2, 99],
        ]).execute(),
      ).toThrow();
    });

    it("applies foreign key referential actions", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Organizations", {
          Id: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          OrganizationId: { type: SQL_INTEGER, nullable: true },
        }),
      ).execute();

      sql.alterTable("Organizations")
        .addConstraint("pk_organizations")
        .primaryKey(["Id"])
        .execute();

      sql.alterTable("Users")
        .addConstraint("fk_users_organizations")
        .foreignKey(["OrganizationId"])
        .references("Organizations", ["Id"])
        .onDelete("cascade")
        .execute();

      sql.insertInto("Organizations", ["Id"]).values([
        [10],
      ]).execute();

      sql.insertInto("Users", ["Id", "OrganizationId"]).values([
        [1, 10],
        [2, 10],
      ]).execute();

      sql.deleteFrom("Organizations").where(col("Id").eq(10)).execute();

      expect(sql.select("*").from("Users").fetch().rows).toHaveLength(0);
    });
  });

  describe("DROP CONSTRAINT", () => {
    it("drops a unique constraint", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Email: { type: SQL_VARCHAR, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("uq_users_email")
        .unique(["Email"])
        .execute();

      sql.alterTable("Users").dropConstraint("uq_users_email").execute();

      sql.insertInto("Users", ["Id", "Email"]).values([
        [1, "alice@example.com"],
        [2, "alice@example.com"],
      ]).execute();

      expect(sql.select("*").from("Users").fetch().rows).toHaveLength(2);
    });

    it("drops a check constraint", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Age: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("ck_users_age")
        .check(col("Age").gte(18))
        .execute();

      sql.alterTable("Users").dropConstraint("ck_users_age").execute();

      sql.insertInto("Users", ["Id", "Age"]).values([
        [1, 16],
      ]).execute();

      expect(sql.select("*").from("Users").fetch().rows.map((row) => row.values))
        .toEqual([[1, 16]]);
    });

    it("drops a foreign key constraint", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Organizations", {
          Id: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          OrganizationId: { type: SQL_INTEGER, nullable: true },
        }),
      ).execute();

      sql.alterTable("Organizations")
        .addConstraint("pk_organizations")
        .primaryKey(["Id"])
        .execute();

      sql.alterTable("Users")
        .addConstraint("fk_users_organizations")
        .foreignKey(["OrganizationId"])
        .references("Organizations", ["Id"])
        .execute();

      sql.alterTable("Users")
        .dropConstraint("fk_users_organizations")
        .execute();

      sql.insertInto("Users", ["Id", "OrganizationId"]).values([
        [1, 99],
      ]).execute();

      expect(sql.select("*").from("Users").fetch().rows.map((row) => row.values))
        .toEqual([[1, 99]]);
    });

    it("drops a primary key constraint", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("pk_users")
        .primaryKey(["Id"])
        .execute();

      sql.alterTable("Users").dropPrimaryKey().execute();

      sql.insertInto("Users", ["Id"]).values([
        [1],
        [1],
      ]).execute();

      expect(sql.select("*").from("Users").fetch().rows).toHaveLength(2);
    });

    it("rejects dropping a constraint that does not exist", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      expect(() =>
        sql.alterTable("Users").dropConstraint("missing_constraint").execute(),
      ).toThrow();
    });
  });

  describe("RENAME CONSTRAINT", () => {
    it("renames a unique constraint and preserves its behavior", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Email: { type: SQL_VARCHAR, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("uq_users_email")
        .unique(["Email"])
        .execute();

      sql.alterTable("Users")
        .renameConstraint("uq_users_email")
        .to("uq_users_email_new")
        .execute();

      expect(() =>
        sql.alterTable("Users")
          .renameConstraint("uq_users_email")
          .to("uq_users_email_old")
          .execute(),
      ).toThrow();

      sql.insertInto("Users", ["Id", "Email"]).values([
        [1, "alice@example.com"],
      ]).execute();

      expect(() =>
        sql.insertInto("Users", ["Id", "Email"]).values([
          [2, "alice@example.com"],
        ]).execute(),
      ).toThrow();
    });

    it("rejects renaming a constraint to an existing constraint name", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Email: { type: SQL_VARCHAR, nullable: false },
          Age: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("uq_users_email")
        .unique(["Email"])
        .addConstraint("ck_users_age")
        .check(col("Age").gte(18))
        .execute();

      expect(() =>
        sql.alterTable("Users")
          .renameConstraint("uq_users_email")
          .to("ck_users_age")
          .execute(),
      ).toThrow();
    });

    it("rejects renaming a constraint that does not exist", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      expect(() =>
        sql.alterTable("Users")
          .renameConstraint("missing_constraint")
          .to("new_constraint")
          .execute(),
      ).toThrow();
    });
  });

  describe("Constraint dependencies", () => {
    it("rejects dropping a column used by a unique constraint", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Email: { type: SQL_VARCHAR, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("uq_users_email")
        .unique(["Email"])
        .execute();

      expect(() =>
        sql.alterTable("Users").dropColumn("Email").execute(),
      ).toThrow();
    });

    it("allows dropping a constrained column after dropping its constraint", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Email: { type: SQL_VARCHAR, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("uq_users_email")
        .unique(["Email"])
        .execute();

      sql.alterTable("Users")
        .dropConstraint("uq_users_email")
        .dropColumn("Email")
        .execute();

      expect(sql.select("*").from("Users").fetch().columns.map((column) => column.name))
        .toEqual(["Id"]);
    });

    it("preserves constraint behavior after renaming a referenced column", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Email: { type: SQL_VARCHAR, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("uq_users_email")
        .unique(["Email"])
        .execute();

      sql.alterTable("Users")
        .renameColumn("Email").to("UserEmail")
        .execute();

      sql.insertInto("Users", ["Id", "UserEmail"]).values([
        [1, "alice@example.com"],
      ]).execute();

      expect(() =>
        sql.insertInto("Users", ["Id", "UserEmail"]).values([
          [2, "alice@example.com"],
        ]).execute(),
      ).toThrow();
    });
  });

  describe("Constraint operations", () => {
    it("adds and then drops a planned constraint in the same statement", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Email: { type: SQL_VARCHAR, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("uq_users_email")
        .unique(["Email"])
        .dropConstraint("uq_users_email")
        .execute();

      sql.insertInto("Users", ["Id", "Email"]).values([
        [1, "alice@example.com"],
        [2, "alice@example.com"],
      ]).execute();

      expect(sql.select("*").from("Users").fetch().rows).toHaveLength(2);
    });

    it("does not partially apply constraint operations when a later operation fails", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Email: { type: SQL_VARCHAR, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("uq_users_email")
        .unique(["Email"])
        .execute();

      expect(() =>
        sql.alterTable("Users")
          .dropConstraint("uq_users_email")
          .dropConstraint("missing_constraint")
          .execute(),
      ).toThrow();

      sql.insertInto("Users", ["Id", "Email"]).values([
        [1, "alice@example.com"],
      ]).execute();

      expect(() =>
        sql.insertInto("Users", ["Id", "Email"]).values([
          [2, "alice@example.com"],
        ]).execute(),
      ).toThrow();
    });

    it("cancels a planned primary key added and dropped in the same statement", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("pk_users")
        .primaryKey(["Id"])
        .dropConstraint("pk_users")
        .execute();

      // The primary key was cancelled, so duplicate values are accepted.
      sql.insertInto("Users", ["Id"]).values([
        [1],
        [1],
      ]).execute();
    });

    it("cancels a planned unique constraint added and dropped in the same statement", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Email: { type: SQL_VARCHAR, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("uq_users_email")
        .unique(["Email"])
        .dropConstraint("uq_users_email")
        .execute();

      // The unique constraint was cancelled.
      sql.insertInto("Users", ["Id", "Email"]).values([
        [1, "alice@example.com"],
        [2, "alice@example.com"],
      ]).execute();
    });

    it("cancels a planned foreign key added and dropped in the same statement", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Roles", {
          Id: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      sql.alterTable("Roles")
        .addConstraint("pk_roles")
        .primaryKey(["Id"])
        .execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          RoleId: { type: SQL_INTEGER, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("fk_users_roles")
        .foreignKey(["RoleId"])
        .references("Roles", ["Id"])
        .dropConstraint("fk_users_roles")
        .execute();

      // The foreign key was cancelled, so the missing parent row is accepted.
      sql.insertInto("Users", ["Id", "RoleId"]).values([
        [1, 999],
      ]).execute();
    });

    it("allows reusing a backing-index name after dropping its constraint", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          Email: { type: SQL_VARCHAR, nullable: false },
        }),
      ).execute();

      sql.alterTable("Users")
        .addConstraint("uq_users_email")
        .unique(["Email"])
        .execute();

      sql.alterTable("Users")
        .dropConstraint("uq_users_email")
        .addConstraint("uq_users_email")
        .unique(["Email"])
        .execute();

      sql.insertInto("Users", ["Id", "Email"]).values([
        [1, "alice@example.com"],
      ]).execute();

      // The replacement constraint is active.
      expect(() =>
        sql.insertInto("Users", ["Id", "Email"]).values([
          [2, "alice@example.com"],
        ]).execute(),
      ).toThrow();
    });
  });

  describe("ADD INDEX", () => {
    it("adds an index", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
        { name: "Email", type: SQL_VARCHAR, nullable: false },
      ]).execute();

      sql.alterTable("Users")
        .addIndex({ name: "I1", columns: ["Id"] })
        .execute();

      expect(getIndexColumnNames("Users", "I1"))
        .to.deep.equal(["Id"]);
    });

    it("adds multiple indexes in one statement", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
        { name: "Email", type: SQL_VARCHAR, nullable: false },
      ]).execute();

      sql.alterTable("Users")
        .addIndex({ name: "I1", columns: ["Id"] })
        .addIndex({ name: "I2", columns: ["Email"] })
        .execute();

      expect(getIndexColumnNames("Users", "I1"))
        .to.deep.equal(["Id"]);

      expect(getIndexColumnNames("Users", "I2"))
        .to.deep.equal(["Email"]);
    });

    it("rejects an index referencing a nonexistent column", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
      ]).execute();

      expect(() => sql.alterTable("Users")
        .addIndex({ name: "I1", columns: ["Missing"] })
        .execute(),
      ).to.throw();
    });
  });

  
  describe("CREATE INDEX", () => {
    it("creates a non-unique index", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
      ]).execute();

      sql.createIndex("I1")
        .on("Users", ["Id"])
        .execute();

      expect(getIndexColumnNames("Users", "I1"))
        .to.deep.equal(["Id"]);

      expect(getIndex("Users", "I1")?.unique)
        .to.equal(false);
    });

    it("creates a unique index", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
        { name: "Email", type: SQL_VARCHAR, nullable: false },
      ]).execute();

      sql.createUniqueIndex("I1")
        .on("Users", ["Email"])
        .execute();

      expect(getIndexColumnNames("Users", "I1"))
        .to.deep.equal(["Email"]);

      expect(getIndex("Users", "I1")?.unique)
        .to.equal(true);

      sql.insertInto("Users", ["Id", "Email"])
        .values([[1, "alice@example.com"]])
        .execute();

      expect(() => sql.insertInto("Users", ["Id", "Email"])
        .values([[2, "alice@example.com"]])
        .execute(),
      ).to.throw();
    });

    it("accepts column names as strings", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
      ]).execute();

      sql.createIndex("I1")
        .on("Users", ["Id"])
        .execute();

      expect(getIndexColumnNames("Users", "I1"))
        .to.deep.equal(["Id"]);
    });

    it("accepts multiple columns", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
        { name: "Email", type: SQL_VARCHAR, nullable: false },
      ]).execute();

      sql.createIndex("I1")
        .on("Users", ["Id", "Email"])
        .execute();

      expect(getIndexColumnNames("Users", "I1"))
        .to.deep.equal(["Id", "Email"]);
    });

    it("rejects an index referencing a nonexistent column", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
      ]).execute();

      expect(() => sql.createIndex("I1")
        .on("Users", ["Missing"])
        .execute(),
      ).to.throw();
    });

    it("rejects an index without columns", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
      ]).execute();

      expect(() => sql.createIndex("I1")
        .on("Users", [])
        .execute(),
      ).to.throw();
    });
  });


  describe("DROP INDEX", () => {
    it("drops an index", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
        { name: "Email", type: SQL_VARCHAR, nullable: false },
      ]).execute();

      sql.alterTable("Users")
        .addIndex({ name: "I1", columns: ["Id"] })
        .execute();

      sql.alterTable("Users")
        .dropIndex("I1")
        .execute();

      expect(getIndexColumnNames("Users", "I1"))
        .to.equal(undefined);
    });

    it("drops multiple indexes in one statement", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
        { name: "Email", type: SQL_VARCHAR, nullable: false },
      ]).execute();

      sql.alterTable("Users")
        .addIndex({ name: "I1", columns: ["Id"] })
        .addIndex({ name: "I2", columns: ["Email"] })
        .execute();

      sql.alterTable("Users")
        .dropIndex("I1")
        .dropIndex("I2")
        .execute();

      expect(getIndexColumnNames("Users", "I1"))
        .to.equal(undefined);

      expect(getIndexColumnNames("Users", "I2"))
        .to.equal(undefined);
    });

    it("rejects dropping a nonexistent index", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
      ]).execute();

      expect(() => sql.alterTable("Users")
        .dropIndex("Missing")
        .execute(),
      ).to.throw();
    });
  });

  describe("RENAME INDEX", () => {
    it("renames an index", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
        { name: "Email", type: SQL_VARCHAR, nullable: false },
      ]).execute();

      sql.alterTable("Users")
        .addIndex({ name: "I1", columns: ["Id"] })
        .execute();

      sql.alterTable("Users")
        .renameIndex("I1").to("I2")
        .execute();

      expect(getIndexColumnNames("Users", "I1"))
        .to.equal(undefined);

      expect(getIndexColumnNames("Users", "I2"))
        .to.deep.equal(["Id"]);
    });

    it("renames multiple indexes in one statement", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
        { name: "Email", type: SQL_VARCHAR, nullable: false },
      ]).execute();

      sql.alterTable("Users")
        .addIndex({ name: "I1", columns: ["Id"] })
        .addIndex({ name: "I2", columns: ["Email"] })
        .execute();

      sql.alterTable("Users")
        .renameIndex("I1").to("I2")
        .renameIndex("I2").to("I1")
        .execute();

      expect(getIndexColumnNames("Users", "I1"))
        .to.deep.equal(["Email"]);

      expect(getIndexColumnNames("Users", "I2"))
        .to.deep.equal(["Id"]);
    });

    it("rejects renaming a nonexistent index", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
      ]).execute();

      expect(() => sql.alterTable("Users")
        .renameIndex("Missing").to("I1")
        .execute(),
      ).to.throw();
    });

    it("rejects renaming an index to the name of an existing index", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable("Users", [
        { name: "Id", type: SQL_INTEGER, nullable: false },
        { name: "Email", type: SQL_VARCHAR, nullable: false },
      ]).execute();

      sql.createIndex("I1").on("Users", ["Id"]).execute();
      sql.createIndex("I2").on("Users", ["Email"]).execute();

      expect(() => (
        sql.alterTable("Users")
          .renameIndex("I1").to("I2")
          .execute()
      )).to.throw();

      expect(getIndex("Users", "I1")).toBeDefined();
      expect(getIndex("Users", "I2")).toBeDefined();

      expect(getIndexColumnNames("Users", "I1")).to.deep.equal(["Id"]);
      expect(getIndexColumnNames("Users", "I2")).to.deep.equal(["Email"]);
    });
  });

  describe("Foreign key parent index lifecycle", () => {
    it("preserves a published parent index after its unique constraint is dropped", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Organizations", {
          Id: { type: SQL_INTEGER, nullable: false },
          Email: { type: SQL_VARCHAR, nullable: false },
        }),
      ).execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: { type: SQL_INTEGER, nullable: false },
          OrganizationEmail: { type: SQL_VARCHAR, nullable: false },
        }),
      ).execute();

      sql.createTable(
        ...createTableTestSpec("Teams", {
          Id: { type: SQL_INTEGER, nullable: false },
          OrganizationEmail: { type: SQL_VARCHAR, nullable: false },
        }),
      ).execute();

      sql.alterTable("Organizations")
        .addConstraint("uq_organizations_email")
        .unique(["Email"])
        .execute();

      sql.alterTable("Users")
        .addConstraint("fk_users_organizations")
        .foreignKey(["OrganizationEmail"])
        .references("Organizations", ["Email"])
        .execute();

      const expectedIndexName =
        Unique.defaultIndexName("uq_organizations_email");

      sql.alterTable("Teams")
        .addConstraint("fk_teams_organizations")
        .foreignKey(["OrganizationEmail"])
        .references("Organizations", ["Email"])
        .execute();

      // The first FK reference publishes the backing index.
      expect(
        getIndex(
          "Organizations",
          expectedIndexName,
        )?.internal
      ).toBe(false);

      // Removing one FK must not affect the other.
      sql.alterTable("Users")
        .dropConstraint("fk_users_organizations")
        .execute();

      // The original unique constraint can now be removed.
      sql.alterTable("Organizations")
        .dropConstraint("uq_organizations_email")
        .execute();

      // The published index survives constraint removal.
      expect(getIndex("Organizations", expectedIndexName))
        .toBeDefined();

      expect(getIndex("Organizations", expectedIndexName)?.internal)
        .toBe(false);

      // The FK that was removed no longer enforces referential integrity.
      sql.insertInto("Users", ["Id", "OrganizationEmail"]).values([
        [1, "missing@example.com"],
      ]).execute();

      // The remaining FK still enforces referential integrity.
      expect(() => {
        sql.insertInto("Teams", ["Id", "OrganizationEmail"]).values([
          [1, "missing@example.com"],
        ]).execute();
      }).toThrow();
    });
  });
});