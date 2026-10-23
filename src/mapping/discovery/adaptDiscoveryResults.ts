import { type PrimitiveValue, type StructuredArray, type StructuredObject, type StructuredValue } from "../value/StructuredValue.js";
import type { DiscoveryMetadata } from "./DiscoveryMetadata.js";
import type { DiscoveryResult } from "./DiscoveryResult.js";

export function adaptDiscoveryResult(
  result: DiscoveryResult,
): StructuredObject {
  return {
    resultId: result.resultId,
    parentResultId: result.parentResultId,
    nodeType: result.nodeType,
    identity: arrayToStructuredArray(result.identity.parts),
    value: result.value,
    metadata: adaptMetadata(result.metadata),
    captures: mapToStructuredObject(result.captures),
  };
}

function arrayToStructuredArray(
  values: readonly PrimitiveValue[],
): StructuredArray {
  return [...values];
}

function mapToStructuredObject(
  values: ReadonlyMap<string, StructuredValue>,
): StructuredObject {
  const output: StructuredObject = {};

  for (const [key, value] of values) {
    output[key] = value;
  }

  return output;
}

export function adaptMetadata(
  metadata: DiscoveryMetadata,
): StructuredValue {
  const result: StructuredObject = {};

  if (metadata.source) {
    result.source = {
      kind: metadata.source.kind,
      ...(metadata.source.basename !== undefined
        ? { basename: metadata.source.basename }
        : {}),
      ...(metadata.source.fullPath !== undefined
        ? { fullPath: metadata.source.fullPath }
        : {}),
    };
  }

  if (metadata.position) {
    result.position =
      metadata.position.kind === "property"
        ? {
            kind: "property",
            key: metadata.position.key,
          }
        : {
            kind: "element",
            index: metadata.position.index,
          };
  }

  if (metadata.processing) {
    result.processing = {
      status: metadata.processing.status,
      ...(metadata.processing.operation !== undefined
        ? { operation: metadata.processing.operation }
        : {}),
      ...(metadata.processing.decoder !== undefined
        ? { decoder: metadata.processing.decoder }
        : {}),
      ...(metadata.processing.message !== undefined
        ? { message: metadata.processing.message }
        : {}),
    };
  }

  return result;
}