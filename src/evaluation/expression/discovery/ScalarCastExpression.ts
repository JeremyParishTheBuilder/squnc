import type { DiscoveryValue } from "../../../mapping/value/DiscoveryValue.js";
import { isPrimitiveValue } from "../../../mapping/value/StructuredValue.js";
import { type ColumnValue } from "../../../types/ColumnValue.js";
import type { Expression } from "../Expression.js";

export class ScalarCastExpression<TContext> implements Expression<
  TContext,
  ColumnValue
> {
  constructor(readonly source: Expression<TContext, DiscoveryValue>) {}

  evaluate(context: TContext): ColumnValue {
    const value = this.source.evaluate(context);

    if (isPrimitiveValue(value)) {
      return value;
    }

    return null;
  }
}
