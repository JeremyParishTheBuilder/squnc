import { col, discovery, json_value, property } from "../../ast/dsl.js";
import { EngineRegistry } from "../../engine/EngineRegistry.js";
import type { InputBatch } from "../../input/InputBatch.js";
import type { PostgresInputBatch } from "../../input/PostgresInputBatch.js";
import type { InlineColumnSpec } from "../../relational/Column.js";
import { SQL_VARCHAR } from "../../types/SqlType.js";
import { DiscoveryResults } from "../discovery/DiscoveryResults.js";
import { ImportEngine } from "./ImportEngine.js";
import { ImportRuleset } from "./ImportRuleset.js";

export const exampleChainRegistry_ImportRuleset = (
  sql: PostgresInputBatch,
) => {
  return ImportRuleset.create({
    name: "Chain Registry Test Import",
  })
  .withInstruction({
    name: "Create Database",
    description: "Test Registry database creation.",
    statements: [
      sql.createDatabase("Test Registry").asStatement(),
    ],
  })
  .withInstruction({
    name: "Chain Directories",
    description: "Import all chain directories, which may be incomplete/stubs.",
    statements: [
      sql.createTable("Chains",
        [
          {
            name: "chainDirectoryName",
            type: SQL_VARCHAR,
            nullable: false,
          } as InlineColumnSpec
        ]
      ).asStatement(),

      sql
        .insertInto("Chains", [
          "chainDirectoryName"
        ])
        .select(
          sql
          .select([
            json_value(property("value"), "$.basename"),
          ])
          .from(discovery())
          .where(
            col("nodeType").eq("chainDirectory")
          )
        )
        .asStatement(),
    ],
  });
}

export function runExampleImport(
  discoveryResults?: DiscoveryResults,
  engineName: string = "DEFAULT",
  databaseName?: string,
) {
  const report = ImportEngine.import({
    engine: EngineRegistry.getInstance().engine(engineName),
    databaseName: databaseName ?? "Test Registry",
    discovery: discoveryResults,
    ruleset: exampleChainRegistry_ImportRuleset as (sql: InputBatch) => ImportRuleset,
  });

  console.log(JSON.stringify(report, null, 2));
}
