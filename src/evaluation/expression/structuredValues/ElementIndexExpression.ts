import { type StructuredElement } from "../../../mapping/value/StructuredValue.js";
import { type Expression } from "../Expression.js";

export class ElementIndexExpression implements Expression<
  StructuredElement,
  number
> {
  evaluate(context: StructuredElement): number {
    return context.index;
  }
}
