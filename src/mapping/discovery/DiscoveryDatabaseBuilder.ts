import type { Engine } from "../../engine/Engine.js";
import type { InsertValuesInput } from "../../types/InsertSource.js";
import { adaptDiscoveryResult } from "./adaptDiscoveryResults.js";
import { discoveryColumns } from "./DiscoveryResult.js";
import type { DiscoveryResults } from "./DiscoveryResults.js";

export const DEFAULT_DISCOVERY_DATABASE_NAME: string = "discovery";

export type DiscoveryDatabaseBuilderSpec = {
  engine: Engine;
  databaseName: string;
  discoveryResults: DiscoveryResults;
};

export class DiscoveryDatabaseBuilder {
  static build(spec: DiscoveryDatabaseBuilderSpec): string {
    const { engine, databaseName, discoveryResults } = spec;

    if (engine.databases.getByName(databaseName)) {
      throw new Error(`Database ${databaseName} already exists.`);
    }

    const sql = engine.input();

    sql.begin().execute();

    try {
      sql.createDatabase(databaseName).execute();
      sql.useDatabase(databaseName).execute();

      const columnList = discoveryColumns();

      const adaptedResultsByNodeType = new Map<string, InsertValuesInput[][]>();

      const nodeTypes = new Set([
        ...discoveryResults.getNodeTypes(),
        ...discoveryResults.getAll().map((result) => result.nodeType),
      ]);

      for (const nodeType of nodeTypes) {
        sql.createTable(nodeType, columnList).execute();
        adaptedResultsByNodeType.set(nodeType, []);
      }

      for (const result of spec.discoveryResults.getAll()) {
        const adapted = adaptDiscoveryResult(result);

        const row: InsertValuesInput[] = [
          adapted.resultId,
          adapted.parentResultId,
          adapted.nodeType,
          adapted.identity,
          adapted.value,
          adapted.metadata,
          adapted.captures,
        ];

        adaptedResultsByNodeType.get(result.nodeType)!.push(row);
      }

      for (const [nodeType, results] of adaptedResultsByNodeType) {
        if (results.length === 0) {
          continue;
        }

        sql.insertInto(nodeType).values(results).execute();
      }

      sql.commit().execute();

      return databaseName;
    } catch (error) {
      sql.rollback().execute();
      throw error;
    }
  }
}
