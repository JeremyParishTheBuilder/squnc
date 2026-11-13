import { describe, it, expect, vi } from 'vitest';
import { DiscoveryResults } from '../../../src/mapping/discovery/DiscoveryResults.js';
import {
  DiscoveryDatabaseBuilder,
  DEFAULT_DISCOVERY_DATABASE_NAME,
} from "../../../src/mapping/discovery/DiscoveryDatabaseBuilder.js";
import { discoveryColumns } from "../../../src/mapping/discovery/DiscoveryResult.js";
import { freshEngine, createTestPostgresSql } from "../../utils/engineHelpers.js";

describe("Mapping::Discovery::DiscoveryDatabaseBuilder", () => {
  describe("build()", () => {
    it("restores the current database when construction fails", () => {
      const engine = freshEngine();
      const sql = createTestPostgresSql(engine);

      const initialDatabaseName = "InitialDatabase";

      sql.createDatabase(initialDatabaseName).execute();
      sql.useDatabase(initialDatabaseName).execute();

      const discoveryResults = new DiscoveryResults();

      discoveryResults.registerNodeTypes(["resultId"]);
      
      vi.spyOn(engine, "setCurrentDatabase").mockImplementation((databaseName) => {
        engine.setCurrentDatabase(databaseName);

        if (databaseName === DEFAULT_DISCOVERY_DATABASE_NAME) {
          throw new Error("Simulated construction failure");
        }
      });

      expect(() => {
        DiscoveryDatabaseBuilder.build({
          engine,
          databaseName: DEFAULT_DISCOVERY_DATABASE_NAME,
          discoveryResults,
        });
      }).toThrow();

      // The target database should have been rolled back.
      expect(
        engine.databases.getByName(DEFAULT_DISCOVERY_DATABASE_NAME),
      ).toBeUndefined();

      // A subsequent unqualified statement should use the original database.
      sql.createTable("AfterFailure", discoveryColumns()).execute();

      expect(
        engine.databases
          .requireByName(initialDatabaseName)
          .tables.hasName("AfterFailure"),
      ).toBe(true);
    });
  });
});