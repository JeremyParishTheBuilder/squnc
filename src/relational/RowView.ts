import type { StructuredArray, StructuredValue } from "../mapping/value/StructuredValue.js";
import { type ColumnValue } from "../types/ColumnValue.js";

//export type RowView = {
export interface RowView {
  index: number;
  readonly values: readonly StructuredValue[];
  //readonly values: StructuredArray;
  //readonly values: readonly ColumnValue[];
};
