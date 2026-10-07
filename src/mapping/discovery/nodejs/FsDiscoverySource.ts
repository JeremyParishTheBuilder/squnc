import type { DiscoverySource } from "../DiscoverySource.js";
import type { FsObject } from "./FsObject.js";

export class FsDiscoverySource implements DiscoverySource {
  constructor(public readonly root: FsObject) {}

  open() {
    return this.root;
  }
}
