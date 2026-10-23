import type { DiscoveryValue } from "../../value/DiscoveryValue.js";
import type { DiscoveryIdentityPart } from "../DiscoveryIdentity.js";

export interface DiscoveryNavigator<
  TCurrent extends DiscoveryValue,
  TNext extends DiscoveryValue,
> {
  accepts(current: DiscoveryValue): current is TCurrent;
  next(current: TCurrent): readonly TNext[];
  identityParts(current: TCurrent, next: TNext): readonly DiscoveryIdentityPart[];
}
