import type { DiscoveryNavigator } from "./DiscoveryNavigator.js";
import type { DiscoveryValue } from "../../value/DiscoveryValue.js";
import type { DiscoveryIdentityPart } from "../DiscoveryIdentity.js";

export class SelfNavigator<
  T extends DiscoveryValue,
> implements DiscoveryNavigator<T, T> {
  constructor(private readonly ctor: new (...args: never[]) => T) {}

  accepts(current: DiscoveryValue): current is T {
    return current instanceof this.ctor;
  }

  next(current: T): readonly T[] {
    return [current];
  }

  identityParts(_current: T, _next: T): readonly DiscoveryIdentityPart[] {
    return [];
  }
}
