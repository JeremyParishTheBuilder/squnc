import type { DiscoveryContext } from "../../../mapping/discovery/DiscoveryContext.js";
import type { DiscoveryValue } from "../../../mapping/value/DiscoveryValue.js";
import type { Expression } from "../Expression.js";

export class DiscoveryContextExpression<
  TSubject extends DiscoveryValue,
  TResult,
> implements Expression<DiscoveryContext, TResult> {
  constructor(
    private readonly expression: Expression<TSubject, TResult>,
    private readonly select: (context: DiscoveryContext) => TSubject,
  ) {}

  evaluate(context: DiscoveryContext): TResult {
    return this.expression.evaluate(this.select(context));
  }
}
