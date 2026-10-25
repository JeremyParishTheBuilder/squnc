import type { ImportContext } from "../ImportContext.js";
import type { ImportMapping } from "./ImportMapping.js";

export interface InferredImport {
  context: ImportContext;
  mapping: ImportMapping;
}
