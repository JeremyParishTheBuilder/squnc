import type { CaptureValue } from "../value/CaptureValue.js";
import { DiscoveryValue } from "../value/DiscoveryValue.js";
import { DiscoveryIdentity } from "./DiscoveryIdentity.js";

export type DiscoveryResultId = number & {
  readonly __brand: "discoveryResult";
};

export class DiscoveryResult {
  constructor(
    readonly resultId: DiscoveryResultId,
    readonly parentResultId: DiscoveryResultId | null,
    readonly nodeType: string,
    readonly identity: DiscoveryIdentity,
    readonly value: DiscoveryValue,
    readonly captures: Map<string, CaptureValue>,
  ) {}
}