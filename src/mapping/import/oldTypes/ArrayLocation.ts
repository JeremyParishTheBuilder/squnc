import type { StructuredValue } from "../../value/StructuredValue.js";

export interface ArrayLocation {
  readonly path: readonly string[];
  readonly values: readonly StructuredValue[];
}
