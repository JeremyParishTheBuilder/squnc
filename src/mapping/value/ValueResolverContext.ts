import { type ImportRowIdentity } from "../import/ImportRowIdentity.js";
import type { StructuredValue } from "./StructuredValue.js";

export interface ValueResolverContext {
  current: StructuredValue;
  captures: ReadonlyMap<string, StructuredValue>;
  capture(name: string): StructuredValue;
  rowIdentity?: ImportRowIdentity;
}
