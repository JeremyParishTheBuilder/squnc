import { type Databases } from "../../../relational/Databases.js";
import { DatabaseBuilder } from "../../schema/DatabaseBuilder.js";
//import { DiscoveryContext } from "../discovery/DiscoveryContext.js";
import { inferSchema } from "./inferSchema.js";
//import { ImportRowIdentity } from "../import/ImportRowIdentity.js";
import { type ImportPipelineResult } from "./ImportPipelineResult.js";
import { type ColumnValue } from "../../../types/ColumnValue.js";
import type { ImportRoot } from "../../import/oldTypes/ImportRoot.js";
//import { ObjectImporter } from "../import/ObjectImporter.js";
import type { ImportResult } from "../../import/oldTypes/ImportResult.js";
//import type { DiscoveryResult } from "../discovery/DiscoveryResult.js";
import { DiscoveryResults } from "../../discovery/DiscoveryResults.js";

export interface ImportPipelineSpec {
  readonly importRoots: readonly ImportRoot[];
  readonly databaseName: string;
  readonly existingDatabases: Databases;
  readonly sourceIdentity?: ColumnValue;
}

export class ImportPipeline {
  static build(spec: ImportPipelineSpec): ImportPipelineResult {
    const importResults: ImportResult[] = [];

    //const objectImporter = new ObjectImporter();

    let discoveryResults: DiscoveryResults;
    //let discoveryResults: DiscoveryResults = new DiscoveryResults;

    for (const importRoot of spec.importRoots) {
      //const nodeType = importRoot.discovery.node.spec.nodeType;

      discoveryResults = importRoot.discovery.discover();

      // Existing Import architecture is temporarily incompatible
      // with DiscoveryResults staging.
      // TODO

      // discoveryResults = importRoot.discovery.node.discover(
      //   discoveryResults,
      //   null,
      //   new DiscoveryContext(
      //     importRoot.discovery.physicalSource.open(),
      //     new Map(),
      //     ImportRowIdentity.from([spec.sourceIdentity ?? ""]),
      //   ),
      // );

      // const discoveryRoot = discoveryResults.find(
      //   (dr) => dr.nodeType === nodeType,
      // );

      // if (!discoveryRoot) {
      //   throw new Error(`No discovery result matching node type: ${nodeType}`);
      // }

      // importResults.push(
      //   //...objectImporter.import(discoveryRoot, importRoot.spec.mapping),
      //   ...objectImporter.import(discoveryResults, importRoot.spec.mapping), // discoveryResults is a guess
      // );
    }

    const schema = inferSchema(importResults);

    const databases = new DatabaseBuilder(
      spec.databaseName,
      schema,
      importResults,
    ).build(spec.existingDatabases);

    return {
      discoveries: discoveryResults!,
      schema,
      imports: importResults,
      databases,
    };
  }
}
