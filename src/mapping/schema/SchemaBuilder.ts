import type { DiscoveryResults } from "../discovery/DiscoveryResults.js";
import type { StructuredValue } from "../value/StructuredValue.js";
import { DatabaseSchema } from "./DatabaseSchema.js";

export class SchemaBuilder {
  readonly schema = new DatabaseSchema();

  observeDiscoveryResults(
    discoveryResults: DiscoveryResults,
    nodeType: string,
  ): void {
    for (const result of discoveryResults.getAll()) {
      if (result.nodeType !== nodeType) continue;

      const value = result.value;

      if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value)
      ) {
        continue;
      }

      this.observeObject(nodeType, value);
    }
  }

  observeObject(
    tableName: string,
    value: StructuredValue,
    parentTableName?: string,
    sourcePath?: string,
  ): void {
    if (value === null || typeof value !== "object") {
      throw new Error("Schema inference requires a structured value.");
    }

    if (Array.isArray(value)) {
      throw new Error(
        "An array must be observed as a child table.",
      );
    }

    const table = parentTableName
      ? this.schema.getOrCreateChildTable(
          tableName,
          parentTableName,
          sourcePath!,
        )
      : this.schema.getOrCreateTable(tableName);

    const columns = new Map<string, unknown>();

    const visitObject = (
      object: Record<string, unknown>,
      path: readonly string[] = [],
    ): void => {
      for (const [key, child] of Object.entries(object)) {
        const childPath = [...path, key];

        if (Array.isArray(child)) {
          const childTableName = [
            tableName,
            ...childPath,
          ].join("__");

          this.schema.getOrCreateChildTable(
            childTableName,
            tableName,
            childPath.join("__"),
          );

          for (const element of child) {
            this.observeArrayElement(
              childTableName,
              element,
              tableName,
              childPath.join("__"),
            );
          }

          continue;
        }

        if (
          child !== null &&
          typeof child === "object"
        ) {
          visitObject(
            child as Record<string, unknown>,
            childPath,
          );

          continue;
        }

        columns.set(childPath.join("__"), child);
      }
    };

    visitObject(value as Record<string, unknown>);
    table.observeRow(columns);
  }

  private observeArrayElement(
    tableName: string,
    element: unknown,
    parentTableName: string,
    sourcePath: string,
  ): void {
    if (
      element !== null &&
      typeof element === "object" &&
      !Array.isArray(element)
    ) {
      this.observeObject(
        tableName,
        element as StructuredValue,
        parentTableName,
        sourcePath,
      );

      return;
    }

    const table = this.schema.getOrCreateChildTable(
      tableName,
      parentTableName,
      sourcePath,
    );

    table.observeRow(new Map([["value", element]]));
  }
}
