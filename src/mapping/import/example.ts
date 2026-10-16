import { col } from "../../ast/dsl.js";
import { EngineRegistry } from "../../engine/EngineRegistry.js";
import type { PostgresInputBatch } from "../../input/PostgresInputBatch.js";
import type { DiscoveryResults } from "../discovery/DiscoveryResults.js";
import { ImportRuleset } from "./ImportRuleset.js";

const sql = EngineRegistry.getInstance().engine().input() as PostgresInputBatch;

const exampleChainRegistry_importRuleset: ImportRuleset =
  ImportRuleset.create({
    name: "Chain Registry Test Import",
  })
    .withInstruction({
      name: "Chain Directories",
      description: "Import all chain directories, which may be incomplete/stubs.",
      statements: [
        sql.createTable("Chains").asStatement(),
        sql
          .insertInto("Chains")
          .select("*") // TODO, test expresions on metadata properties like baseame() and on references to captured values 
          .from("discovery") // or must it be named discovery_result?
          .where(
            col("nodeType").eq("chainDirectory")
          )
          .asStatement(),
      ],
    });

export function runExampleImport(
  engineName?: string,
  databaseName?: string,
  discoveryResults?: DiscoveryResults, // TODO, get a discovery run example that I can pass here via index.ts
) {
  const report = ImportEngine.import({ // TODO, need to write ImportEngine and its static import function
    engine: EngineRegistry.getInstance().engine(engineName),
    databaseName: databaseName ?? "Test Registry",
    discovery: discoveryResults,
    ruleset: exampleChainRegistry_importRuleset,
  });

  console.log(JSON.stringify(report, null, 2));
}
