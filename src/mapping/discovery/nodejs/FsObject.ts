import path from "path";
import type { DiscoveryValue } from "../../value/DiscoveryValue.js";

export class FsObject {
  protected _fullPath: string;
  protected _basename: string;
  protected constructor(fullPath: string) {
    this._fullPath = fullPath;
    this._basename = path.basename(fullPath);
  }
  get basename(): string {
    return this._basename;
  }
  get fullPath(): string {
    return this._fullPath;
  }
}

export function requireFsObject(value: DiscoveryValue): FsObject {
  if (!(value instanceof FsObject)) {
    throw new Error("Expected a filesystem object.");
  }
  return value;
}