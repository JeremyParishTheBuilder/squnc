import type { ColumnValue } from "../../types/ColumnValue.js";

export type DiscoveryIdentityPart = ColumnValue;

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
  constructor(readonly parts: readonly ColumnValue[]) {}

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
