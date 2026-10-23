import { File } from "../nodejs/File.js";
import type { DiscoveryValue } from "../../value/DiscoveryValue.js";
import type { DecodeResult, DiscoveryDecoder } from "./DiscoveryDecoder.js";
import type { StructuredValue } from "../../value/StructuredValue.js";

export class JsonDecoder implements DiscoveryDecoder<File> {
  accepts(value: DiscoveryValue): value is File {
    return value instanceof File;
  }

  decode(value: File): DecodeResult {
    if (!value.basename.endsWith(".json")) {
      return {
        status: "failed",
        operation: "read",
        message: `Expected a JSON file, got '${value.basename}'.`,
      };
    }

    const contents = value.contents();

    if (contents === null) {
      return {
        status: "failed",
        operation: "read",
        message: `Could not read file '${value.fullPath}'.`,
      };
    }

    try {
      return {
        status: "success",
        value: JSON.parse(contents) as StructuredValue,
      };
    } catch {
      return {
        status: "failed",
        operation: "decode",
        message: `Invalid JSON in '${value.fullPath}'.`,
      };
    }
  }
}