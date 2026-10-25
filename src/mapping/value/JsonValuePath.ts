import type { StructuredValue } from "./StructuredValue.js";

export class JsonValuePath {
  private constructor(readonly parts: readonly string[]) {}

  resolve(value: StructuredValue): StructuredValue | undefined {
    let current: StructuredValue = value;

    for (const part of this.parts) {
      if (
        typeof current !== "object" ||
        current === null ||
        Array.isArray(current)
      ) {
        return undefined;
      }

      if (!(part in current)) {
        return undefined;
      }

      current = current[part];
    }

    return current;
  }

  static parse(path: string): JsonValuePath {
    if (path === "$") {
      return new JsonValuePath([]);
    }

    if (!path.startsWith("$.")) {
      throw new Error(
        `Invalid JSON value path "${path}": expected path to begin with "$.".`,
      );
    }

    const propertyPath = path.slice(2);

    if (propertyPath.length === 0) {
      throw new Error(
        `Invalid JSON value path "${path}": expected at least one property.`,
      );
    }

    const parts = propertyPath.split(".");

    if (parts.some((part) => part.length === 0)) {
      throw new Error(
        `Invalid JSON value path "${path}": empty property name.`,
      );
    }

    return new JsonValuePath(parts);
  }

  toString(): string {
    return this.parts.length === 0 ? "$" : `$.${this.parts.join(".")}`;
  }
}
