import type { Engine } from "../../engine/Engine.js";
import type { PublicInputBatch } from "../../input/PublicInputBatch.js";
import {
  DEFAULT_DISCOVERY_DATABASE_NAME,
  DiscoveryDatabaseBuilder,
} from "../discovery/DiscoveryDatabaseBuilder.js";
import type { DiscoveryResults } from "../discovery/DiscoveryResults.js";
import type { DiscoveryRoot } from "../discovery/DiscoveryRoot.js";
import { ImportEngine, type ImportEngineSpec } from "../import/ImportEngine.js";
import type { ImportReport } from "../import/ImportReport.js";
import { DatabaseBuilder } from "../schema/DatabaseBuilder.js";
import { SchemaBuilder } from "../schema/SchemaBuilder.js";

export type MappingImportSpec<
  TInputBatch extends PublicInputBatch = PublicInputBatch,
> = Omit<ImportEngineSpec<TInputBatch>, "discoveryDatabaseName"> & {
  readonly discoveryDatabaseName?: string;
};

export class MappingOrchestrator {
  private _discoveryResults?: DiscoveryResults;
  private _discoveryDatabaseName?: string;
  private _importReport?: ImportReport;

  get discoveryResults(): DiscoveryResults | undefined {
    return this._discoveryResults;
  }

  get importReport(): ImportReport | undefined {
    return this._importReport;
  }

  discovery(root: DiscoveryRoot): DiscoveryResults {
    const results = root.discover();

    this._discoveryResults = results;
    this._discoveryDatabaseName = undefined;
    this._importReport = undefined;

    return results;
  }

  buildDiscoveryDatabase(
    engine: Engine,
    databaseName: string = DEFAULT_DISCOVERY_DATABASE_NAME,
  ): string {
    if (!this._discoveryResults) {
      throw new Error(
        "Discovery must run before building the discovery database.",
      );
    }

    return DiscoveryDatabaseBuilder.build({
      engine,
      databaseName,
      discoveryResults: this._discoveryResults,
    });
  }

  
  buildBusinessDatabase(
    engine: Engine,
    databaseName: string,
    nodeType = "chainFile",
  ): string {
    if (!this._discoveryResults) {
      throw new Error(
        "Discovery must run before building the business database.",
      );
    }

    const schemaBuilder = new SchemaBuilder();

    schemaBuilder.observeDiscoveryResults(
      this._discoveryResults,
      nodeType,
    );

    const updatedDatabases = new DatabaseBuilder(
      databaseName,
      schemaBuilder.schema,
      this._discoveryResults,
      nodeType,
    ).build(engine.databases);

    // Install only after the complete build succeeds.
    engine.install(updatedDatabases);

    // A new business database invalidates any previous import report.
    this._importReport = undefined;

    return databaseName;
  }


  import<TInputBatch extends PublicInputBatch>(
    spec: MappingImportSpec<TInputBatch>,
  ): ImportReport {
    if (!this._discoveryDatabaseName) {
      this._discoveryDatabaseName = this.buildDiscoveryDatabase(
        spec.engine,
        spec.discoveryDatabaseName ?? DEFAULT_DISCOVERY_DATABASE_NAME,
      );
    }

    spec.engine.ensureDatabase(spec.businessDatabaseName);

    const report = ImportEngine.import<TInputBatch>({
      ...spec,
      discoveryDatabaseName: this._discoveryDatabaseName,
    });

    this._importReport = report;
    return report;
  }

  //export() // later -- TODO
}