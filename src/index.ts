import { Dialect } from "./dialect/Dialect.js";
import { EngineRegistry } from "./engine/EngineRegistry.js";
import type { PostgresInputBatch } from "./input/PostgresInputBatch.js";

import { runExampleMappingOrchestration } from "./mapping/pipeline/example.js";

//import { exampleChainRegistry_DiscoveryDefinition } from "./mapping/discovery/example.js";
// import {
//   exampleChainRegistry_ImportRuleset,
//   runExampleImport,
// } from "./mapping/import/example.js";
//import { MappingOrchestrator } from "./mapping/pipeline/MappingOrchestrator.js";
//import { runExampleValidation } from "./validation/example.js";

console.log("This is the main file");

const registry = EngineRegistry.getInstance();
registry.newEngine("DEFAULT", Dialect.Postgres);

runExampleMappingOrchestration("DEFAULT", "Test Registry");

// VALIDATION QUERY
const sql = registry.engine("DEFAULT").input() as PostgresInputBatch;

sql.useDatabase("test registry").execute();

console.log("chains:");
const chainsQueryResult = sql.select("*").from("Chains").execute();
console.log(chainsQueryResult[0].columns);
console.log(chainsQueryResult[0].rows);
// const tablesMap = result.databases.requireByName("Test Registry").tables;
// for (const table of tablesMap.values()) {
//   console.log(table.name);
//   if (table.name === "Chains") {
//     for (const column of table.columns.values()) {
//       console.log(column.name);
//     }
//   }
//   if (table.name === "Images") {
//     for (const column of table.columns.values()) {
//       console.log(column.name);
//     }
//   }
// }

// const engine = registry.engine("DEFAULT");
//const sql = engine.input() as PostgresInputBatch;

// const mapping = new MappingOrchestrator();

// const discoveryRoot = exampleChainRegistry_DiscoveryDefinition();
//const discoveryResults = discoveryRoot.discover();

//const importRuleset = () => exampleChainRegistry_ImportRuleset(sql);

// mapping.discovery(discoveryRoot);
// mapping.import({
//   engine,
//   databaseName: "Test Registry",
//   ruleset: (sql) =>
//     exampleChainRegistry_ImportRuleset(sql as PostgresInputBatch),
// });

// runExampleImport(
//   discoveryResults,
//   "DEFAULT"
// );

// mapping.discovery(discoveryRoot);
// mapping.import({
//   engine,
//   databaseName: "Test Registry",
//   ruleset: importRuleset as (sql: InputBatch) => ImportRuleset,
// })

//runExampleValidation("DEFAULT");
