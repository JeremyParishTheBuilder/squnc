import type { ResolvedColumn } from "./ResolvedColumn.js";

export interface ColumnResolver {
  resolveColumn(reference: string): ResolvedColumn;
}