import { describe, expect, it } from "vitest";
import { SchemaBuilder } from "../../../src/mapping/schema/SchemaBuilder.js";
import { exampleChainRegistry_DiscoveryDefinition } from "../../../src/mapping/discovery/example.js";
import { DiscoveryResults } from "../../../src/mapping/discovery/DiscoveryResults.ts";
import { DiscoveryIdentity } from "../../../src/mapping/discovery/DiscoveryIdentity.ts";

describe("SchemaBuilder", () => {
  it("infers nested object properties as columns", () => {
    const builder = new SchemaBuilder();

    builder.observeObject("chainFile", {
      chain_name: "cosmoshub",
      codebase: {
        git_repo: "https://example.com/repo",
      },
    });

    const table = builder.schema.tables.get("chainFile");

    expect(table).toBeDefined();
    expect(table!.columns.has("chain_name")).toBe(true);
    expect(table!.columns.has("codebase__git_repo")).toBe(true);
    expect(builder.schema.tables.has("chainFile__codebase")).toBe(false);
  });

  it("infers arrays as child tables", () => {
    const builder = new SchemaBuilder();

    builder.observeObject("chainFile", {
      codebase: {
        compatible_versions: ["v1", "v2"],
      },
    });

    const table = builder.schema.tables.get(
      "chainFile__codebase__compatible_versions",
    );

    expect(table).toBeDefined();
    expect(table!.parentTableName).toBe("chainFile");
    expect(table!.sourcePath).toBe("codebase__compatible_versions");
    expect(table!.columns.has("value")).toBe(true);
  });

  it("marks columns nullable when properties are missing", () => {
    const builder = new SchemaBuilder();

    builder.observeObject("chainFile", {
      chain_name: "alpha",
    });

    builder.observeObject("chainFile", {
      chain_name: "beta",
      website: "https://example.com",
    });

    const table = builder.schema.tables.get("chainFile");
    const website = table!.columns.get("website");

    expect(website).toBeDefined();
    expect(website!.nullable).toBe(true);
  });

  it("creates a child table for an empty array", () => {
    const builder = new SchemaBuilder();

    builder.observeObject("chainFile", {
      codebase: {
        compatible_versions: [],
      },
    });

    expect(
      builder.schema.tables.has(
        "chainFile__codebase__compatible_versions",
      ),
    ).toBe(true);
  });

  it("rejects inconsistent types for the same column", () => {
    const builder = new SchemaBuilder();

    builder.observeObject("chainFile", {
      chain_id: "cosmoshub-4",
    });

    expect(() => {
      builder.observeObject("chainFile", {
        chain_id: 123,
      });
    }).toThrow(/inconsistent observed types/i);
  });

  describe("DiscoveryResults", () => {
    it("merges properties across multiple discovery results", () => {
      const discoveryResults = new DiscoveryResults();

      discoveryResults.createDiscoveryResult(
        null,
        "chainFile",
        new DiscoveryIdentity([0]),
        {
          chain_name: "cosmoshub",
          chain_id: "cosmoshub-4",
        },
        {},
        new Map(),
      );

      discoveryResults.createDiscoveryResult(
        null,
        "chainFile",
        new DiscoveryIdentity([1]),
        {
          chain_name: "akash",
          chain_id: "akashnet-2",
          website: "https://example.com",
        },
        {},
        new Map(),
      );

      const builder = new SchemaBuilder();
      builder.observeDiscoveryResults(discoveryResults, "chainFile");

      const table = builder.schema.tables.get("chainFile");
      expect(table).toBeDefined();

      expect(table!.columns.has("chain_name")).toBe(true);
      expect(table!.columns.has("chain_id")).toBe(true);

      const website = table!.columns.get("website");
      expect(website).toBeDefined();
      expect(website!.nullable).toBe(true);
    });

    it("infers a schema from the example chain registry", () => {
      const discoveryRoot = exampleChainRegistry_DiscoveryDefinition();
      const discoveryResults = discoveryRoot.discover();

      const builder = new SchemaBuilder();
      builder.observeDiscoveryResults(discoveryResults, "chainFile");

      const table = builder.schema.tables.get("chainFile");

      expect(table).toBeDefined();
      expect(table!.columns.has("chain_name")).toBe(true);

      // At least one array-derived table should be inferred
      // if a discovered chainFile contains an array.
      expect(
        [...builder.schema.tables.keys()].some(
          (name) => name.startsWith("chainFile__"),
        ),
      ).toBe(true);
    });
  });
});