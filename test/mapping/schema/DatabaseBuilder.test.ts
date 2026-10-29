import { describe, expect, it } from "vitest";
import { SchemaBuilder } from "../../../src/mapping/schema/SchemaBuilder.js";
import { DiscoveryResults } from "../../../src/mapping/discovery/DiscoveryResults.ts";
import { DiscoveryIdentity } from "../../../src/mapping/discovery/DiscoveryIdentity.ts";
import { Databases } from "../../../src/relational/Databases.js";
import { DatabaseBuilder } from "../../../src/mapping/schema/DatabaseBuilder.js";
import type { StructuredValue } from "../../../src/mapping/value/StructuredValue.ts";

const ROOT_NODE_TYPE = "chainFile";
const DATABASE_NAME = "Test Registry";

interface TestPayload {
  readonly identity: DiscoveryIdentity;
  readonly value: StructuredValue;
}

function createTestDiscoveryResults(
  payloads: readonly TestPayload[],
): DiscoveryResults {
  const results = payloads.map((payload, index) => ({
    resultId: index + 1,
    parentResultId: null,
    nodeType: ROOT_NODE_TYPE,
    identity: payload.identity,
    value: payload.value,
    metadata: {},
    captures: new Map(),
  }));

  return {
    getAll: () => results,
  } as unknown as DiscoveryResults;
}

function createPayloadDiscoveryResults(
  payloads: readonly TestPayload[],
): DiscoveryResults {
  const results = new DiscoveryResults();

  for (const payload of payloads) {
    results.createDiscoveryResult(
      null,
      ROOT_NODE_TYPE,
      payload.identity,
      payload.value,
      {},
      new Map(),
    );
  }

  return results;
}

function buildDatabase(payloads: readonly TestPayload[]) {
  const discoveryResults = createPayloadDiscoveryResults(payloads);

  const schemaBuilder = new SchemaBuilder();
  schemaBuilder.observeDiscoveryResults(
    discoveryResults,
    ROOT_NODE_TYPE,
  );

  const databases = new DatabaseBuilder(
    DATABASE_NAME,
    schemaBuilder.schema,
    discoveryResults,
    ROOT_NODE_TYPE,
  ).build(new Databases());

  return {
    database: databases.requireByName(DATABASE_NAME),
    schema: schemaBuilder.schema,
  };
}

function readCell(
  database: ReturnType<typeof buildDatabase>["database"],
  tableName: string,
  rowIndex: number,
  columnName: string,
): unknown {
  const table = database.tables.requireByName(tableName);
  const column = table.columns.requireByName(columnName);
  const row = table.requireRow(rowIndex);

  return row[column.position];
}

