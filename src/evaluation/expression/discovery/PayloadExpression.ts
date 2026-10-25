import type { DiscoveryContext } from "../../../mapping/discovery/DiscoveryContext.js";
import type { StructuredValue } from "../../../mapping/value/StructuredValue.js";
import type { Expression } from "../Expression.js";

export class PayloadExpression implements Expression<
  DiscoveryContext,
  StructuredValue
> {
  evaluate(context: DiscoveryContext): StructuredValue {
    return context.payload;
  }
}
