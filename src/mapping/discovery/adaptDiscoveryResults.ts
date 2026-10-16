import type { CaptureValue } from "../value/CaptureValue.js";
import type { DiscoveryValue } from "../value/DiscoveryValue.js";
import { isStructuredElement, isStructuredProperty, isStructuredValue, type PrimitiveValue, type StructuredArray, type StructuredObject, type StructuredValue } from "../value/StructuredValue.js";
import type { DiscoveryResult } from "./DiscoveryResult.js";
import { Directory } from "./nodejs/Directory.js";
import { File } from "./nodejs/File.js";
import type { FsObject } from "./nodejs/FsObject.js";

export function adaptDiscoveryResult(
  result: DiscoveryResult,
): StructuredObject {
  return {
    resultId: result.resultId,
    parentResultId: result.parentResultId,
    nodeType: result.nodeType,
    identity: arrayToStructuredArray(result.identity.parts),
    value: adaptDiscoveryValue(result.value),
    captures: mapToStructuredObject(result.captures),
  };
}

function arrayToStructuredArray(
  values: readonly PrimitiveValue[],
): StructuredArray {
  return [...values];
}

function mapToStructuredObject(
  values: ReadonlyMap<string, CaptureValue>,
): StructuredObject {
  const output: StructuredObject = {};

  for (const [key, value] of values) {
    output[key] = adaptDiscoveryValue(value);
  }

  return output;
}

function adaptDiscoveryValue(
  value: DiscoveryValue,
): StructuredValue {
  if (isStructuredProperty(value)) {
    return {
      key: value.key,
      value: adaptDiscoveryValue(value.value),
    };
  }

  if (isStructuredElement(value)) {
    return {
      index: value.index,
      value: adaptDiscoveryValue(value.value),
    };
  }

  if (isStructuredValue(value)) {
    return value;
  }

  if (value instanceof Directory) {
    return adaptDirectory(value);
  }

  if (value instanceof File) {
    return adaptFile(value);
  }

  throw new Error("Unsupported DiscoveryValue");
}

function adaptDirectory(directory: Directory): StructuredObject {
  const contents = directory.contents;

  return {
    kind: "directory",
    basename: directory.basename,
    fullPath: directory.fullPath,
    contents:
      contents === null
        ? null
        : contents.map(adaptFsObjectLeaf),
  };
}

function adaptFsObjectLeaf(
  fsObject: FsObject,
): StructuredObject {
  if (fsObject instanceof Directory) {
    return {
      kind: "directory",
      basename: fsObject.basename,
      fullPath: fsObject.fullPath,
    };
  }

  if (fsObject instanceof File) {
    return {
      kind: "file",
      basename: fsObject.basename,
      fullPath: fsObject.fullPath,
    };
  }

  throw new Error("Unsupported FsObject type");
}

function adaptFile(file: File): StructuredObject {
  const contents = file.contents;

  if (contents !== null) {
    assertIsStructuredValue(contents);
  }

  return {
    kind: "file",
    basename: file.basename,
    fullPath: file.fullPath,
    contents,
  };
}

function assertIsStructuredValue(
  value: unknown,
): asserts value is StructuredValue {
  if (!isStructuredValue(value)) {
    throw new Error("File contents are not a valid StructuredValue");
  }
}