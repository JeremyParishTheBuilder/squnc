import type { PrimitiveValue } from "../value/StructuredValue.js";

export type DiscoveryIdentityPart = PrimitiveValue;

export class DiscoveryIdentity {
  constructor(readonly parts: readonly DiscoveryIdentityPart[]) {}

  static empty(): DiscoveryIdentity {
    return new DiscoveryIdentity([]);
  }

  append(...parts: readonly DiscoveryIdentityPart[]): DiscoveryIdentity {
    return new DiscoveryIdentity([...this.parts, ...parts]);
  }

  appendIdentity(identity: DiscoveryIdentity): DiscoveryIdentity {
    return new DiscoveryIdentity([...this.parts, ...identity.parts]);
  }

  static from(parts: readonly DiscoveryIdentityPart[]): DiscoveryIdentity {
    return new DiscoveryIdentity(parts);
  }

  toString(): string {
    return JSON.stringify(this.parts);
  }
}
