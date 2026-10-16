import { type ColumnValue } from "../../types/ColumnValue.js";
import { type CaptureContext } from "./CaptureContext.js";
import type { DiscoveryValue } from "../value/DiscoveryValue.js";
import type { CaptureValue } from "../value/CaptureValue.js";
import type { DiscoveryIdentity, DiscoveryIdentityPart } from "./DiscoveryIdentity.js";
import type { DiscoveryResult } from "./DiscoveryResult.js";

export class DiscoveryContext implements CaptureContext {
  constructor(
    readonly current: DiscoveryValue,
    readonly captures: ReadonlyMap<string, CaptureValue> = new Map(),
    readonly identity: DiscoveryIdentity,
  ) {}

  withCurrent(current: DiscoveryValue): DiscoveryContext {
    return new DiscoveryContext(
      current,
      this.captures,
      this.identity,
    );
  }

  withCapture(name: string, value: CaptureValue): DiscoveryContext {
    return new DiscoveryContext(
      this.current,
      new Map([...this.captures, [name, value]]),
      this.identity,
    );
  }

  withIdentityParts(parts: readonly DiscoveryIdentityPart[]): DiscoveryContext {
    return new DiscoveryContext(
      this.current,
      this.captures,
      this.identity.append(...parts),
    );
  }
}
