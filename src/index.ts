import { col } from "./ast/dsl.js";
import { Dialect } from "./dialect/Dialect.js";
import { EngineRegistry } from "./engine/EngineRegistry.js";
import type { PostgresInputBatch } from "./input/PostgresInputBatch.js";
import { exampleChainRegistry_DiscoveryDefinition } from "./mapping/discovery/example.js";
import { runExampleMappingOrchestration } from "./mapping/pipeline/example.js";
import { SchemaBuilder } from "./mapping/schema/SchemaBuilder.js";

console.log("This is the main file");

const registry = EngineRegistry.getInstance();
registry.newEngine("DEFAULT", Dialect.Postgres);

runExampleMappingOrchestration("DEFAULT", "Test Registry", "Discovery");

// TEST QUERY
const sql = registry.engine("DEFAULT").input() as PostgresInputBatch;

sql.useDatabase("test registry").execute();

// LIST OF DATABASE NAMES:
//console.log(registry.engine("DEFAULT").databases.databases);

console.log("chains:");
const chainsQueryResult = sql.select("*").from("Chains").execute();
console.log(chainsQueryResult[0].columns);
console.log(chainsQueryResult[0].rows);


console.log("key algos:");
const chainFile__key_algos = sql.select("*").from("chainFile__key_algos").execute();
console.log(chainFile__key_algos[0].columns);
console.log(chainFile__key_algos[0].rows);


// console.log("inspecting discovery payloads:");
// console.log("Query:");
// console.log(`sql.select([col("value")]).from("discovery.chainFile").execute();`);
// const discoveryPayload = sql.select([col("value")]).from("discovery.chainFile").execute();
// console.log("Columns:");
// console.log(discoveryPayload[0].columns);
// console.log("Rows:");
// discoveryPayload[0].rows.forEach(r => console.log(r.values));
// console.log("---");




// console.log("inspecting inferred schema:");
// const discoveryRoot = exampleChainRegistry_DiscoveryDefinition();
// const discoveryResults = discoveryRoot.discover();

// const builder = new SchemaBuilder();
// builder.observeDiscoveryResults(discoveryResults, "chainFile");

// for (const [tableName, table] of builder.schema.tables) {
//   console.log(`\nTable: ${tableName}`);
//   console.log(`  Parent: ${table.parentTableName ?? "(none)"}`);
//   console.log(`  Source path: ${table.sourcePath ?? "(none)"}`);
//   console.log(`  Observed rows: ${table.observedRows}`);
//   console.log("  Columns:");

//   for (const [columnName, column] of table.columns) {
//     console.log(
//       `    ${columnName}: type=${JSON.stringify(column.type)}, ` +
//       `nullable=${column.nullable}`,
//     );
//   }
// }


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

// VALIDATION
//import { runExampleValidation } from "./validation/example.js";
//runExampleValidation("DEFAULT");
