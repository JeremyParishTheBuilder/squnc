import type { DiscoveryContext } from "../../../mapping/discovery/DiscoveryContext.js";
import {
  isPrimitiveValue,
  type PrimitiveValue,
  type StructuredValue,
} from "../../../mapping/value/StructuredValue.js";
import type { Expression } from "../Expression.js";

export class CaptureExpression implements Expression<
  DiscoveryContext,
  StructuredValue
> {
  constructor(readonly name: string) {}

  evaluate(context: DiscoveryContext): StructuredValue {
    return context.captures.get(this.name) ?? null;
  }
}

export class CaptureScalarExpression implements Expression<
  DiscoveryContext,
  PrimitiveValue
> {
  constructor(private readonly source: CaptureExpression) {}

  evaluate(context: DiscoveryContext): PrimitiveValue {
    const value = this.source.evaluate(context);

    if (!isPrimitiveValue(value)) {
      throw new Error("Expected a scalar capture.");
    }

    return value;
  }
}
