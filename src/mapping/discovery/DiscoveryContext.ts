import type { DiscoveryValue } from "../value/DiscoveryValue.js";
import type {
  DiscoveryIdentity,
  DiscoveryIdentityPart,
} from "./DiscoveryIdentity.js";
import type { StructuredValue } from "../value/StructuredValue.js";

export class DiscoveryContext {
  constructor(
    readonly current: DiscoveryValue,
    readonly captures: ReadonlyMap<string, StructuredValue> = new Map(),
    readonly identity: DiscoveryIdentity,
    readonly payload: StructuredValue = null,
  ) {}

  withCurrent(current: DiscoveryValue): DiscoveryContext {
    return new DiscoveryContext(
      current,
      this.captures,
      this.identity,
      this.payload,
    );
  }

  withCapture(name: string, value: StructuredValue): DiscoveryContext {
    return new DiscoveryContext(
      this.current,
      new Map([...this.captures, [name, value]]),
      this.identity,
      this.payload,
    );
  }

  withIdentityParts(parts: readonly DiscoveryIdentityPart[]): DiscoveryContext {
    return new DiscoveryContext(
      this.current,
      this.captures,
      this.identity.append(...parts),
      this.payload,
    );
  }

  withPayload(payload: StructuredValue): DiscoveryContext {
    return new DiscoveryContext(
      this.current,
      this.captures,
      this.identity,
      payload,
    );
  }
}
