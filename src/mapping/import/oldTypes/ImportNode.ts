import { type DiscoveryResult } from "../../discovery/DiscoveryResult.js";
import { type ImportResult } from "./ImportResult.js";

export interface ImportNode {
  accepts(discovery: DiscoveryResult): boolean;

  import(discovery: DiscoveryResult): ImportResult[];
}
