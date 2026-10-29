import { collectNodeTypes } from "./collectNodeTypes.js";
import { DiscoveryContext } from "./DiscoveryContext.js";
import { DiscoveryIdentity } from "./DiscoveryIdentity.js";
import type { DiscoveryNode } from "./DiscoveryNode.js";
import { DiscoveryResults } from "./DiscoveryResults.js";
import type { DiscoverySource } from "./DiscoverySource.js";

export class DiscoveryRoot {
  constructor(
    public readonly physicalSource: DiscoverySource,
    public readonly node: DiscoveryNode,
  ) {}

  discover(): DiscoveryResults {
    const discoveryResults = new DiscoveryResults();

    discoveryResults.registerNodeTypes(collectNodeTypes(this.node));

    const current = this.physicalSource.open();

    const context = new DiscoveryContext(
      current,
      new Map(),
      new DiscoveryIdentity([]),
      {},
    );

    this.node.discover(discoveryResults, null, context);

    return discoveryResults;
  }
}
