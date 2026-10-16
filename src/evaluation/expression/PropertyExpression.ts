import type { StructuredObject, StructuredValue } from "../../mapping/value/StructuredValue.js";
import type { Expression } from "./Expression.js";

export class PropertyExpression implements Expression<StructuredObject, StructuredValue> {
  constructor(public propertyName: string) {}

  evaluate(object: StructuredObject): StructuredValue {
    return object[this.propertyName];
  }
}
