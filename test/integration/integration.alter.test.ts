import { describe, it, expect } from 'vitest';
import { createTestMySqlSql, createTestPostgresSql, freshEngine } from '../utils/engineHelpers.ts';
import { SQL_DECIMAL, SQL_INTEGER, SQL_VARCHAR } from '../../src/types/SqlType.ts';
import { col } from '../../src/ast/dsl.ts';
import { createTableTestSpec } from '../utils/buildSchema.ts';

describe("Integration::alter", () => {
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
      }).toThrow(/duplicate column/i);
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
      }).toThrow(/already exists|already taken/i);
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
      }).toThrow(/duplicate column/i);
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

      sql.alterTable("Users").renameColumn([{from: "Name", to: "DisplayName"}]).execute();

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

      sql.alterTable("Users").renameColumn([{from: "Name", to: "DisplayName"}]).execute();

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
          .renameColumn([{from: "Name", to: "displayname"}])
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
        .renameColumn([
          { from: "Name", to: "DisplayName" },
          { from: "Age", to: "Years" },
        ])
        .execute();

      // Verify both renamed columns can subsequently be resolved.
      expect(() => {
        sql.alterTable("Users")
          .renameColumn([{ from: "DisplayName", to: "FullName" }])
          .execute();
      }).not.toThrow();

      expect(() => {
        sql.alterTable("Users")
          .renameColumn([{ from: "Years", to: "AgeInYears" }])
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
          .renameColumn([
            { from: "Name", to: "DisplayName" },
            { from: "Age", to: "Years" },
          ])
          .execute();
      }).toThrow();

      // The rejected statement must not have partially applied.
      expect(() => {
        sql.alterTable("Users")
          .renameColumn([{ from: "Name", to: "DisplayName" }])
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
        .renameColumn([
          { from: "FirstName", to: "LastName" },
          { from: "LastName", to: "FirstName" },
        ])
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
        .renameColumn([
          { from: "FirstName", to: "MiddleName" },
          { from: "MiddleName", to: "LastName" },
          { from: "LastName", to: "FirstName" },
        ])
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
    it("rejects duplicate column names in a single ALTER operation", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(...createTableTestSpec("Users", {
        Id: {
          type: SQL_INTEGER,
          nullable: false,
        },
        Age: {
          type: SQL_INTEGER,
          nullable: true,
        },
      })).execute();

      expect(() => {
        sql.alterTable("Users").alterColumn([
          {
            name: "Age",
            type: SQL_INTEGER,
          },
          {
            name: "age",
            type: SQL_INTEGER,
          },
        ]).execute();
      }).toThrow(/duplicate column/i);
    });
  });
});