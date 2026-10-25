import type { JsonValuePath } from "../../../mapping/value/JsonValuePath.js";
import {
  isStructuredContainer,
  type StructuredContainer,
  type StructuredValue,
} from "../../../mapping/value/StructuredValue.js";
import type { Expression } from "../Expression.js";

export class JsonQueryExpression<TContext> implements Expression<
  TContext,
  StructuredValue
> {
  constructor(
    readonly source: Expression<TContext, StructuredValue>,
    public readonly path: JsonValuePath,
  ) {}

  evaluate(context: TContext): StructuredContainer {
    const value = this.source.evaluate(context);
    const result = this.path.resolve(value);

    if (result === undefined) {
      const sourceType =
        value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

      throw new Error(
        `JSON_QUERY path "${this.path}" did not resolve. Source type: ${sourceType}.`,
      );
    }

    if (!isStructuredContainer(result)) {
      throw new Error("JSON_QUERY result must be an object or array.");
    }

    return result;
  }
}
