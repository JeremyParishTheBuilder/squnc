import type { DiscoveryContext } from "../../../mapping/discovery/DiscoveryContext.js";
import { isStructuredProperty, type StructuredProperty } from "../../../mapping/value/StructuredValue.js";
import type { Expression } from "../Expression.js";

export class CurrentPropertyNameExpression
  implements Expression<DiscoveryContext, string>
{
  evaluate(context: DiscoveryContext): string {
    const current = context.current;

    if (!isStructuredProperty(current)) {
      throw new Error("Expected a structured property.");
    }

    return current.key;
  }
}