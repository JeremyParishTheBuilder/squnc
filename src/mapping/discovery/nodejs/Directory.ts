import fs from "fs";
import path from "path";
import File from "./File.js";
import { FsObject } from "./FsObject.js";

export class Directory extends FsObject {
  private _contents: (Directory | File)[] | null = null;
  private _failed: boolean = false;

  constructor(fullPath: string) {
    super(fullPath);
  }

  reclassify<T extends Directory>(newType: T): T {
    Object.assign(newType, this); // Copies properties from this Directory to newType
    return newType;
  }

  private readContents(): void {
    try {
      const entries = fs.readdirSync(this.fullPath);
      this._contents = entries.map((entry) => {
        const fullPath = path.join(this.fullPath, entry);
        const stat = fs.lstatSync(fullPath);
        return stat.isDirectory()
          ? new Directory(fullPath)
          : new File(fullPath);
      });
    } catch (error) {
      console.error("Error reading directory:", error);
      this._contents = [];
    }
  }

  public get contents(): FsObject[] | null {
    if (this._failed) {
      return null; // Return `null` if the previous attempt failed
    }
    if (this._contents === null) {
      this.readContents();
      if (this._contents === null) {
        this._failed = true; // Cache the failed attempt
      }
    }
    return this._contents!;
  }

  public find<T extends FsObject>(
    itemType: new (...args: unknown[]) => T,
    itemName?: string,
  ): T[] {
    // Special case: return the directory itself
    if (itemName === ".") {
      return [this] as unknown as T[];
    }

    const contents = this.contents;
    if (!contents) return [];

    // First, restrict to the correct type
    const typed = contents.filter((c): c is T => c instanceof itemType);

    // If name omitted → return all items of that type
    if (!itemName) {
      return typed;
    }

    // If name provided → return only those with that name (usually 0–1)
    return typed.filter((c) => c.basename === itemName);
  }

  // Method to log the cached contents to the console
  public logContents(): void {
    const contents = this.contents; // Automatically loads contents if not loaded
    console.log(`Contents of directory ${this.fullPath}:`);

    if (contents?.length) {
      contents.forEach((content) => {
        console.log(content); // Display each entry
      });
    } else {
      console.log("No contents found or error occurred while reading.");
    }
  }
}
