import { EngineRegistry } from "../../engine/EngineRegistry.js";
import { exampleChainRegistry_DiscoveryDefinition } from "../discovery/example.js";
import { exampleChainRegistry_ImportRuleset } from "../import/example.js";
import { MappingOrchestrator } from "./MappingOrchestrator.js";

export function runExampleMappingOrchestration(
  engineName: string = "DEFAULT",
  databaseName: string = "Test Registry",
) {
  const mapping = new MappingOrchestrator();

  const discoveryRoot = exampleChainRegistry_DiscoveryDefinition();
  mapping.discovery(discoveryRoot);

  const engine = EngineRegistry.getInstance().engine(engineName);

  mapping.import({
    engine,
    databaseName,
    ruleset: exampleChainRegistry_ImportRuleset,
  });

  console.log(JSON.stringify(mapping.importReport, null, 2));
}
