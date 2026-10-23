import { DiscoveryIdentity } from "../../src/mapping/discovery/DiscoveryIdentity.ts";
import type { DiscoveryResultId } from "../../src/mapping/discovery/DiscoveryResult.ts";
import { DiscoveryResults } from "../../src/mapping/discovery/DiscoveryResults.ts";

export function createTestDiscoveryResults(
  results: readonly {
    parentResultId: number | null,
    nodeType: string,
  }[]
): DiscoveryResults {
  const discoveryResults = new DiscoveryResults();

  results.forEach(result =>
    discoveryResults.createDiscoveryResult(
      result.parentResultId as DiscoveryResultId,
      result.nodeType,
      new DiscoveryIdentity([0]),
      {},
      {},
      new Map(),
    )
  );

  return discoveryResults;
}