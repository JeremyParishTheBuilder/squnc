import type { ColumnValue } from "../../../types/ColumnValue.js";
import { type DiscoveryNavigator } from "./DiscoveryNavigator.js";
import type { DiscoveryValue } from "../../value/DiscoveryValue.js";
import type {
  StructuredObject,
  StructuredProperty,
} from "../../value/StructuredValue.js";
import type { DiscoveryIdentityPart } from "../DiscoveryIdentity.js";

export class StructuredObjectNavigator implements DiscoveryNavigator<
  StructuredObject,
  StructuredProperty
> {
  accepts(value: DiscoveryValue): value is StructuredObject {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  next(obj: StructuredObject): readonly StructuredProperty[] {
    return Object.entries(obj).map(([key, value]) => ({
      key,
      value,
    }));
  }

  identityParts(
    current: StructuredObject,
    next: StructuredProperty,
  ): readonly DiscoveryIdentityPart[] {
    return [next.key];
  }
}
