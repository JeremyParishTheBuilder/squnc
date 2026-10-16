import type { Engine } from "../../engine/Engine.js";
import type { DiscoveryResults } from "../discovery/DiscoveryResults.js";
import type { ImportRuleset } from "./ImportRuleset.js";

export interface ImportEngineSpec {
  engine: Engine;
  databaseName: string;
  discovery: DiscoveryResults;
  ruleset: ImportRuleset;
}