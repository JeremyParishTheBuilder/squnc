import { FsObject } from "./FsObject.js";
import * as fs from "fs";

export class File extends FsObject {
  private _contents: unknown | null = null;
  private _failed: boolean = false;

  constructor(fullPath: string) {
    super(fullPath);
  }

  //don't need?
  private readJson(): unknown | null {
    if (!this._basename.endsWith(".json")) {
      console.warn(`Skipping non-JSON file: ${this.basename}`);
      return null;
    }
    try {
      const data = fs.readFileSync(this.fullPath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading JSON from file: ${this.fullPath}`, error);
      this._failed = true;
      return null;
    }
  }

  //might also not need?
  public get contents(): unknown | null {
    if (this._failed) {
      return null; // Return `null` if the previous attempt failed
    }
    if (this._contents === null) {
      this._contents = this.readJson();
      if (this._contents === null) {
        this._failed = true; // Cache the failed attempt
      }
    }
    return this._contents;
  }
}

export default File;
