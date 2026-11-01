import { describe, it, expect } from 'vitest';
import { createTestPostgresSql, freshEngine } from '../utils/engineHelpers.ts';
import { SQL_INTEGER, SQL_VARCHAR } from '../../src/types/SqlType.ts';
import { col } from '../../src/ast/dsl.ts';

describe("Integration::alter", () => {
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

      sql.alterTable("Users").renameColumn("Name", "DisplayName").execute();

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

      sql.alterTable("Users").renameColumn("Name", "DisplayName").execute();

      expect(() =>
        sql.select([col("Name")]).from("Users").fetch(),
      ).toThrow(/column|binding/i);
    });
  });
});