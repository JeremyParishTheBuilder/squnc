import type { InputBatch } from "../../input/InputBatch.js";
import type { DiscoveryResults } from "../discovery/DiscoveryResults.js";
import type { DiscoveryRoot } from "../discovery/DiscoveryRoot.js";
import { ImportEngine, type ImportEngineSpec } from "../import/ImportEngine.js";
import type { ImportReport } from "../import/ImportReport.js";

export class MappingOrchestrator {
  private _discoveryResults?: DiscoveryResults;
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
    this._importReport = undefined;
    return results;
  }

  import<TInputBatch extends InputBatch>(
    spec: Omit<ImportEngineSpec<TInputBatch>, "discovery">,
  ): ImportReport {
    if (!this._discoveryResults) {
      throw new Error("Discovery must run before Import.");
    }

    spec.engine.ensureDatabase(spec.databaseName);

    const report = ImportEngine.import({
      ...spec,
      discovery: this._discoveryResults,
    });

    this._importReport = report;
    return report;
  }

  //export() // later -- TODO
}
