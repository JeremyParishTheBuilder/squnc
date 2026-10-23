import type { ExpressionBuilder } from "../dsl/expression/ExpressionBuilder.js";
import type { PredicateBuilder } from "../dsl/predicate/PredicateBuilder.js";
import type { DiscoveryDecoder } from "./decoding/DiscoveryDecoder.js";
import { type DiscoveryContext } from "./DiscoveryContext.js";
import { DiscoveryResult, type DiscoveryResultId } from "./DiscoveryResult.js";
import type { DiscoveryNavigator } from "./navigation/DiscoveryNavigator.js";
import type { DiscoveryValue } from "../value/DiscoveryValue.js";
import type { DiscoveryResults } from "./DiscoveryResults.js";
import type { DiscoveryPayload } from "./DiscoveryPayload.js";
import type { DiscoveryMetadata, ProcessingMetadata, SourceMetadata, StructuralPosition } from "./DiscoveryMetadata.js";
import { isStructuredElement, isStructuredProperty, isStructuredValue, type StructuredValue } from "../value/StructuredValue.js";
import { Directory } from "./nodejs/Directory.js";
import { File } from "./nodejs/File.js";

export interface DiscoveryNodeSpec<
  TCurrent extends DiscoveryValue,
  TNavigation extends DiscoveryValue,
> {
  readonly nodeType: string;
  readonly navigator: DiscoveryNavigator<TCurrent, TNavigation>;
  readonly matcher: PredicateBuilder<DiscoveryContext>;
  readonly children: readonly DiscoveryNode[];
  readonly captures?: Record<
    string,
    ExpressionBuilder<DiscoveryContext, StructuredValue>
  >;
  readonly decoder?: DiscoveryDecoder<TNavigation>;
}

export class DiscoveryNode {
  constructor(
    readonly spec: DiscoveryNodeSpec<
      DiscoveryValue,
      DiscoveryValue
    >,
  ) {}

  discover(
    discoveryResults: DiscoveryResults,
    parentResultId: DiscoveryResultId | null,
    context: DiscoveryContext,
  ): void {
    const results: DiscoveryResult[] = [];

    const decoder = this.spec.decoder;
    const navigator = this.spec.navigator;
    if (!navigator.accepts(context.current)) {
      return;
    }

    const candidates = navigator.next(context.current);

    for (const candidate of candidates) {

      const candidateContext = context.withCurrent(candidate);

      if (!this.spec.matcher.evaluate(candidateContext)) {
        continue;
      }

      const sourceMetadata = metadataFromSource(candidate);
      const position = structuralPositionFrom(candidate);

      let current: DiscoveryValue = candidate;
      let payload: DiscoveryPayload = payloadFromValue(candidate);
      let processing: ProcessingMetadata | undefined;

      if (decoder) {
        if (!decoder.accepts(candidate)) {
          continue;
        }

        const decoded = this.spec.decoder.decode(candidate);

        if (decoded.status === "failed") {
          payload = null;
          processing = {
            status: "failed",
            operation: decoded.operation,
            message: decoded.message,
          };
        } else {
          current = decoded.value;
          payload = decoded.value;
          processing = { status: "success" };
        }
      }

      const metadata: DiscoveryMetadata = {
        ...(sourceMetadata ? { source: sourceMetadata } : {}),
        ...(position ? { position } : {}),
        ...(processing ? { processing } : {}),
      };

      let childContext = candidateContext
        .withCurrent(current)
        .withIdentityParts(
          navigator.identityParts(context.current, candidate))
        .withPayload(payload);

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
        payload,
        metadata,
        new Map(childContext.captures),
      );

      for (const childNode of this.spec.children) {
          childNode.discover(
            discoveryResults,
            result.resultId,
            childContext,
          );
      }

      results.push(result);
    }
  }
}

function metadataFromSource(
  value: DiscoveryValue,
): SourceMetadata | undefined {
  if (value instanceof File) {
    return {
      kind: "file",
      basename: value.basename,
      fullPath: value.fullPath,
    };
  }

  if (value instanceof Directory) {
    return {
      kind: "directory",
      basename: value.basename,
      fullPath: value.fullPath,
    };
  }

  return undefined;
}

function structuralPositionFrom(
  value: DiscoveryValue,
): StructuralPosition | undefined {
  if (isStructuredProperty(value)) {
    return {
      kind: "property",
      key: value.key,
    };
  }

  if (isStructuredElement(value)) {
    return {
      kind: "element",
      index: value.index,
    };
  }

  return undefined;
}

function payloadFromValue(
  value: DiscoveryValue,
): DiscoveryPayload {
  if (isStructuredProperty(value) || isStructuredElement(value)) {
    return value.value;
  }

  if (isStructuredValue(value)) {
    return value;
  }

  // Physical sources are not SQL-compatible payloads.
  return null;
}