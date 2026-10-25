import type { DiscoveryRoot } from "../../discovery/DiscoveryRoot.js";
import type { ImportMapping } from "./ImportMapping.js";

export interface ImportRootSpec {
  readonly discovery: DiscoveryRoot;
  readonly mapping: ImportMapping;
}

export class ImportRoot {
  constructor(public readonly spec: ImportRootSpec) {}

  get discovery() {
    return this.spec.discovery;
  }

  get mapping() {
    return this.spec.mapping;
  }
}
