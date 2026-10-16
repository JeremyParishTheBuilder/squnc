import { DiscoveryIdentity } from "../../src/mapping/discovery/DiscoveryIdentity.ts";
import type { DiscoveryResultId } from "../../src/mapping/discovery/DiscoveryResult.ts";
import { DiscoveryResults } from "../../src/mapping/discovery/DiscoveryResults.ts";
import { ImportContext } from "../../src/mapping/import/ImportContext.ts";
import { ImportRowIdentity } from "../../src/mapping/import/ImportRowIdentity.ts";
import type { CaptureValue } from "../../src/mapping/value/CaptureValue.ts";

const discoveryResults = new DiscoveryResults();

//TODO, delete?
// export function createImportContext(
//   source: CaptureValue
// ): ImportContext {
//   const discovery = discoveryResults.createDiscoveryResult(
//     null,
//     "test",
//     new DiscoveryIdentity([]),
//     source,
//     new Map(),
//   );

//   return new ImportContext(
//     discovery,
//     ImportRowIdentity.empty(),
//     source,
//   );
// }

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
      new Map(),
    )
  );

  return discoveryResults;
}