import { BinaryExpression } from "../../../evaluation/expression/BinaryExpression.js";
import type { Expression } from "../../../evaluation/expression/Expression.js";
import { LiteralExpression } from "../../../evaluation/expression/LiteralExpression.js";
import { ComparisonPredicate } from "../../../evaluation/predicate/ComparisonPredicate.js";
import type { ColumnValue } from "../../../types/ColumnValue.js";
import type { PrimitiveValue } from "../../value/StructuredValue.js";
import { PredicateBuilder } from "../predicate/PredicateBuilder.js";
import { ExpressionBuilder } from "./ExpressionBuilder.js";

export class ScalarExpressionBuilder<TContext> extends ExpressionBuilder<
  TContext,
  ColumnValue
> {
  private unwrap(
    value: ScalarExpressionBuilder<TContext> | PrimitiveValue,
  ): Expression<TContext> {
    if (value instanceof ScalarExpressionBuilder) {
      return value.expression;
    }

    return new LiteralExpression(value);
  }

  eq(rhs: ScalarExpressionBuilder<TContext> | PrimitiveValue) {
    return new PredicateBuilder<TContext>(
      new ComparisonPredicate(this.expression, "eq", this.unwrap(rhs)),
    );
  }

  ne(rhs: ScalarExpressionBuilder<TContext> | PrimitiveValue) {
    return new PredicateBuilder<TContext>(
      new ComparisonPredicate(this.expression, "ne", this.unwrap(rhs)),
    );
  }

  gt(rhs: ScalarExpressionBuilder<TContext> | PrimitiveValue) {
    return new PredicateBuilder<TContext>(
      new ComparisonPredicate(this.expression, "gt", this.unwrap(rhs)),
    );
  }

  gte(rhs: ScalarExpressionBuilder<TContext> | PrimitiveValue) {
    return new PredicateBuilder<TContext>(
      new ComparisonPredicate(this.expression, "gte", this.unwrap(rhs)),
    );
  }

  lt(rhs: ScalarExpressionBuilder<TContext> | PrimitiveValue) {
    return new PredicateBuilder<TContext>(
      new ComparisonPredicate(this.expression, "lt", this.unwrap(rhs)),
    );
  }

  lte(rhs: ScalarExpressionBuilder<TContext> | PrimitiveValue) {
    return new PredicateBuilder<TContext>(
      new ComparisonPredicate(this.expression, "lte", this.unwrap(rhs)),
    );
  }

  add(rhs: ScalarExpressionBuilder<TContext> | PrimitiveValue) {
    return new ExpressionBuilder(
      new BinaryExpression(this.expression, "add", this.unwrap(rhs)),
    );
  }

  subtract(rhs: ScalarExpressionBuilder<TContext> | PrimitiveValue) {
    return new ExpressionBuilder(
      new BinaryExpression(this.expression, "subtract", this.unwrap(rhs)),
    );
  }

  multiply(rhs: ScalarExpressionBuilder<TContext> | PrimitiveValue) {
    return new ExpressionBuilder(
      new BinaryExpression(this.expression, "multiply", this.unwrap(rhs)),
    );
  }

  divide(rhs: ScalarExpressionBuilder<TContext> | PrimitiveValue) {
    return new ExpressionBuilder(
      new BinaryExpression(this.expression, "divide", this.unwrap(rhs)),
    );
  }

  mod(rhs: ScalarExpressionBuilder<TContext> | PrimitiveValue) {
    return new ExpressionBuilder(
      new BinaryExpression(this.expression, "mod", this.unwrap(rhs)),
    );
  }
}
