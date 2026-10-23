import type { DiscoveryContext } from "../../../mapping/discovery/DiscoveryContext.js";
import { isStructuredElement } from "../../../mapping/value/StructuredValue.js";
import type { Expression } from "../Expression.js";

export class CurrentElementIndexExpression
  implements Expression<DiscoveryContext, number>
{
  evaluate(context: DiscoveryContext): number {
    const current = context.current;

    if (!isStructuredElement(current)) {
      throw new Error("Expected a structured array.");
    }

    return current.index;
  }
}