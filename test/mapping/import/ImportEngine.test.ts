import { describe, it, expect } from 'vitest';
import { createTestPostgresSql, freshEngine } from '../../utils/engineHelpers.js';
import { SQL_INTEGER, SQL_VARCHAR } from '../../../src/types/SqlType.js';
import { createTestDiscoveryResults } from '../../utils/importHelpers.js';
import { createTableTestSpec } from '../../utils/buildSchema.js';
import { discovery, property } from '../../../src/ast/dsl.ts';
import { ImportEngine } from '../../../src/mapping/import/ImportEngine.js';
import { ImportRuleset } from '../../../src/mapping/import/ImportRuleset.js';
import type { PostgresInputBatch } from '../../../src/input/PostgresInputBatch.ts';
import type { InputBatch } from '../../../src/input/InputBatch.ts';

describe("ImportEngine::import", () => {
  it("imports rows from DiscoveryResults and commits the transaction", () => {
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

    const ruleset =(
      sql: PostgresInputBatch,
    ) => { return ImportRuleset
      .create({ name: "Test Import" })
      .withInstruction({
        name: "Import Chain Directories",
        statements: [
          sql
            .createTable(
              ...createTableTestSpec("Chains", {
                NodeType: {
                  type: SQL_VARCHAR,
                  nullable: false,
                },
              }),
            )
            .asStatement(),

          sql
            .insertInto("Chains", ["NodeType"])
            .select(
              sql
              .select([property("nodeType")])
              .from(discovery())
              .where(property("nodeType").eq("chainDirectory"))
            )
            .asStatement(),
        ],
      });
    }

    const report = ImportEngine.import({
      engine,
      databaseName: "DB1",
      discovery: discoveryResults,
      ruleset: ruleset as (sql: InputBatch) => ImportRuleset,
    });

    expect(report.passed).toBe(true);
    expect(report.committed).toBe(true);
    expect(report.instructionResults).toHaveLength(1);
    expect(report.instructionResults[0].status).toBe("succeeded");  

    const result = sql
      .select("*")
      .from("Chains")
      .execute();
      
    expect(result[0].rows.map((row) => row.values))
      .toEqual([["chainDirectory"]]);
  });

  it("reports the failing instruction and rolls back the entire import", () => {
    const engine = freshEngine();
    const sql = createTestPostgresSql(engine);

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    const createTemporaryTable = sql
      .createTable(
        ...createTableTestSpec("Temporary", {
          Id: {
            type: SQL_INTEGER,
            nullable: false,
          },
        }),
      )
      .asStatement();

    const failingStatement = sql
      .alterTable("MissingTable")
      .addConstraint("MissingConstraint")
      .unique(["Id"])
      .asConstraintStatement();

    const createNeverCreatedTable = sql
      .createTable(
        ...createTableTestSpec("NeverCreated", {
          Id: {
            type: SQL_INTEGER,
            nullable: false,
          },
        }),
      )
      .asStatement();

    const ruleset = () => {
      return ImportRuleset
      .create({ name: "Failing Import" })
      .withInstruction({
        name: "Create Temporary Table",
        statements: [createTemporaryTable],
      })
      .withInstruction({
        name: "Fail on Missing Table",
        statements: [failingStatement],
      })
      .withInstruction({
        name: "Must Not Execute",
        statements: [createNeverCreatedTable],
      });
    }

    const report = ImportEngine.import({
      engine,
      databaseName: "DB1",
      ruleset: ruleset as (sql: InputBatch) => ImportRuleset,
    });

    expect(report.passed).toBe(false);
    expect(report.failed).toBe(true);
    expect(report.committed).toBe(false);

    expect(report.instructionResults).toHaveLength(3);
    expect(report.instructionResults[0].status).toBe("succeeded");
    expect(report.instructionResults[1].status).toBe("failed");
    expect(report.instructionResults[2].status).toBe("notExecuted");

    const failedResult = report.instructionResults[1];

    expect(failedResult.instruction.name).toBe("Fail on Missing Table");
    expect(failedResult.failedStatementIndex).toBe(0);
    expect(failedResult.error).toBeDefined();
    expect(failedResult.error).toMatch(/MissingTable/i);

    const database = engine.databases.requireByName("DB1");

    expect(database.tables.getByName("Temporary")).toBeUndefined();
    expect(database.tables.getByName("NeverCreated")).toBeUndefined();
  });

  it("reports a missing discovery source and rolls back", () => {
    const engine = freshEngine();
    const sql = createTestPostgresSql(engine);

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    const ruleset = (
      sql: PostgresInputBatch,
    ) => { return ImportRuleset
      .create({ name: "Missing Source Import" })
      .withInstruction({
        name: "Read Discovery",
        statements: [
          sql
            .select("*")
            .from(discovery())
            .asStatement(),
        ],
      });
    }

    const report = ImportEngine.import({
      engine,
      databaseName: "DB1",
      ruleset: ruleset as (sql: InputBatch) => ImportRuleset,
    });

    expect(report.passed).toBe(false);
    expect(report.committed).toBe(false);
    expect(report.instructionResults[0].status).toBe("failed");
    expect(report.instructionResults[0].error)
      .toMatch(/Discovery source requires DiscoveryResults/i);
  });

  it("reports the failing statement index and rolls back the instruction", () => {
    const engine = freshEngine();
    const sql = createTestPostgresSql(engine);

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    const ruleset = (sql: PostgresInputBatch) =>
      ImportRuleset.create({ name: "Statement Failure Test" })
        .withInstruction({
          name: "Two Statement Instruction",
          statements: [
            sql.createTable(
              ...createTableTestSpec("Temporary", {
                Id: { type: SQL_INTEGER, nullable: false },
              }),
            ).asStatement(),

            sql
              .alterTable("MissingTable")
              .addConstraint("MissingConstraint")
              .unique(["Id"])
              .asConstraintStatement(),
          ],
        })
        .withInstruction({
          name: "Should Not Execute",
          statements: [
            sql.createTable(
              ...createTableTestSpec("NeverCreated", {
                Id: { type: SQL_INTEGER, nullable: false },
              }),
            ).asStatement(),
          ],
        });

    const report = ImportEngine.import({
      engine,
      databaseName: "DB1",
      ruleset: ruleset as (sql: InputBatch) => ImportRuleset,
    });

    expect(report.passed).toBe(false);
    expect(report.committed).toBe(false);

    expect(report.instructionResults).toHaveLength(2);
    expect(report.instructionResults[0].status).toBe("failed");
    expect(report.instructionResults[0].failedStatementIndex).toBe(1);
    expect(report.instructionResults[0].error).toMatch(/MissingTable/i);
    expect(report.instructionResults[1].status).toBe("notExecuted");

    const database = engine.databases.requireByName("DB1");

    expect(database.tables.getByName("Temporary")).toBeUndefined();
    expect(database.tables.getByName("NeverCreated")).toBeUndefined();
  });

  it("successfully imports zero rows when no discovery results match", () => {
    const engine = freshEngine();
    const sql = createTestPostgresSql(engine);

    sql.createDatabase("DB1").execute();
    sql.useDatabase("DB1").execute();

    const discoveryResults = createTestDiscoveryResults([]);

    const ruleset = (sql: PostgresInputBatch) =>
      ImportRuleset.create({ name: "Empty Discovery Test" })
        .withInstruction({
          name: "Import Chain Directories",
          statements: [
            sql.createTable(
              ...createTableTestSpec("Chains", {
                NodeType: { type: SQL_VARCHAR, nullable: false },
              }),
            ).asStatement(),

            sql
              .insertInto("Chains", ["NodeType"])
              .select(
                sql
                  .select([property("nodeType")])
                  .from(discovery())
                  .where(property("nodeType").eq("chainDirectory")),
              )
              .asStatement(),
          ],
        });

    const report = ImportEngine.import({
      engine,
      databaseName: "DB1",
      discovery: discoveryResults,
      ruleset: ruleset as (sql: InputBatch) => ImportRuleset,
    });

    expect(report.passed).toBe(true);
    expect(report.committed).toBe(true);
    expect(report.instructionResults[0].status).toBe("succeeded");

    const result = sql.select("*").from("Chains").execute();

    expect(result[0].rows).toHaveLength(0);
  });
});