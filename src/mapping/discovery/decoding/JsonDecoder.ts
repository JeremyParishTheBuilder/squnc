import { File } from "../nodejs/File.js";
import type { DiscoveryValue } from "../../value/DiscoveryValue.js";
import type { DiscoveryDecoder } from "./DiscoveryDecoder.js";
import fs from "fs";
import type { StructuredObject } from "../../value/StructuredValue.js";

export class JsonDecoder implements DiscoveryDecoder<File, StructuredObject> {
  accepts(value: DiscoveryValue): value is File {
    return value instanceof File;
  }

  decode(value: File): StructuredObject | null {
    if (!value.basename.endsWith(".json")) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(value.fullPath, "utf8"));
    } catch {
      return null;
    }
  }
}
