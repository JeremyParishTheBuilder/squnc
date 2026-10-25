import type { ImportContext } from "../ImportContext.js";

export interface ImportSource {
  navigate(context: ImportContext): ImportContext[];
  consumedKeys(): readonly string[];
  columnNamespace(): string | undefined;
}
