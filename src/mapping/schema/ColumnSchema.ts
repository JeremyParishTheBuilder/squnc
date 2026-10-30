import {
  isSameType,
  sqlTypeFromValue,
  type SqlType,
} from "../../types/SqlType.js";
import { isPrimitiveValue } from "../value/StructuredValue.js";

export class ColumnSchema {
  constructor(
    readonly name: string,
    public type?: SqlType,
    public nullable = false,
  ) {}

  observe(value: unknown): void {
    if (value === null || value === undefined) {
      this.nullable = true;
      return;
    }

    if (!isPrimitiveValue(value)) {
      throw new Error(`Column '${this.name}' received a non-scalar value.`);
    }

    const observed = sqlTypeFromValue(value);

    if (this.type === undefined) {
      this.type = observed;
      return;
    }

    if (!isSameType(this.type, observed)) {
      throw new Error(`Column '${this.name}' has inconsistent observed types.`);
    }
  }

  requireType(): SqlType {
    if (this.type === undefined) {
      throw new Error(`Column '${this.name}' has no inferred type.`);
    }

    return this.type;
  }
}
