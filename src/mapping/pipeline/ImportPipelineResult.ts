import { type Databases } from "../../relational/Databases.js";
import { type DiscoveryResult } from "../discovery/DiscoveryResult.js";
import { type DatabaseSchema } from "../schema/DatabaseSchema.js";
import { type ImportResult } from "../import/ImportResult.js";
import type { DiscoveryResults } from "../discovery/DiscoveryResults.js";

export interface ImportPipelineResult {
  readonly discoveries: DiscoveryResults;
  readonly imports: readonly ImportResult[];
  readonly schema: DatabaseSchema;
  readonly databases: Databases;
}
