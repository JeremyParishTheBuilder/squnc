import { describe, it, expect } from 'vitest';
import { createTestMySqlSql, createTestPostgresSql, freshEngine } from '../utils/engineHelpers.ts';
import { and, col, or, table } from '../../src/ast/dsl.ts';
import { SQL_DECIMAL, SQL_INTEGER, SQL_VARCHAR } from '../../src/types/SqlType.ts';
import { createTableTestSpec } from '../utils/buildSchema.ts';

describe('Integration::select', () => {
  it("executes select * queries end-to-end", () => {
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
      .select("*")
      .from("Users")
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
    ]);
  });

  it("executes projected select queries end-to-end", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();

    sql.useDatabase("DB1").execute();

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

    sql
      .insertInto("Users", ["Id", "Name"])
      .values([
        [1, "Alice"],
        [2, "Bob"],
      ])
      .execute();

    const results = sql
      .select([col("Name")])
      .from("Users")
      .execute();

    expect(results[0].rows).toEqual([
      {
        index: 0,
        values: ["Alice"],
      },
      {
        index: 1,
        values: ["Bob"],
      },
    ]);
  });

  it("executes where filtering end-to-end", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();

    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Users", {
      Age: {
        type: SQL_DECIMAL,
        nullable: false,
      },
    })).execute();

    sql
      .insertInto("Users", ["Age"])
      .values([
        [10],
        [20],
        [30],
      ])
      .execute();

    const results = sql
      .select("*")
      .from("Users")
      .where(
        col("Age").gt(15)
      )
      .execute();

    expect(results[0].rows).toEqual([
      {
        index: 1,
        values: [20],
      },
      {
        index: 2,
        values: [30],
      },
    ]);
  });

  it("executes logical and predicates end-to-end", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();

    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Users", {
      Age: {
        type: SQL_DECIMAL,
        nullable: false,
      },
      Score: {
        type: SQL_DECIMAL,
        nullable: false,
      },
    })).execute();

    sql
      .insertInto("Users", ["Age", "Score"])
      .values([
        [10, 100],
        [20, 100],
        [20, 50],
      ])
      .execute();

    const results = sql
      .select("*")
      .from("Users")
      .where(
        and(
          col("Age").eq(20),
          col("Score").eq(100)
        )
      )
      .execute();

    expect(results[0].rows).toEqual([
      {
        index: 1,
        values: [20, 100],
      },
    ]);
  });

  it("executes logical and predicates end-to-end", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();

    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Users", {
      Age: {
        type: SQL_DECIMAL,
        nullable: false,
      },
      Score: {
        type: SQL_DECIMAL,
        nullable: false,
      },
    })).execute();

    sql
      .insertInto("Users", ["Age", "Score"])
      .values([
        [10, 100],
        [20, 100],
        [20, 50],
      ])
      .execute();

    const results = sql
      .select("*")
      .from("Users")
      .where(
        and(
          col("Age").eq(20),
          col("Score").eq(100)
        )
      )
      .execute();

    expect(results[0].rows).toEqual([
      {
        index: 1,
        values: [20, 100],
      },
    ]);
  });

  it("executes logical or predicates end-to-end", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();

    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Users", {
      Age: {
        type: SQL_DECIMAL,
        nullable: false,
      },
    })).execute();

    sql
      .insertInto("Users", ["Age"])
      .values([
        [10],
        [20],
        [30],
      ])
      .execute();

    const results = sql
      .select("*")
      .from("Users")
      .where(
        or(
          col("Age").eq(10),
          col("Age").eq(30)
        )
      )
      .execute();

    expect(results[0].rows).toEqual([
      {
        index: 0,
        values: [10],
      },
      {
        index: 2,
        values: [30],
      },
    ]);
  });

  it("resolves identifiers case-insensitively end-to-end", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();

    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Users", {
      UserId: {
        type: SQL_DECIMAL,
        nullable: false,
      },
    })).execute();

    sql
      .insertInto("Users", ["UserId"])
      .values([
        [1],
      ])
      .execute();

    const results = sql
      .select([col("userid")])
      .from("users")
      .execute();

    expect(results[0].rows).toEqual([
      {
        index: 0,
        values: [1],
      },
    ]);
  });

  it("produces deterministic execution results", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();

    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Users", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
      },
    })).execute();

    sql
      .insertInto("Users", ["Id"])
      .values([
        [1],
        [2],
      ])
      .execute();

    const first = sql
      .select("*")
      .from("Users")
      .execute();

    const second = sql
      .select("*")
      .from("Users")
      .execute();

    expect(first).toEqual(second);
  });

  it("does not mutate committed state during select execution", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();

    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Users", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
      },
    })).execute();

    sql
      .insertInto("Users", ["Id"])
      .values([
        [1],
      ])
      .execute();

    const before = sql
      .select("*")
      .from("Users")
      .execute();

    sql
      .select("*")
      .from("Users")
      .execute();

    const after = sql
      .select("*")
      .from("Users")
      .execute();

    expect(before).toEqual(after);
  });

  it("binds star projection columns to the correct positions", () => {
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
        nullable: false,
      },
    })).execute();

    sql.createTable(...createTableTestSpec("Orders", {
      Id: {
        type: SQL_INTEGER,
        nullable: false,
      },
      UserId: {
        type: SQL_INTEGER,
        nullable: false,
      },
    })).execute();

    sql
      .insertInto("Users", ["Id", "Name"])
      .values([[1, "Alice"]])
      .execute();

    sql
      .insertInto("Orders", ["Id", "UserId"])
      .values([[10, 1]])
      .execute();

    const result = sql
      .select("*")
      .from("Users")
      .as("u")
      .innerJoin( table("Orders").as("o") )
      .on(
        col("u.Id").eq(col("o.UserId"))
      )
      .execute();

    expect(result[0].rows).toEqual([
      {
        index: 0,
        values: [1, "Alice", 10, 1],
      },
    ]);
  });

  it("executes an inner join using the join predicate", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(
      ...createTableTestSpec("Users", {
        Id: { type: SQL_INTEGER, nullable: false },
        Name: { type: SQL_VARCHAR, nullable: false },
      }),
    ).execute();

    sql.createTable(
      ...createTableTestSpec("Orders", {
        Id: { type: SQL_INTEGER, nullable: false },
        UserId: { type: SQL_INTEGER, nullable: false },
      }),
    ).execute();

    sql.insertInto("Users", ["Id", "Name"])
      .values([
        [1, "Alice"],
        [2, "Bob"],
      ])
      .execute();

    sql.insertInto("Orders", ["Id", "UserId"])
      .values([
        [10, 1],
        [11, 3],
      ])
      .execute();

    const result = sql
      .select([col("u.Name"), col("o.Id")])
      .from( table("Users").as("u") )
      .innerJoin( table("Orders").as("o") )
      .on(col("u.Id").eq(col("o.UserId")))
      .execute();

    expect(result[0].rows).toEqual([
      { index: 0, values: ["Alice", 10] },
    ]);
  });

  it("supports qualified columns from both sides of an inner join", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(
      ...createTableTestSpec("Users", {
        Id: { type: SQL_INTEGER, nullable: false },
        Name: { type: SQL_VARCHAR, nullable: false },
      }),
    ).execute();

    sql.createTable(
      ...createTableTestSpec("Orders", {
        Id: { type: SQL_INTEGER, nullable: false },
        UserId: { type: SQL_INTEGER, nullable: false },
      }),
    ).execute();

    sql.insertInto("Users", ["Id", "Name"])
      .values([[1, "Alice"]])
      .execute();

    sql.insertInto("Orders", ["Id", "UserId"])
      .values([[10, 1]])
      .execute();

    const result = sql
      .select([col("u.Id"), col("u.Name"), col("o.Id"), col("o.UserId")])
      .from( table("Users").as("u") )
      .innerJoin( table("Orders").as("o") )
      .on(col("u.Id").eq(col("o.UserId")))
      .execute();

    expect(result[0].rows).toEqual([
      { index: 0, values: [1, "Alice", 10, 1] },
    ]);
  });

  it("returns multiple rows from an inner join", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(
      ...createTableTestSpec("Users", {
        Id: { type: SQL_INTEGER, nullable: false },
        Name: { type: SQL_VARCHAR, nullable: false },
      }),
    ).execute();

    sql.createTable(
      ...createTableTestSpec("Orders", {
        Id: { type: SQL_INTEGER, nullable: false },
        UserId: { type: SQL_INTEGER, nullable: false },
      }),
    ).execute();

    sql.insertInto("Users", ["Id", "Name"])
      .values([
        [1, "Alice"],
        [2, "Bob"],
      ])
      .execute();

    sql.insertInto("Orders", ["Id", "UserId"])
      .values([
        [10, 1],
        [20, 2],
      ])
      .execute();

    const result = sql
      .select([col("u.Name"), col("o.Id")])
      .from( table("Users").as("u") )
      .innerJoin( table("Orders").as("o") )
      .on(col("u.Id").eq(col("o.UserId")))
      .execute();

    expect(result[0].rows).toEqual([
      { index: 0, values: ["Alice", 10] },
      { index: 1, values: ["Bob", 20] },
    ]);
  });

  it("executes multiple joins in sequence", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(
      ...createTableTestSpec("Users", {
        Id: { type: SQL_INTEGER, nullable: false },
        Name: { type: SQL_VARCHAR, nullable: false },
      }),
    ).execute();

    sql.createTable(
      ...createTableTestSpec("Orders", {
        Id: { type: SQL_INTEGER, nullable: false },
        UserId: { type: SQL_INTEGER, nullable: false },
      }),
    ).execute();

    sql.createTable(
      ...createTableTestSpec("Items", {
        Id: { type: SQL_INTEGER, nullable: false },
        OrderId: { type: SQL_INTEGER, nullable: false },
      }),
    ).execute();

    sql.insertInto("Users", ["Id", "Name"])
      .values([
        [1, "Alice"],
        [2, "Bob"],
      ])
      .execute();

    sql.insertInto("Orders", ["Id", "UserId"])
      .values([
        [10, 1],
        [20, 2],
      ])
      .execute();

    sql.insertInto("Items", ["Id", "OrderId"])
      .values([
        [100, 10],
        [200, 20],
        [300, 999],
      ])
      .execute();

    const result = sql
      .select([
        col("u.Name"),
        col("o.Id"),
        col("i.Id"),
      ])
      .from( table("Users").as("u") )
      .innerJoin( table("Orders").as("o") )
      .on(col("u.Id").eq(col("o.UserId")))
      .innerJoin( table("Items").as("i") )
      .on(col("o.Id").eq(col("i.OrderId")))
      .execute();

    expect(result[0].rows).toEqual([
      { index: 0, values: ["Alice", 10, 100] },
      { index: 1, values: ["Bob", 20, 200] },
    ]);
  });

  describe("derived tables", () => {
    it("allows duplicate column names in a PostgreSQL derived table", () => {
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
          nullable: false,
        },
      })).execute();

      sql
        .insertInto("Users", ["Id", "Age"])
        .values([
          [1, 25],
        ])
        .execute();

      expect(() =>
        sql
          .select("*")
          .from(
            sql
              .select([
                col("Id").as("a"),
                col("Age").as("a"),
              ])
              .from("Users")
              .as("d")
          )
          .execute(),
      ).not.toThrow();
    });

    it("rejects duplicate column names in a MySQL derived table", () => {
      const sql = createTestMySqlSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(...createTableTestSpec("Users", {
        Id: {
          type: SQL_INTEGER,
          nullable: false,
        },
        Age: {
          type: SQL_INTEGER,
          nullable: false,
        },
      })).execute();

      sql
        .insertInto("Users", ["Id", "Age"])
        .values([
          [1, 25],
        ])
        .execute();

      expect(() =>
        sql
          .select("*")
          .from(
            sql
              .select([
                col("Id").as("a"),
                col("Age").as("a"),
              ])
              .from("Users")
              .as("d")
          )
          .execute(),
      ).toThrow(/duplicate/i);
    });

    it("projects duplicate-named columns from a derived table", () => {
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
          nullable: false,
        },
      })).execute();

      sql
        .insertInto("Users", ["Id", "Age"])
        .values([
          [1, 25],
        ])
        .execute();

      const result = sql
        .select("*")
        .from(
          sql
            .select([
              col("d.Id").as("a"),
              col("d.Age").as("a"),
            ])
            .from("Users")
            .as("d")
        )
        .execute();

      expect(result[0].columns).toEqual([
        {
          name: "a",
          type: SQL_INTEGER,
          nullable: false,
        },
        {
          name: "a",
          type: SQL_INTEGER,
          nullable: false,
        },
      ]);

      expect(result[0].rows).toEqual([
        {
          index: 0,
          values: [1, 25],
        },
      ]);
    });

    it("rejects an ambiguous reference to a duplicate-named derived column", () => {
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
          nullable: false,
        },
      })).execute();

      sql
        .insertInto("Users", ["Id", "Age"])
        .values([
          [1, 25],
        ])
        .execute();

      expect(() =>
        sql
          .select([col("d.a")])
          .from(
            sql
              .select([
                col("a.Id").as("a"),
              ])
              .from("Users")
              .as("a")
          )
          .as("d")
          .execute(),
      ).not.toThrow();

      expect(() =>
        sql
          .select([col("d.a")])
          .from(
            sql
              .select([
                col("a.Id").as("a"),
                col("Age").as("a"),
              ])
              .from("Users")
              .as("a")
          )
          .as("d")
          .execute(),
      ).toThrow(/ambiguous/i);
    });

    it("does not expose an inner relation alias outside a derived table", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: {
            type: SQL_INTEGER,
            nullable: false,
          },
        }),
      ).execute();

      expect(() =>
        sql
          .select([col("d.a")])
          .from(
            sql
              .select([
                col("a.Id").as("a"),
              ])
              .from("Users")
              .as("a"),
          )
          .as("d")
          .execute(),
      ).not.toThrow();

      expect(() =>
        sql
          .select([col("u.Id")])
          .from(
            sql
              .select([
                col("u.Id").as("Id"),
              ])
              .from("Users")
              .as("u"),
          )
          .as("a")
          .execute(),
      ).toThrow(/No relation binding matches given relation name/i);
    });
  });

  describe("joins", () => {
    it("resolves an aliased join as a single outer relation", () => {
      const sql = createTestPostgresSql();

      sql.createDatabase("DB1").execute();
      sql.useDatabase("DB1").execute();

      sql.createTable(
        ...createTableTestSpec("Users", {
          Id: {
            type: SQL_INTEGER,
            nullable: false,
          },
        }),
      ).execute();

      sql.createTable(
        ...createTableTestSpec("Orders", {
          Id: {
            type: SQL_INTEGER,
            nullable: false,
          },
          UserId: {
            type: SQL_INTEGER,
            nullable: false,
          },
        }),
      ).execute();

      expect(() =>
        sql
          .select([col("a.UserId")])
          .from(table("Users").as("u"))
          .innerJoin(table("Orders").as("o"))
          .on(col("u.Id").eq(col("o.UserId")))
          .as("a")
          .execute(),
      ).not.toThrow();

      expect(() =>
        sql
          .select([col("o.Id")])
          .from(table("Users").as("u"))
          .innerJoin(table("Orders").as("o"))
          .on(col("u.Id").eq(col("o.UserId")))
          .as("a")
          .execute(),
      ).toThrow(/No relation binding matches given relation name/i);

      expect(() =>
        sql
          .select([col("a.Id")])
          .from(table("Users").as("u"))
          .innerJoin(table("Orders").as("o"))
          .on(col("u.Id").eq(col("o.UserId")))
          .as("a")
          .execute(),
      ).toThrow(/ambiguous/i);
    });
  });

  describe("cross-database table references", () => {
    it("selects from a table in another database", () => {
      const engine = freshEngine();
      const sql = createTestPostgresSql(engine);

      sql.createDatabase("DB1").execute();
      sql.createDatabase("DB2").execute();

      sql.useDatabase("DB2").execute();

      sql
        .createTable(
          ...createTableTestSpec("T1", {
            Id: {
              type: SQL_INTEGER,
              nullable: false,
            },
          }),
        )
        .execute();

      sql.insertInto("T1", ["Id"]).values([[42]]).execute();

      // Select from DB2 while DB1 is the current database.
      sql.useDatabase("DB1").execute();

      const result = sql
        .select("*")
        .from("DB2.T1")
        .execute();

      expect(result).toHaveLength(1);
      expect(result[0].rows.map((row) => row.values)).toEqual([[42]]);
    });
  });
});