import type { StructuredValue } from "../value/StructuredValue.js";
import { DiscoveryIdentity } from "./DiscoveryIdentity.js";
import type { DiscoveryMetadata } from "./DiscoveryMetadata.js";
import type { DiscoveryPayload } from "./DiscoveryPayload.js";

export type DiscoveryResultId = number & {
  readonly __brand: "discoveryResult";
};

export class DiscoveryResult {
  constructor(
    readonly resultId: DiscoveryResultId,
    readonly parentResultId: DiscoveryResultId | null,
    readonly nodeType: string,
    readonly identity: DiscoveryIdentity,
    readonly value: DiscoveryPayload,
    readonly metadata: DiscoveryMetadata,
    readonly captures: Map<string, StructuredValue>,
  ) {}
}