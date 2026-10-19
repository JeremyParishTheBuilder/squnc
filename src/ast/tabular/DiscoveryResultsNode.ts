import type { DiscoveryResults } from "../../mapping/discovery/DiscoveryResults.js";
import { TabularExpressionNode } from "./TabularExpressionNode.js";

export class DiscoveryResultsNode extends TabularExpressionNode {
  readonly kind = "discovery";

  constructor(public readonly discoveryResults?: DiscoveryResults) {
    super();
  }
}