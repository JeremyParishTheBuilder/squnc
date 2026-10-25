import { describe, expect, it } from "vitest";
import type { PostgresInputBatch } from "../../../src/input/PostgresInputBatch.js";
import { EngineRegistry } from "../../../src/engine/EngineRegistry.js";
import { Dialect } from "../../../src/dialect/Dialect.js";
import { MappingOrchestrator } from "../../../src/mapping/pipeline/MappingOrchestrator.js";
import { exampleChainRegistry_DiscoveryDefinition } from "../../../src/mapping/discovery/example.js";
import { exampleChainRegistry_ImportRuleset } from "../../../src/mapping/import/example.js";
import { SQL_VARCHAR } from "../../../src/types/SqlType.ts";
import type { InlineColumnSpec } from "../../../src/relational/Column.js";
import { ImportRuleset } from "../../../src/mapping/import/ImportRuleset.ts";

describe("MappingOrchestrator", () => {
  it("discovers the test registry and imports chain directory names", () => {
    const engineName = "MAPPING_ORCHESTRATOR_TEST";

    const registry = EngineRegistry.getInstance();
    registry.newEngine(engineName, Dialect.Postgres);

    const engine = registry.engine(engineName);
    const mapping = new MappingOrchestrator();

    const discoveryRoot =
      exampleChainRegistry_DiscoveryDefinition();

    mapping.discovery(discoveryRoot);

    const report = mapping.import({
      engine,
      databaseName: "Test Registry",
      ruleset: (sql) =>
        exampleChainRegistry_ImportRuleset(
          sql as PostgresInputBatch,
        ),
    });

    // Verify that the import completed and committed.
    expect(report.passed).toBe(true);
    expect(report.committed).toBe(true);
    expect(report.instructionResults.map(
      (result) => result.status,
    )).toEqual(["succeeded"]);

    // Verify the actual imported data.
    const sql = engine.input() as PostgresInputBatch;

    sql.useDatabase("test registry").execute();

    const result = sql
      .select("*")
      .from("Chains")
      .execute();

    const chainNames = result[0].rows
      .map((row) => row.values[0] as string)
      .sort();

    expect(chainNames).toEqual([
      "cosmoshub",
      "ethereum",
      "ethereumtestnet",
      "osmosis",
      "osmosistestnet",
    ]);
  });

  it("reports an import instruction failure", () => {
    const engineName = "MAPPING_IMPORT_FAILURE_TEST";

    const registry = EngineRegistry.getInstance();
    registry.newEngine(engineName, Dialect.Postgres);

    const engine = registry.engine(engineName);
    const sql = engine.input() as PostgresInputBatch;

    sql.createDatabase("Test Registry").execute();
    sql.useDatabase("test registry").execute();

    sql.createTable("Existing", [
      {
        name: "name",
        type: SQL_VARCHAR,
        nullable: false,
      } as InlineColumnSpec,
    ]).execute();

    const mapping = new MappingOrchestrator();
    mapping.discovery(exampleChainRegistry_DiscoveryDefinition());

    const report = mapping.import<PostgresInputBatch>({
      engine,
      databaseName: "Test Registry",
      ruleset: (sql) =>
        ImportRuleset.create({
          name: "Intentional Import Failure",
        }).withInstruction({
          name: "Create Existing Table",
          statements: [
            sql.createTable("Existing", [
              {
                name: "name",
                type: SQL_VARCHAR,
                nullable: false,
              } as InlineColumnSpec,
            ]).asStatement(),
          ],
        }),
    });

    expect(report.passed).toBe(false);
    expect(report.committed).toBe(false);
    expect(report.instructionResults).toHaveLength(1);
    expect(report.instructionResults[0].status).toBe("failed");
    expect(report.instructionResults[0].failedStatementIndex).toBe(0);
  });

  it("rolls back changes made by earlier successful instructions", () => {
    const engineName = "MAPPING_IMPORT_ROLLBACK_TEST";

    const registry = EngineRegistry.getInstance();
    registry.newEngine(engineName, Dialect.Postgres);

    const engine = registry.engine(engineName);
    const sql = engine.input() as PostgresInputBatch;

    sql.createDatabase("Test Registry").execute();
    sql.useDatabase("test registry").execute();

    sql.createTable("Existing", [
      {
        name: "name",
        type: SQL_VARCHAR,
        nullable: false,
      } as InlineColumnSpec,
    ]).execute();

    const mapping = new MappingOrchestrator();
    mapping.discovery(exampleChainRegistry_DiscoveryDefinition());

    const report = mapping.import<PostgresInputBatch>({
      engine,
      databaseName: "Test Registry",
      ruleset: (sql) =>
        ImportRuleset.create({
          name: "Import Rollback Test",
        })
          .withInstruction({
            name: "Create Temporary Table",
            statements: [
              sql.createTable("Temporary", [
                {
                  name: "name",
                  type: SQL_VARCHAR,
                  nullable: false,
                } as InlineColumnSpec,
              ]).asStatement(),
            ],
          })
          .withInstruction({
            name: "Fail On Existing Table",
            statements: [
              sql.createTable("Existing", [
                {
                  name: "name",
                  type: SQL_VARCHAR,
                  nullable: false,
                } as InlineColumnSpec,
              ]).asStatement(),
            ],
          }),
    });

    expect(report.passed).toBe(false);
    expect(report.committed).toBe(false);
    expect(report.instructionResults.map(
      (result) => result.status,
    )).toEqual(["succeeded", "failed"]);

    // The first instruction succeeded, but its table should
    // no longer exist after the transaction was rolled back.
    const query = engine.input() as PostgresInputBatch;
    query.useDatabase("test registry").execute();

    expect(() =>
      query.select("*").from("Temporary").execute(),
    ).toThrow();
  });
});