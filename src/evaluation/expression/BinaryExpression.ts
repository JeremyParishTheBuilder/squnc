import { type ColumnValue } from "../../types/ColumnValue.js";
import { type Expression } from "./Expression.js";
import { assertIsNumber } from "../utility/assertIsNumber.js";

export class BinaryExpression<TContext> implements Expression<TContext> {
  constructor(
    public readonly left: Expression<TContext>,
    public readonly operator:
      "add" | "subtract" | "multiply" | "divide" | "mod",
    public readonly right: Expression<TContext>,
  ) {}

  evaluate(context: TContext): ColumnValue {
    const leftResult = this.left.evaluate(context);
    const rightResult = this.right.evaluate(context);

    if (leftResult === null || rightResult === null) {
      return false;
    }

    //assertPrimitiveValue(leftResult);
    //assertPrimitiveValue(rightResult);

    switch (this.operator) {
      case "add":
        assertIsNumber(leftResult);
        assertIsNumber(rightResult);
        return leftResult + rightResult;
      case "subtract":
        assertIsNumber(leftResult);
        assertIsNumber(rightResult);
        return leftResult - rightResult;
      case "multiply":
        assertIsNumber(leftResult);
        assertIsNumber(rightResult);
        return leftResult * rightResult;
      case "divide":
        assertIsNumber(leftResult);
        assertIsNumber(rightResult);
        return leftResult / rightResult;
      case "mod":
        assertIsNumber(leftResult);
        assertIsNumber(rightResult);
        return leftResult % rightResult;

      default:
        throw new Error(`Unsupported operator: ${this.operator}`);
    }
  }
}
