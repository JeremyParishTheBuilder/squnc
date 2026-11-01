import { describe, it, expect } from 'vitest';
import { createTestPostgresSql } from '../utils/engineHelpers.ts';
import { SQL_INTEGER } from '../../src/types/SqlType.ts';
import { createTableTestSpec } from '../utils/buildSchema.ts';
import { col } from '../../src/ast/dsl.ts';

describe("Integration::InputBatch", () => {
  describe("statement execution", () => {
    it("executes multiple statements sequentially", () => {
      const sql = createTestPostgresSql();

      expect(() => {
        sql.createDatabase("DB1").execute();
        sql.useDatabase("DB1").execute();

        sql
          .createTable(
            ...createTableTestSpec("Users", {
              Id: {
                type: SQL_INTEGER,
                nullable: false,
              },
            }),
          )
          .execute();

        sql.insertInto("Users", ["Id"]).values([[42]]).execute();
      }).not.toThrow();

      const result = sql.select("*").from("Users").execute();

      expect(result!.rows.map((row) => row.values)).toEqual([[42]]);
    });

    it("rejects starting another statement while one is pending", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql
        .createTable(
          ...createTableTestSpec("Users", {
            Id: {
              type: SQL_INTEGER,
              nullable: false,
            },
          }),
        )
        .execute();

      const pending = sql.select("*");

      expect(() => sql.createDatabase("DB2")).toThrow();

      // The rejected call must not discard or replace the pending statement.
      expect(() => pending.from("Users").execute()).not.toThrow();
    });

    it("rejects execution of an incomplete statement", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql
        .createTable(
          ...createTableTestSpec("Users", {
            Id: {
              type: SQL_INTEGER,
              nullable: false,
            },
          }),
        )
        .execute();

      const pending = sql.insertInto("Users", ["Id"]);

      expect(() => pending.execute()).toThrow(/source/i);

      // Failed finalization must not discard the current builder.
      expect(() => pending.values([[42]]).execute()).not.toThrow();
    });
  });

  describe("nested statement composition", () => {
    it("uses a nested SELECT as an INSERT source", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql
        .createTable(
          ...createTableTestSpec("Users", {
            Id: {
              type: SQL_INTEGER,
              nullable: false,
            },
          }),
        )
        .execute();

      sql
        .createTable(
          ...createTableTestSpec("UsersCopy", {
            Id: {
              type: SQL_INTEGER,
              nullable: false,
            },
          }),
        )
        .execute();

      sql.insertInto("Users", ["Id"]).values([[1], [2]]).execute();

      sql
        .insertInto("UsersCopy", ["Id"])
        .select(sql.select([col("Id")]).from("Users"))
        .execute();

      const result = sql.select("*").from("UsersCopy").execute();

      expect(result!.rows.map((row) => row.values)).toEqual([[1], [2]]);
    });

    it("uses a nested SELECT as a CTAS source", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql
        .createTable(
          ...createTableTestSpec("Users", {
            Id: {
              type: SQL_INTEGER,
              nullable: false,
            },
          }),
        )
        .execute();

      sql.insertInto("Users", ["Id"]).values([[1], [2]]).execute();

      sql
        .createTable(...createTableTestSpec("UsersCopy"))
        .as(sql.select([col("Id")]).from("Users"))
        .execute();

      const result = sql.select("*").from("UsersCopy").execute();

      expect(result!.rows.map((row) => row.values)).toEqual([[1], [2]]);
    });
  });
});
