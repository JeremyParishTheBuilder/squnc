// import { type DiscoveryResult } from "../discovery/DiscoveryResult.js";
// import type { ImportMapping } from "../import/oldTypes/ImportMapping.js";
// import { type ImportResult } from "../import/oldTypes/ImportResult.js";
//import { ObjectImporter } from "../import/ObjectImporter.js";

// export function collectImports(
//   discoveries: readonly DiscoveryResult[],
//   importMappings: readonly ImportMapping[],
// ): ImportResult[] {
//   const results: ImportResult[] = [];

//   const objectImporter = new ObjectImporter();

//   for (const root of discoveries) {
//     for (const importMapping of importMappings) {
//       results.push(...objectImporter.import(root, importMapping));
//     }
//   }

//   return results;
// }
