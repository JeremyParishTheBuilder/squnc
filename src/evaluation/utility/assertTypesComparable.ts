import { type ColumnValue } from "../../types/ColumnValue.js";

export function assertComparable(left: ColumnValue, right: ColumnValue): void {
  if (!typesAreComparable(left, right)) {
    throw new Error(`Values are not comparable`);
  }
}

function typesAreComparable(a: ColumnValue, b: ColumnValue): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return Number.isFinite(a) && Number.isFinite(b);
  }

  return typeof a === "string" && typeof b === "string";
}
