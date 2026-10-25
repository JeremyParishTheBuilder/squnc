import {
  isStructuredContainer,
  isStructuredValue,
} from "../mapping/value/StructuredValue.js";
import type { ColumnValue } from "./ColumnValue.js";
import {
  isValidDateValue,
  isValidTimestampValue,
  normalizeDate,
  normalizeTimestamp,
} from "./SqlDateTime.js";

export type SqlType =
  | IntegerType
  | DecimalType
  | VarcharType
  | BooleanType
  | DateType
  | TimestampType
  | JsonType;

export interface IntegerType {
  readonly kind: "integer";
}

export interface DecimalType {
  readonly kind: "decimal";
  readonly precision?: number;
  readonly scale?: number;
}

export interface VarcharType {
  readonly kind: "varchar";
  readonly length?: number;
}

export interface BooleanType {
  readonly kind: "boolean";
}

export interface DateType {
  readonly kind: "date";
}

export interface TimestampType {
  readonly kind: "timestamp";
  readonly precision?: number;
}

export interface JsonType {
  readonly kind: "json";
}

export const SQL_INTEGER: IntegerType = {
  kind: "integer",
};

export const SQL_DECIMAL: DecimalType = {
  kind: "decimal",
};

export const SQL_VARCHAR: VarcharType = {
  kind: "varchar",
};

export const SQL_BOOLEAN: BooleanType = {
  kind: "boolean",
};

export const SQL_DATE: DateType = {
  kind: "date",
};

export const SQL_TIMESTAMP: TimestampType = {
  kind: "timestamp",
};

export const SQL_JSON: JsonType = {
  kind: "json",
};

export function varchar(length?: number): VarcharType {
  return { kind: "varchar", length };
}

export function decimal(precision?: number, scale?: number): DecimalType {
  return { kind: "decimal", precision, scale };
}

export function timestamp(precision?: number): TimestampType {
  return { kind: "timestamp", precision };
}

export function isSameType(type1: SqlType, type2: SqlType): boolean {
  if (type1.kind !== type2.kind) {
    return false;
  }

  switch (type1.kind) {
    case "integer":
    case "boolean":
    case "date":
    case "json":
      return true;

    case "decimal":
      return (
        type2.kind === "decimal" &&
        type1.precision === type2.precision &&
        type1.scale === type2.scale
      );

    case "varchar":
      return type2.kind === "varchar" && type1.length === type2.length;

    case "timestamp":
      return type2.kind === "timestamp" && type1.precision === type2.precision;
  }
}

export function matchesSqlType(value: unknown, type: SqlType): boolean {
  if (value === null) {
    return true;
  }

  switch (type.kind) {
    case "integer":
      return typeof value === "number" && Number.isInteger(value);

    case "decimal":
      return typeof value === "number" && Number.isFinite(value);

    case "varchar":
      return typeof value === "string";

    case "boolean":
      return typeof value === "boolean";

    case "date":
      return typeof value === "string" && isValidDateValue(value);

    case "timestamp":
      return typeof value === "string" && isValidTimestampValue(value);

    case "json":
      return isStructuredValue(value); // technically allows primitives
  }
}

export function sqlTypeFromValue(value: ColumnValue): SqlType {
  if (value === null) {
    throw new Error("Cannot infer SQL type from null.");
  }

  if (typeof value === "string") {
    return SQL_VARCHAR;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? SQL_INTEGER : SQL_DECIMAL;
  }

  if (typeof value === "boolean") {
    return SQL_BOOLEAN;
  }

  if (isStructuredContainer(value)) {
    return SQL_JSON;
  }

  throw new Error("Unexpected column value.");
}

export function isAssignable(from: SqlType, to: SqlType): boolean {
  if (isSameType(from, to)) {
    return true;
  }

  if (from.kind === "integer" && to.kind === "decimal") {
    return true;
  }

  return false;
}

export function isCastable(from: SqlType, to: SqlType): boolean {
  if (isSameType(from, to)) {
    return true;
  }

  switch (from.kind) {
    case "integer":
      return to.kind === "decimal" || to.kind === "varchar";

    case "decimal":
      return to.kind === "integer" || to.kind === "varchar";

    case "boolean":
      return to.kind === "varchar";

    case "varchar":
      return (
        to.kind === "integer" ||
        to.kind === "decimal" ||
        to.kind === "boolean" ||
        to.kind === "date" ||
        to.kind === "timestamp"
      );

    case "date":
      return to.kind === "varchar" || to.kind === "timestamp";

    case "timestamp":
      return to.kind === "varchar" || to.kind === "date";

    case "json":
      return false;
  }
}

export function castValue(
  value: ColumnValue,
  targetType: SqlType,
): ColumnValue {
  if (value === null) {
    return null;
  }

  switch (targetType.kind) {
    case "integer": {
      const result = Number(value);

      if (!Number.isInteger(result)) {
        throw new Error(`Cannot cast value to INTEGER: ${String(value)}`);
      }

      return result;
    }

    case "decimal": {
      const result = Number(value);

      if (!Number.isFinite(result)) {
        throw new Error(`Cannot cast value to DECIMAL: ${String(value)}`);
      }

      return result;
    }

    case "varchar":
      return String(value);

    case "boolean":
      if (typeof value === "boolean") {
        return value;
      }

      if (typeof value === "string") {
        if (value === "true") return true;
        if (value === "false") return false;
      }

      throw new Error(`Cannot cast value to BOOLEAN: ${String(value)}`);

    case "date": {
      if (typeof value !== "string") {
        throw new Error(`Cannot cast value to DATE: ${String(value)}`);
      }

      return normalizeDate(value);
    }

    case "timestamp": {
      if (typeof value !== "string") {
        throw new Error(`Cannot cast value to TIMESTAMP: ${String(value)}`);
      }

      return normalizeTimestamp(value);
    }

    case "json":
      return value;
  }
}

export function canBeIndexed(type: SqlType): boolean {
  switch (type.kind) {
    case "integer":
    case "decimal":
    case "varchar":
    case "boolean":
    case "date":
    case "timestamp":
      return true;
    case "json":
      return false;
  }
}
