import { describe, it, expect } from 'vitest';
import { createTestPostgresSql, freshEngine } from '../utils/engineHelpers.ts';
import { SQL_DECIMAL, SQL_INTEGER, SQL_JSON, SQL_VARCHAR } from '../../src/types/SqlType.ts';
import { createTableTestSpec } from '../utils/buildSchema.ts';
import { cast, col, json_query, json_value } from '../../src/ast/dsl.ts';
import { createTestDiscoveryResults } from '../utils/importHelpers.ts';
import { DiscoveryDatabaseBuilder } from '../../src/mapping/discovery/DiscoveryDatabaseBuilder.ts';

describe('Integration::query', () => {
  describe("Union All", () => {
    it("executes union all queries end-to-end", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.begin().execute();

      sql.createTable(...createTableTestSpec("UsersA", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
        Name: {
          type: SQL_VARCHAR,
          nullable: false,
        },
      })).execute();

      sql.createTable(...createTableTestSpec("UsersB", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
        Name: {
          type: SQL_VARCHAR,
          nullable: false,
        },
      })).execute();

      sql.commit().execute();

      sql.begin().execute();

      sql
        .insertInto("UsersA", ["Id", "Name"])
        .values([
          [1, "Alice"],
          [2, "Bob"],
        ])
        .execute();

      sql
        .insertInto("UsersB", ["Id", "Name"])
        .values([
          [3, "Carol"],
          [4, "Dave"],
        ])
        .execute();

      sql.commit().execute();

      const results = sql
        .select([col("Id"), col("Name")])
        .from("UsersA")
        .unionAll(
          sql
            .select([col("Id"), col("Name")])
            .from("UsersB")
        )
        .execute();

      expect(results[0].rows).toEqual([
        {
          index: 0,
          values: [1, "Alice"],
        },
        {
          index: 1,
          values: [2, "Bob"],
        },
        {
          index: 0,
          values: [3, "Carol"],
        },
        {
          index: 1,
          values: [4, "Dave"],
        },
      ]);
    });

    it("retains duplicate rows with union all", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.begin().execute();

      sql.createTable(...createTableTestSpec("Users", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
        Name: {
          type: SQL_VARCHAR,
          nullable: false,
        },
      })).execute();

      sql.commit().execute();

      sql.begin().execute();

      sql
        .insertInto("Users", ["Id", "Name"])
        .values([
          [1, "Alice"],
          [2, "Bob"],
        ])
        .execute();

      sql.commit().execute();

      const results = sql
        .select([col("Id"), col("Name")])
        .from("Users")
        .unionAll(
          sql
          .select([col("Id"), col("Name")])
          .from("Users")
        )
        .execute();

      expect(results[0].rows).toEqual([
        { index: 0, values: [1, "Alice"] },
        { index: 1, values: [2, "Bob"] },
        { index: 0, values: [1, "Alice"] },
        { index: 1, values: [2, "Bob"] },
      ]);
    });

    it("uses the left query column names for union all", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.begin().execute();

      sql.createTable(...createTableTestSpec("UsersA", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      sql.createTable(...createTableTestSpec("UsersB", {
        UserId: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      sql.commit().execute();

      sql.begin().execute();

      sql
        .insertInto("UsersA", ["Id"])
        .values([[1]])
        .execute();

      sql
        .insertInto("UsersB", ["UserId"])
        .values([[2]])
        .execute();

      sql.commit().execute();

      const results = sql
        .select([col("Id")])
        .from("UsersA")
        .unionAll(
          sql
            .select([col("UserId")])
            .from("UsersB")
        )
        .execute();

      expect(results[0].rows).toEqual([
        { index: 0, values: [1] },
        { index: 0, values: [2] },
      ]);
    });

    it("executes chained union all queries", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.begin().execute();

      sql.createTable(...createTableTestSpec("UsersA", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      sql.createTable(...createTableTestSpec("UsersB", {
        UserId: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      sql.createTable(...createTableTestSpec("UsersC", {
        UserId: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      sql.commit().execute();

      sql
        .insertInto("UsersA", ["Id"])
        .values([[1]])
        .execute();

      sql
        .insertInto("UsersB", ["UserId"])
        .values([[2]])
        .execute();

      sql
        .insertInto("UsersC", ["UserId"])
        .values([[4]])
        .execute();

      const results = sql
        .select([col("Id")])
        .from("UsersA")
        .unionAll(
          sql
          .select([col("UserId")])
          .from("UsersB")
        )
        .unionAll(
          sql
          .select([col("UserId")])
          .from("UsersC")
        )
        .execute();

      expect(results[0].rows).toEqual([
        { index: 0, values: [1] },
        { index: 0, values: [2] },
        { index: 0, values: [4] },
      ]);
    });

    it("executes union all with reconciled column types", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.begin().execute();

      sql.createTable(...createTableTestSpec("UsersA", {
        Id: {
          type: SQL_INTEGER,
          nullable: false,
        },
      })).execute();

      sql.createTable(...createTableTestSpec("UsersB", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      sql.commit().execute();

      sql.begin().execute();

      sql
        .insertInto("UsersA", ["Id"])
        .values([[1]])
        .execute();

      sql
        .insertInto("UsersB", ["Id"])
        .values([[2.5]])
        .execute();

      sql.commit().execute();

      const results = sql
        .select([col("Id")])
        .from("UsersA")
        .unionAll(
          sql
            .select([col("Id")])
            .from("UsersB")
        )
        .execute();

      expect(results[0].rows).toEqual([
        { index: 0, values: [1] },
        { index: 0, values: [2.5] },
      ]);
    });

    it("allows null values when union all reconciles a nullable column", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.begin().execute();

      sql.createTable(...createTableTestSpec("UsersA", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      sql.createTable(...createTableTestSpec("UsersB", {
        Id: {
          type: SQL_DECIMAL,
          nullable: true,
        },
      })).execute();

      sql.commit().execute();

      sql.begin().execute();

      sql
        .insertInto("UsersA", ["Id"])
        .values([[1]])
        .execute();

      sql
        .insertInto("UsersB", ["Id"])
        .values([[null]])
        .execute();

      sql.commit().execute();

      const results = sql
        .select([col("Id")])
        .from("UsersA")
        .unionAll(
          sql
            .select([col("Id")])
            .from("UsersB")
        )
        .execute();

      expect(results[0].rows).toEqual([
        { index: 0, values: [1] },
        { index: 0, values: [null] },
      ]);
    });

    it("rejects union all queries with different column counts", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(...createTableTestSpec("UsersA", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      sql.createTable(...createTableTestSpec("UsersB", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
        Name: {
          type: SQL_VARCHAR,
          nullable: false,
        },
      })).execute();

      expect(() => {
        sql
          .select([col("Id")])
          .from("UsersA")
          .unionAll(
            sql
              .select([col("Id"), col("Name")])
              .from("UsersB")
          )
          .execute();
      }).toThrow();
    });

    it("rejects union all queries with incompatible column types", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(...createTableTestSpec("UsersA", {
        Value: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      sql.createTable(...createTableTestSpec("UsersB", {
        Value: {
          type: SQL_VARCHAR,
          nullable: false,
        },
      })).execute();

      expect(() => {
        sql
          .select([col("Value")])
          .from("UsersA")
          .unionAll(
            sql
              .select([col("Value")])
              .from("UsersB")
          )
          .execute();
      }).toThrow();
    });

    it("allows an empty left query in union all", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(...createTableTestSpec("Empty", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      sql.createTable(...createTableTestSpec("Users", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      sql.insertInto("Users", ["Id"]).values([[1], [2]]).execute();

      const results = sql
        .select([col("Id")])
        .from("Empty")
        .unionAll(
          sql
            .select([col("Id")])
            .from("Users")
        )
        .execute();

      expect(results[0].rows).toEqual([
        { index: 0, values: [1] },
        { index: 1, values: [2] },
      ]);
    });

    it("allows an empty right query in union all", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(...createTableTestSpec("Users", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      sql.createTable(...createTableTestSpec("Empty", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      sql.insertInto("Users", ["Id"]).values([[1], [2]]).execute();

      const results = sql
        .select([col("Id")])
        .from("Users")
        .unionAll(
          sql
            .select([col("Id")])
            .from("Empty")
        )
        .execute();

      expect(results[0].rows).toEqual([
        { index: 0, values: [1] },
        { index: 1, values: [2] },
      ]);
    });

    it("allows union all of two empty queries", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(...createTableTestSpec("EmptyA", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      sql.createTable(...createTableTestSpec("EmptyB", {
        Id: {
          type: SQL_DECIMAL,
          nullable: false,
        },
      })).execute();

      const results = sql
        .select([col("Id")])
        .from("EmptyA")
        .unionAll(
          sql
            .select([col("Id")])
            .from("EmptyB")
        )
        .execute();

      expect(results[0].rows).toEqual([]);
    });
  });

  describe("Query Result", () => {
    it("returns query column metadata with query results", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: {
            type: SQL_DECIMAL,
            nullable: false,
          },
          Name: {
            type: SQL_VARCHAR,
            nullable: true,
          },
        }),
      ).execute();

      sql.begin().execute();

      sql
        .insertInto("Users", ["Id", "Name"])
        .values([
          [1, "Alice"],
          [2, null],
        ])
        .execute();

      sql.commit().execute();

      const [result] = sql
        .select([col("Id"), col("Name")])
        .from("Users")
        .execute();

      expect(result.columns).toEqual([
        {
          name: "Id",
          type: SQL_DECIMAL,
          nullable: false,
        },
        {
          name: "Name",
          type: SQL_VARCHAR,
          nullable: true,
        },
      ]);

      expect(result.rows).toEqual([
        {
          index: 0,
          values: [1, "Alice"],
        },
        {
          index: 1,
          values: [2, null],
        },
      ]);
    });

    it("returns reconciled column metadata for union all results", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("UsersA", {
          Id: {
            type: SQL_INTEGER,
            nullable: false,
          },
          Name: {
            type: SQL_VARCHAR,
            nullable: false,
          },
        }),
      ).execute();

      sql.createTable(
        ...createTableTestSpec("UsersB", {
          UserId: {
            type: SQL_DECIMAL,
            nullable: true,
          },
          UserName: {
            type: SQL_VARCHAR,
            nullable: true,
          },
        }),
      ).execute();

      sql.begin().execute();

      sql
        .insertInto("UsersA", ["Id", "Name"])
        .values([[1, "Alice"]])
        .execute();

      sql
        .insertInto("UsersB", ["UserId", "UserName"])
        .values([[2, "Bob"]])
        .execute();

      sql.commit().execute();

      const [result] = sql
        .select([col("Id"), col("Name")])
        .from("UsersA")
        .unionAll(
          sql
            .select([col("UserId"), col("UserName")])
            .from("UsersB"),
        )
        .execute();

      expect(result.columns).toEqual([
        {
          name: "Id",
          type: SQL_DECIMAL,
          nullable: true,
        },
        {
          name: "Name",
          type: SQL_VARCHAR,
          nullable: true,
        },
      ]);

      expect(result.rows).toEqual([
        {
          index: 0,
          values: [1, "Alice"],
        },
        {
          index: 0,
          values: [2, "Bob"],
        },
      ]);
    });
  });

  describe("Discovery database", () => {
    it("materializes DiscoveryResults as relational tables", () => {
      const engine = freshEngine();
      const sql = createTestPostgresSql(engine);

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      const discoveryResults = createTestDiscoveryResults([
        {
          parentResultId: null,
          nodeType: "registry",
        },
        {
          parentResultId: 1,
          nodeType: "chainDirectory",
        },
        {
          parentResultId: 1,
          nodeType: "file",
        },
      ]);

      DiscoveryDatabaseBuilder.build({
        engine,
        databaseName: "discovery",
        discoveryResults,
      });

      const result = sql
        .select("*")
        .from("discovery.chainDirectory")
        .execute();

      expect(result).toHaveLength(1);
      expect(result[0].rows).toHaveLength(1);
      expect(result[0].rows[0].values).toEqual([
        2,
        1,
        "chainDirectory",
        [0],
        {},
        {},
        {},
      ]);

      expect(result[0].columns).toEqual([
        { name: "resultId", type: SQL_INTEGER, nullable: false },
        { name: "parentResultId", type: SQL_INTEGER, nullable: true },
        { name: "nodeType", type: SQL_VARCHAR, nullable: false },
        { name: "identity", type: SQL_JSON, nullable: false },
        { name: "value", type: SQL_JSON, nullable: true },
        { name: "metadata", type: SQL_JSON, nullable: true },
        { name: "captures", type: SQL_JSON, nullable: false },
      ]);
    });
  });
  
  describe("JSON expressions", () => {
    const document = {
      chain_name: "osmosis",
      codebase: {
        version: 12,
      },
      metadata: {
        network: "mainnet",
        active: true,
      },
      versions: [1, 2, 3],
    };

    function setupJsonTable() {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Documents", {
          Document: {
            type: SQL_JSON,
            nullable: false,
          },
        }),
      ).execute();

      sql.begin().execute();

      sql
        .insertInto("Documents", ["Document"])
        .values([[document]])
        .execute();

      sql.commit().execute();

      return sql;
    }

    it("extracts a scalar with JSON_VALUE", () => {
      const sql = setupJsonTable();

      const [result] = sql
        .select([json_value(col("Document"), "$.chain_name")])
        .from("Documents")
        .execute();

      expect(result.rows.map((row) => row.values)).toEqual([
        ["osmosis"],
      ]);
    });

    it("extracts a nested scalar with JSON_VALUE", () => {
      const sql = setupJsonTable();

      const [result] = sql
        .select([json_value(col("Document"), "$.codebase.version")])
        .from("Documents")
        .execute();

      expect(result.rows.map((row) => row.values)).toEqual([
        ["12"],
      ]);
    });

    it("casts a JSON_VALUE result to a numeric type", () => {
      const sql = setupJsonTable();

      const [result] = sql
        .select([
          cast(json_value(col("Document"), "$.codebase.version"))
          .as(SQL_DECIMAL),
        ])
        .from("Documents")
        .execute();

      expect(result.rows.map((row) => row.values)).toEqual([
        [12],
      ]);
    });

    it("extracts a nested object with JSON_QUERY", () => {
      const sql = setupJsonTable();

      const [result] = sql
        .select([json_query(col("Document"), "$.metadata")])
        .from("Documents")
        .execute();

      expect(result.rows.map((row) => row.values)).toEqual([
        [{ network: "mainnet", active: true }],
      ]);
    });

    it("extracts an array with JSON_QUERY", () => {
      const sql = setupJsonTable();

      const [result] = sql
        .select([json_query(col("Document"), "$.versions")])
        .from("Documents")
        .execute();

      expect(result.rows.map((row) => row.values)).toEqual([
        [[1, 2, 3]],
      ]);
    });
  });
});