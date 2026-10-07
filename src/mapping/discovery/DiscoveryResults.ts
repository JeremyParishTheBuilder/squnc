import type { CaptureValue } from "../value/CaptureValue.js";
import type { DiscoveryValue } from "../value/DiscoveryValue.js";
import type { DiscoveryIdentity } from "./DiscoveryIdentity.js";
import { DiscoveryResult, DiscoveryResultId } from "./DiscoveryResult.js";

export class DiscoveryResults {
  private readonly results = new Map<DiscoveryResultId, DiscoveryResult>();
  private nextResultId = 1;

  public getNextResultId(): DiscoveryResultId {
    return this.nextResultId++ as DiscoveryResultId;
  }

  public createDiscoveryResult(
    parentResultId: DiscoveryResultId | null,
    nodeType: string,
    identity: DiscoveryIdentity,
    value: DiscoveryValue,
    captures: Map<string, CaptureValue>,
  ): DiscoveryResult {
    const resultId = this.getNextResultId();

    const result = new DiscoveryResult(
      resultId,
      parentResultId,
      nodeType,
      identity,
      value,
      captures,
    );

    this.results.set(resultId, result);

    return result;
  }

  public getAll(): readonly DiscoveryResult[] {
    return [...this.results.values()];
  }
}
