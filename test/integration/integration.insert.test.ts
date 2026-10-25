import { describe, it, expect } from 'vitest';
import { createTestPostgresSql } from '../utils/engineHelpers.ts';
import { col, table } from '../../src/ast/dsl.ts';
import { SQL_DECIMAL, SQL_VARCHAR } from '../../src/types/SqlType.ts';
import { createTableTestSpec } from '../utils/buildSchema.ts';

describe("Integration::insert", () => {
  it("rejects duplicate primary keys", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();

    sql.useDatabase("DB1").execute();

    sql.begin().execute();

    sql.createTable(...createTableTestSpec("Users", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
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
      ])
      .execute();
    
    sql.commit().execute();

    expect(() => {
      sql
        .insertInto("Users", ["Id", "Name"])
        .values([
          [1, "Bob"],
        ])
        .execute();
    }).toThrow();
  });

  it("rejects inserts with missing foreign key parents", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();

    sql.useDatabase("DB1").execute();

    sql.begin().execute();

    sql.createTable(...createTableTestSpec("Users", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
    })).execute();

    sql.createTable(...createTableTestSpec("Posts", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      UserId: {
        type: SQL_DECIMAL,
        nullable: false,
      },
    })).execute();

    sql.alterTable("Posts")
      .addConstraint("Posts_FK")
      .foreignKey(["UserId"])
      .references("Users", ["Id"])
      .execute();

    sql.commit().execute();

    expect(() => {
      sql
        .insertInto("Posts", ["Id", "UserId"])
        .values([
          [1, 999],
        ])
        .execute();
    }).toThrow();
  });

  it('rejects inserts violating checks', () => {

    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();

    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Users", {
      Age: {
        type: SQL_DECIMAL,
        nullable: false,
      },
    })).execute();

    sql.alterTable("Users")
      .addConstraint("CHK_Adult")
      .check(
        col("Age").gte(18)
      )
      .execute();

    expect(() => {
      sql
        .insertInto("Users", ["Age"])
        .values([
          [10]
        ])
        .execute();
    }).toThrow();
  });

  it('allows inserts satisfying checks', () => {

    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();

    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Users", {
      Age: {
        type: SQL_DECIMAL,
        nullable: false,
      },
    })).execute();

    sql.alterTable("Users")
      .addConstraint("CHK_Adult")
      .check(
        col("Age").gte(18)
      )
      .execute();

    expect(() => {
      sql
        .insertInto("Users", ["Age"])
        .values([
          [20]
        ])
        .execute();
    }).not.toThrow();
  });

  it('allows insert using a TableReferenceNode', () => {

    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();

    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Users", {
      Age: {
        type: SQL_DECIMAL,
        nullable: false,
      },
    })).execute();

    sql.alterTable("Users")
      .addConstraint("CHK_Adult")
      .check(
        col("Age").gte(18)
      )
      .execute();

    expect(() => {
      sql
        .insertInto(table("Users"), ["Age"])
        .values([
          [20]
        ])
        .execute();
    }).not.toThrow();
  });

  it("allows mutually-referencing rows to be inserted in a single statement", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.begin().execute();

    sql.createTable(...createTableTestSpec("Employees", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      ManagerId: {
        type: SQL_DECIMAL,
        nullable: false,
      },
    })).execute();

    sql.alterTable("Employees")
      .addConstraint("FK1")
      .foreignKey(
        ["ManagerId"]
      ).references(
        "Employees",
        ["Id"],
      )
      .execute();

    sql.commit().execute();

    expect(() => {
      sql.begin().execute();

      sql
        .insertInto("Employees", ["Id", "ManagerId"])
        .values([
          [1, 2],
          [2, 1],
        ])
        .execute();

      sql.commit().execute();
    }).not.toThrow();

    expect(
      sql.select("*").from("Employees").execute()[0].rows
    ).toEqual([
      { index: 0, values: [1, 2] },
      { index: 1, values: [2, 1] },
    ]);
  });

  it("uses the column default when an INSERT omits the column", () => {
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
        nullable: false,
        defaultValue: "Anonymous",
      },
    })).execute();

    sql
      .insertInto("Users", ["Id"])
      .values([[1]])
      .execute();

    const results = sql
      .select("*")
      .from("Users")
      .execute();

    expect(results[0].rows).toEqual([
      {
        index: 0,
        values: [1, "Anonymous"],
      },
    ]);
  });

  it("uses DEFAULT explicitly in an insert", () => {
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
        nullable: false,
        defaultValue: "Anonymous",
      },
    })).execute();

    sql
      .insertInto("Users", ["Id", "Name"])
      .values([
        [1, sql.DEFAULT],
      ])
      .execute();

    const results = sql
      .select("*")
      .from("Users")
      .execute();

    expect(results[0].rows).toEqual([
      {
        index: 0,
        values: [1, "Anonymous"],
      },
    ]);
  });

  it("uses CURRENT_TIMESTAMP in an insert", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Users", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      UpdatedAt: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    sql
      .insertInto("Users", ["Id", "UpdatedAt"])
      .values([
        [1, sql.CURRENT_TIMESTAMP],
      ])
      .execute();

    const results = sql
      .select("*")
      .from("Users")
      .execute();

    const value = results[0].rows[0].values[1];

    expect(typeof value).toBe("string");
    expect(value).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("uses NOW() in an insert", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Users", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      UpdatedAt: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    sql
      .insertInto("Users", ["Id", "UpdatedAt"])
      .values([
        [1, sql.NOW()],
      ])
      .execute();

    const results = sql
      .select("*")
      .from("Users")
      .execute();

    const value = results[0].rows[0].values[1];

    expect(typeof value).toBe("string");
    expect(value).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("rejects SQL functions not supported by the dialect", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Users", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      UpdatedAt: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    expect(() =>
      sql
        .insertInto("Users", ["Id", "UpdatedAt"])
        .values([
          [1, sql.GETDATE()],
        ])
        .execute(),
    ).toThrow(/not allowed/i);
  });

  it("uses DEFAULT to generate an auto-incrementing value", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Users", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
        autoIncrementStart: 1,
        autoIncrementStep: 1,
      },
      Name: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    sql
      .insertInto("Users", ["Id", "Name"])
      .values([
        [sql.DEFAULT, "Alice"],
      ])
      .execute();

    sql
      .insertInto("Users", ["Id", "Name"])
      .values([
        [sql.DEFAULT, "Bob"],
      ])
      .execute();

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
});

