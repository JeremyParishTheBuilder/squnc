import type { DiscoveryResult } from "../../../mapping/discovery/DiscoveryResult.js";
import type { DiscoveryValue } from "../../../mapping/value/DiscoveryValue.js";
import type { Expression } from "../Expression.js";

export class DiscoveryValueExpression implements Expression<
  DiscoveryResult,
  DiscoveryValue
> {
  //constructor(public discoveryResult: DiscoveryResult) {}

  evaluate(context: DiscoveryResult): DiscoveryValue {
    return context.value;
  }
}
//TODO, remove maybe