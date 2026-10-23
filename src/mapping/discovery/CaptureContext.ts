import type { StructuredValue } from "../value/StructuredValue.js";

export interface CaptureContext {
  captures: ReadonlyMap<string, StructuredValue>;
}