describe("Integration::insertSelect", () => {
  it("inserts rows selected from another table", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Source", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      OldName: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    sql.createTable(...createTableTestSpec("Destination", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      Name: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    sql
      .insertInto("Source", ["Id", "OldName"])
      .values([
        [1, "Alice"],
        [2, "Bob"],
      ])
      .execute();

    sql
      .insertInto("Destination", ["Id", "Name"])
      .select(
        sql
        .select([
          col("Id"),
          col("OldName"),
        ])
        .from("Source")
      )
      .execute();

    const results = sql
      .select("*")
      .from("Destination")
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

  it("accepts a separately constructed query statement", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Source", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      OldName: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    sql.createTable(...createTableTestSpec("Destination", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      Name: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    sql
      .insertInto("Source", ["Id", "OldName"])
      .values([
        [1, "Alice"],
        [2, "Bob"],
      ])
      .execute();

    sql
      .insertInto("Destination", ["Id", "Name"])
      .select(
        sql
        .select([
          col("Id"),
          col("OldName"),
        ])
        .from("Source")
      )
      .execute();

    const results = sql
      .select("*")
      .from("Destination")
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

  it("inserts only rows selected by the query", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Source", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      OldName: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    sql.createTable(...createTableTestSpec("Destination", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      Name: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    sql
      .insertInto("Source", ["Id", "OldName"])
      .values([
        [1, "Alice"],
        [2, "Bob"],
        [3, "Carol"],
      ])
      .execute();

    sql
      .insertInto("Destination", ["Id", "Name"])
      .select(
        sql
        .select([
          col("Id"),
          col("OldName"),
        ])
        .from("Source")
        .where(
          col("id").gte(2)
        )
      )
      .execute();

    const results = sql
      .select("*")
      .from("Destination")
      .execute();

    expect(results[0].rows).toEqual([
      {
        index: 0,
        values: [2, "Bob"],
      },
      {
        index: 1,
        values: [3, "Carol"],
      },
    ]);
  });

  it("rejects a query whose column count does not match the target", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Source", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      OldName: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    sql.createTable(...createTableTestSpec("Destination", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      Name: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    expect(() => {
      sql
        .insertInto("Destination", ["Id", "Name"])
        .select(
          sql
          .select([col("Id")])
          .from("Source")
        ).execute();
    }).toThrow(
      "Column length mismatch between query statement and target columns",
    );
  });

  it("rejects a query whose column types do not match the target", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Source", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      OldValue: {
        type: SQL_DECIMAL,
        nullable: false,
      },
    })).execute();

    sql.createTable(...createTableTestSpec("Destination", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      Name: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    expect(() => {
      sql
        .insertInto("Destination", ["Id", "Name"])
        .select(
          sql
          .select([col("Id"), col("OldValue")])
          .from("Source")
        )
        .execute();
    }).toThrow(
      "Query column type does not match target column type",
    );
  });

  it("inserts rows from a union all query", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.begin().execute();

    sql.createTable(...createTableTestSpec("SourceA", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      Name: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    sql.createTable(...createTableTestSpec("SourceB", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      Name: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    sql.createTable(...createTableTestSpec("Destination", {
      Id: {
        type: SQL_DECIMAL,
        nullable: false,
        primaryKey: true,
      },
      Name: {
        type: SQL_VARCHAR,
        nullable: false,
      },
    })).execute();

    sql.commit().execute();

    sql.begin().execute();

    sql
      .insertInto("SourceA", ["Id", "Name"])
      .values([
        [1, "Alice"],
        [2, "Bob"],
      ])
      .execute();

    sql
      .insertInto("SourceB", ["Id", "Name"])
      .values([
        [3, "Carol"],
        [4, "Dave"],
      ])
      .execute();

    sql.commit().execute();

    sql
      .insertInto("Destination", ["Id", "Name"])
      .select(
        sql
          .select([col("Id"), col("Name")])
          .from("SourceA")
          .unionAll(
            sql
              .select([col("Id"), col("Name")])
              .from("SourceB")
          )
      )
      .execute();

    const results = sql
      .select("*")
      .from("Destination")
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
        index: 2,
        values: [3, "Carol"],
      },
      {
        index: 3,
        values: [4, "Dave"],
      },
    ]);
  });

  it("rejects finalizing an inner query as a standalone statement", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Source", {
      Id: { type: SQL_DECIMAL, nullable: false },
    })).execute();

    sql.createTable(...createTableTestSpec("Destination", {
      Id: { type: SQL_DECIMAL, nullable: false },
    })).execute();

    const innerQuery = sql
      .insertInto("Destination", ["Id"])
      .select([col("Id")])
      .from("Source");

    expect(() => innerQuery.asStatement())
      .toThrow("Not allowed to finalize inner statement");
  });

  it("allows a standalone query to be finalized as a statement", () => {
    const sql = createTestPostgresSql();

    const statement = sql
      .select([col("Id")])
      .from("Source")
      .asStatement();

    expect(statement.kind).toBe("select");
  });

  it("allows an inner query to be finalized as an insert-select source", () => {
    const sql = createTestPostgresSql();

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    sql.createTable(...createTableTestSpec("Source", {
      Id: { type: SQL_DECIMAL, nullable: false },
    })).execute();

    sql.createTable(...createTableTestSpec("Destination", {
      Id: { type: SQL_DECIMAL, nullable: false },
    })).execute();

    sql.insertInto("Source", ["Id"]).values([[1], [2]]).execute();

    expect(() =>
      sql
        .insertInto("Destination", ["Id"])
        .select(
          sql
            .select([col("Id")])
            .from("Source"),
        )
        .execute(),
    ).not.toThrow();

    const result = sql.select("*").from("Destination").execute();

    expect(result[0].rows.map((row) => row.values))
      .toEqual([[1], [2]]);
  });
});