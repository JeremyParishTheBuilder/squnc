import { json_value, property } from "../../ast/dsl.js";
import { EngineRegistry } from "../../engine/EngineRegistry.js";
import type { PostgresInputBatch } from "../../input/PostgresInputBatch.js";
import type { InlineColumnSpec } from "../../relational/Column.js";
import { SQL_VARCHAR } from "../../types/SqlType.js";
import { ImportEngine } from "./ImportEngine.js";
import { ImportRuleset } from "./ImportRuleset.js";

export const exampleChainRegistry_ImportRuleset = (sql: PostgresInputBatch) => {
  return ImportRuleset.create({
    name: "Chain Registry Test Import",
  }).withInstruction({
    name: "Chain Directories",
    description: "Import all chain directories, which may be incomplete/stubs.",
    statements: [
      sql
        .createTable("Chains", [
          {
            name: "chainDirectoryName",
            type: SQL_VARCHAR,
            nullable: false,
          } as InlineColumnSpec,
        ])
        .asStatement(),

      sql
        .insertInto("Chains", ["chainDirectoryName"])
        .select(
          sql
            .select([json_value(property("metadata"), "$.source.basename")])
            .from("discovery.chainDirectory"),
        )
        .asStatement(),
    ],
  });
};

export function runExampleImport(
  engineName: string = "DEFAULT",
  discoveryDatabaseName: string = "Discovery",
  businessDatabaseName: string = "Test Registry",
) {
  const report = ImportEngine.import({
    engine: EngineRegistry.getInstance().engine(engineName),
    discoveryDatabaseName,
    businessDatabaseName,
    ruleset: exampleChainRegistry_ImportRuleset,
  });

  console.log(JSON.stringify(report, null, 2));
}
