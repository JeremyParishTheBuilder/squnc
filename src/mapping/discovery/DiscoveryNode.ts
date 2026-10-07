import type { ExpressionBuilder } from "../dsl/expression/ExpressionBuilder.js";
import type { PredicateBuilder } from "../dsl/predicate/PredicateBuilder.js";
import type { CaptureValue } from "../value/CaptureValue.js";
import type { DiscoveryDecoder } from "./decoding/DiscoveryDecoder.js";
import { type DiscoveryContext } from "./DiscoveryContext.js";
import { DiscoveryResult, type DiscoveryResultId } from "./DiscoveryResult.js";
import type { DiscoveryNavigator } from "./navigation/DiscoveryNavigator.js";
import type { DiscoveryValue } from "../value/DiscoveryValue.js";
import type { DiscoveryResults } from "./DiscoveryResults.js";

export interface DiscoveryNodeSpec<
  TCurrent extends DiscoveryValue,
  TNavigation extends DiscoveryValue,
  TDecoded extends DiscoveryValue,
> {
  readonly nodeType: string;
  readonly navigator: DiscoveryNavigator<TCurrent, TNavigation>;
  readonly matcher: PredicateBuilder<TNavigation>;
  readonly children: readonly DiscoveryNode[];
  readonly captures?: Record<
    string,
    ExpressionBuilder<DiscoveryContext, CaptureValue>
  >;
  readonly decoder?: DiscoveryDecoder<TNavigation, TDecoded>;
}

export class DiscoveryNode {
  constructor(
    readonly spec: DiscoveryNodeSpec<
      DiscoveryValue,
      DiscoveryValue,
      DiscoveryValue
    >,
  ) {}

  discover(
    discoveryResults: DiscoveryResults,
    parentResultId: DiscoveryResultId | null,
    context: DiscoveryContext,
  ): /*DiscoveryResult[]*/void {
    const results: DiscoveryResult[] = [];

    const decoder = this.spec.decoder;

    const navigator = this.spec.navigator;

    if (!navigator.accepts(context.current)) {
      return;
      //return [];
    }

    const candidates = navigator.next(context.current);

    for (const candidate of candidates) {
      if (!this.spec.matcher.evaluate(candidate)) {
        continue;
      }

      let current: DiscoveryValue = candidate;

      if (decoder) {
        if (!decoder.accepts(current)) {
          continue;
        }

        const decoded = this.spec.decoder.decode(current);

        if (decoded == null) {
          continue;
        }

        current = decoded;
      }

      let childContext = context
        .withCurrent(current)
        .withIdentityParts(navigator.identityParts(context.current, candidate));

      for (const [name, builder] of Object.entries(this.spec.captures ?? {})) {
        childContext = childContext.withCapture(
          name,
          builder.evaluate(childContext),
        );
      }

      const result = discoveryResults.createDiscoveryResult(
        parentResultId,
        this.spec.nodeType,
        childContext.identity,
        current,
        new Map(childContext.captures),
      );

      for (const childNode of this.spec.children) {
        //result.children.push(
          //...childNode.discover(
          childNode.discover(
            discoveryResults,
            result.resultId,
            childContext,
          );
        //);
      }

      results.push(result);

      console.log(this.spec.nodeType, "children:", this.spec.children.length);
    }

    //return results;
  }
}
