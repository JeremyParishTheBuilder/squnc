import type { FsObject } from "../discovery/nodejs/FsObject.js";
import type {
  StructuredElement,
  StructuredProperty,
  StructuredValue,
} from "./StructuredValue.js";

export type DiscoveryValue =
  FsObject | StructuredValue | StructuredProperty | StructuredElement;
