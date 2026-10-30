import { EngineRegistry } from "../../engine/EngineRegistry.js";
import type { PostgresInputBatch } from "../../input/PostgresInputBatch.js";
import { DEFAULT_DISCOVERY_DATABASE_NAME } from "../discovery/DiscoveryDatabaseBuilder.js";
import { exampleChainRegistry_DiscoveryDefinition } from "../discovery/example.js";
import { exampleChainRegistry_ImportRuleset } from "../import/example.js";
import { MappingOrchestrator } from "./MappingOrchestrator.js";

export function runExampleMappingOrchestration(
  engineName: string = "DEFAULT",
  businessDatabaseName: string = "Test Registry",
  discoveryDatabaseName: string = DEFAULT_DISCOVERY_DATABASE_NAME,
) {
  const mapping = new MappingOrchestrator();

  const discoveryRoot = exampleChainRegistry_DiscoveryDefinition();
  mapping.discovery(discoveryRoot);

  const engine = EngineRegistry.getInstance().engine(engineName);

  mapping.buildBusinessDatabase(engine, businessDatabaseName);

  mapping.import<PostgresInputBatch>({
    engine,
    businessDatabaseName,
    discoveryDatabaseName,
    ruleset: exampleChainRegistry_ImportRuleset,
  });

  console.log(JSON.stringify(mapping.importReport, null, 2));
}
