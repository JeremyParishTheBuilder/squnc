import { Directory } from "../discovery/nodejs/Directory.js";
import { File } from "../discovery/nodejs/File.js";
import type { DiscoveryValue } from "./DiscoveryValue.js";
import {
  isStructuredElement,
  isStructuredProperty,
  isStructuredValue,
} from "./StructuredValue.js";

export type CaptureValue = DiscoveryValue;

export function isCaptureValue(value: unknown): value is CaptureValue {
  if (isStructuredValue(value)) {
    return true;
  }

  if (value instanceof File || value instanceof Directory) {
    return true;
  }

  if (isStructuredProperty(value)) {
    return true;
  }

  if (isStructuredElement(value)) {
    return true;
  }

  return false;
}
