import {
  isStructuredValue,
  type StructuredValue,
} from "../mapping/value/StructuredValue.js";

export type PrimitiveColumnValue = string | number | boolean | null;
//export type ColumnValue = PrimitiveColumnValue;
export type ColumnValue = StructuredValue;

export function isColumnValue(value: unknown): value is ColumnValue {
  return isStructuredValue(value);
  // return (
  //   value === null ||
  //   typeof value === "string" ||
  //   typeof value === "number" ||
  //   typeof value === "boolean"
  // );
}
