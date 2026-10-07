import type { DiscoveryValue } from "../value/DiscoveryValue.js";
import type { FsObject } from "./nodejs/FsObject.js";

export interface DiscoverySource {
  open(): DiscoveryValue;
}