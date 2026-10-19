import { Dialect } from "./dialect/Dialect.js";
import { EngineRegistry } from "./engine/EngineRegistry.js";
import { DiscoveryResults } from "./mapping/discovery/DiscoveryResults.js";
import { exampleChainRegistry_DiscoveryDefinition } from "./mapping/discovery/example.js";
import { runExampleImport } from "./mapping/import/example.js";
// import {
//   exampleChainRegistry_buildDatabase,
//   //exampleChainRegistry_ImportDefinition,
// } from "./utils/initializeChainReg.js";
//import { runExampleValidation } from "./validation/example.js";

console.log("This is the main file");

EngineRegistry.getInstance().newEngine("DEFAULT", Dialect.Postgres);

const discoveryRoot = exampleChainRegistry_DiscoveryDefinition();
//const importMapping = exampleChainRegistry_ImportDefinition();

//exampleChainRegistry_buildDatabase(discoveryRoot, importMapping);

const discoveryResults: DiscoveryResults = discoveryRoot.discover();

runExampleImport(
  discoveryResults,
  "DEFAULT"
);

//runExampleValidation("DEFAULT");

//getChainRegContents();