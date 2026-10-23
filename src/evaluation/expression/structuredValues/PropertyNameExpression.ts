import { type StructuredProperty } from "../../../mapping/value/StructuredValue.js";
import { type Expression } from "../Expression.js";

export class PropertyNameExpression implements Expression<
  StructuredProperty,
  string
> {
  evaluate(context: StructuredProperty): string {
    return context.key;
  }
}