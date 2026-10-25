import type { ColumnValue } from "../types/ColumnValue.js";

export interface RowView {
  index: number;
  readonly values: readonly ColumnValue[];
}
