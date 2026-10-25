import type { JsonValuePath } from "../../../mapping/value/JsonValuePath.js";
import {
  isPrimitiveValue,
  type PrimitiveValue,
  type StructuredValue,
} from "../../../mapping/value/StructuredValue.js";
import type { Expression } from "../Expression.js";

export class JsonValueExpression<TContext> implements Expression<
  TContext,
  PrimitiveValue
> {
  constructor(
    readonly source: Expression<TContext, StructuredValue>,
    public readonly path: JsonValuePath,
  ) {}

  evaluate(context: TContext): PrimitiveValue {
    const value = this.source.evaluate(context);
    const result = this.path.resolve(value);

    if (result === undefined) {
      const sourceType =
        value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

      throw new Error(
        `JSON_VALUE path "${this.path}" did not resolve. Source type: ${sourceType}.`,
      );
    }

    if (!isPrimitiveValue(result)) {
      throw new Error("JSON_VALUE result must be a scalar value.");
    }

    if (result === null) {
      return null;
    }

    return String(result);
  }
}