describe("Mapping::Schema::DatabaseBuilder", () => {
  describe("build()", () => {
    it("creates root rows with flattened scalar properties and identities", () => {
      const { database } = buildDatabase([
        {
          identity: new DiscoveryIdentity(["alpha"]),
          value: {
            chain_name: "Alpha",
            codebase: {
              git_repo: "https://example.com/alpha",
            },
          },
        },
        {
          identity: new DiscoveryIdentity(["beta"]),
          value: {
            chain_name: "Beta",
            codebase: {
              git_repo: "https://example.com/beta",
            },
          },
        },
      ]);

      const table = database.tables.requireByName(ROOT_NODE_TYPE);

      expect(table.numRows).toBe(2);

      expect(readCell(database, ROOT_NODE_TYPE, 0, "chain_name"))
        .toBe("Alpha");
      expect(readCell(database, ROOT_NODE_TYPE, 0, "codebase__git_repo"))
        .toBe("https://example.com/alpha");
      expect(readCell(database, ROOT_NODE_TYPE, 0, "identity"))
        .toEqual(["alpha"]);

      expect(readCell(database, ROOT_NODE_TYPE, 1, "chain_name"))
        .toBe("Beta");
      expect(readCell(database, ROOT_NODE_TYPE, 1, "identity"))
        .toEqual(["beta"]);
    });

    it("creates array rows with identities and parent associations", () => {
      const { database } = buildDatabase([
        {
          identity: new DiscoveryIdentity(["alpha"]),
          value: {
            chain_name: "Alpha",
            key_algos: ["secp256k1", "ed25519"],
          },
        },
      ]);

      const tableName = "chainFile__key_algos";
      const table = database.tables.requireByName(tableName);

      expect(table.numRows).toBe(2);

      expect(readCell(database, tableName, 0, "value"))
        .toBe("secp256k1");
      expect(readCell(database, tableName, 0, "identity"))
        .toEqual(["alpha", 0]);
      expect(readCell(database, tableName, 0, "parentNodeType"))
        .toBe(ROOT_NODE_TYPE);
      expect(readCell(database, tableName, 0, "parentIdentity"))
        .toEqual(["alpha"]);

      expect(readCell(database, tableName, 1, "value"))
        .toBe("ed25519");
      expect(readCell(database, tableName, 1, "identity"))
        .toEqual(["alpha", 1]);
      expect(readCell(database, tableName, 1, "parentIdentity"))
        .toEqual(["alpha"]);
    });

    it("derives nested array identities from the immediate parent row", () => {
      const { database } = buildDatabase([
        {
          identity: new DiscoveryIdentity(["alpha"]),
          value: {
            groups: [
              {
                name: "first",
                items: ["x", "y"],
              },
            ],
          },
        },
      ]);

      const parentTable = "chainFile__groups";
      const childTable = "chainFile__groups__items";

      expect(database.tables.requireByName(parentTable).numRows).toBe(1);
      expect(database.tables.requireByName(childTable).numRows).toBe(2);

      expect(readCell(database, parentTable, 0, "identity"))
        .toEqual(["alpha", 0]);
      expect(readCell(database, parentTable, 0, "parentIdentity"))
        .toEqual(["alpha"]);

      expect(readCell(database, childTable, 0, "value")).toBe("x");
      expect(readCell(database, childTable, 0, "identity"))
        .toEqual(["alpha", 0, 0]);
      expect(readCell(database, childTable, 0, "parentNodeType"))
        .toBe(parentTable);
      expect(readCell(database, childTable, 0, "parentIdentity"))
        .toEqual(["alpha", 0]);

      expect(readCell(database, childTable, 1, "value")).toBe("y");
      expect(readCell(database, childTable, 1, "identity"))
        .toEqual(["alpha", 0, 1]);
    });

    it("inserts null for a property missing from a root row", () => {
      const { database, schema } = buildDatabase([
        {
          identity: new DiscoveryIdentity(["alpha"]),
          value: {
            chain_name: "Alpha",
            website: "https://alpha.example",
          },
        },
        {
          identity: new DiscoveryIdentity(["beta"]),
          value: {
            chain_name: "Beta",
          },
        },
      ]);

      const tableSchema = schema.tables.get(ROOT_NODE_TYPE)!;
      const websiteSchema = tableSchema.columns.get("website")!;

      expect(websiteSchema.nullable).toBe(true);
      expect(readCell(database, ROOT_NODE_TYPE, 1, "website"))
        .toBeNull();
    });

    it("creates an empty child table for an empty array", () => {
      const { database } = buildDatabase([
        {
          identity: new DiscoveryIdentity(["alpha"]),
          value: {
            chain_name: "Alpha",
            key_algos: [],
          },
        },
      ]);

      const tableName = "chainFile__key_algos";
      const table = database.tables.requireByName(tableName);

      expect(table.numRows).toBe(0);
      expect(table.columns.hasName("identity")).toBe(true);
      expect(table.columns.hasName("parentNodeType")).toBe(true);
      expect(table.columns.hasName("parentIdentity")).toBe(true);
    });

    it("does not modify the input databases when construction fails", () => {
      const schemaBuilder = new SchemaBuilder();

      schemaBuilder.observeObject(ROOT_NODE_TYPE, {
        chain_name: null,
      });

      const discoveryResults = createTestDiscoveryResults([
        {
          identity: new DiscoveryIdentity(["alpha"]),
          value: {
            chain_name: null,
          },
        },
      ]);

      const initialDatabases = new Databases();

      expect(() => {
        new DatabaseBuilder(
          DATABASE_NAME,
          schemaBuilder.schema,
          discoveryResults,
          ROOT_NODE_TYPE,
        ).build(initialDatabases);
      }).toThrow(/no inferred type/i);

      expect(initialDatabases.getByName(DATABASE_NAME)).toBeUndefined();
    });

    it("rejects an existing target database", () => {
      const schemaBuilder = new SchemaBuilder();
      schemaBuilder.observeObject(ROOT_NODE_TYPE, {
        chain_name: "Alpha",
      });

      const discoveryResults = createTestDiscoveryResults([
        {
          identity: new DiscoveryIdentity(["alpha"]),
          value: {
            chain_name: "Alpha",
          },
        },
      ]);

      const initialDatabases = new Databases().create({
        name: DATABASE_NAME,
      });

      expect(() => {
        new DatabaseBuilder(
          DATABASE_NAME,
          schemaBuilder.schema,
          discoveryResults,
          ROOT_NODE_TYPE,
        ).build(initialDatabases);
      }).toThrow(/already exists/i);

      expect(initialDatabases.getByName(DATABASE_NAME)).toBeDefined();
    });
  });
});
