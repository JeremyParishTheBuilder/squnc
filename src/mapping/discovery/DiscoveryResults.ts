import type { StructuredValue } from "../value/StructuredValue.js";
import type { DiscoveryIdentity } from "./DiscoveryIdentity.js";
import type { DiscoveryMetadata } from "./DiscoveryMetadata.js";
import type { DiscoveryPayload } from "./DiscoveryPayload.js";
import { DiscoveryResult, DiscoveryResultId } from "./DiscoveryResult.js";

export class DiscoveryResults {
  private readonly results = new Map<DiscoveryResultId, DiscoveryResult>();
  private readonly nodeTypes = new Set<string>();
  private nextResultId = 1;

  public getNextResultId(): DiscoveryResultId {
    return this.nextResultId++ as DiscoveryResultId;
  }

  public createDiscoveryResult(
    parentResultId: DiscoveryResultId | null,
    nodeType: string,
    identity: DiscoveryIdentity,
    value: DiscoveryPayload,
    metadata: DiscoveryMetadata,
    captures: Map<string, StructuredValue>,
  ): DiscoveryResult {
    const resultId = this.getNextResultId();

    const result = new DiscoveryResult(
      resultId,
      parentResultId,
      nodeType,
      identity,
      value,
      metadata,
      captures,
    );

    this.nodeTypes.add(nodeType);

    this.results.set(resultId, result);

    return result;
  }

  public getAll(): readonly DiscoveryResult[] {
    return [...this.results.values()];
  }

  public registerNodeTypes(nodeTypes: Iterable<string>): void {
    for (const nodeType of nodeTypes) {
      this.nodeTypes.add(nodeType);
    }
  }

  public getNodeTypes(): readonly string[] {
    return [...this.nodeTypes];
  }
}
