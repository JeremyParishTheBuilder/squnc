import type { DiscoveryValue } from "../value/DiscoveryValue.js";

export interface DiscoverySource {
  open(): DiscoveryValue;
}
