import type { DiscoveryValue } from "../value/DiscoveryValue.js";

export class PropertyPath {
  constructor(readonly parts: readonly string[]) {}

  resolve(value: DiscoveryValue): DiscoveryValue {
    let current = value;

    for (const part of this.parts) {
      if (current == null || typeof current !== "object") {
        return null;
      }

      current = (current as Record<string, unknown>)[part] as DiscoveryValue;
    }

    return current;
  }

  static parse(path: string): PropertyPath {
    return new PropertyPath(path.split("."));
  }
}
