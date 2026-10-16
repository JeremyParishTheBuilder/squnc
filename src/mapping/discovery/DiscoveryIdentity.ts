import type { ColumnValue } from "../../types/ColumnValue.js";
import type { PrimitiveValue } from "../value/StructuredValue.js";

export type DiscoveryIdentityPart = PrimitiveValue;

// class DiscoveryIdentityPart {
//     constructor(
//         readonly kind: DiscoveryIdentityKind,
//         readonly value: unknown,
//     ) {}
// }
// because I think eventually you'll want operations like
// identity.untilNodeType("chainDirectory")
// TODO, review

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
