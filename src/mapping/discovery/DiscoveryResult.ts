import type { StructuredObjectShape } from "../../semantic/relation/StructuredObjectScope.js";
import { SQL_INTEGER, SQL_VARCHAR } from "../../types/SqlType.js";
import type { CaptureValue } from "../value/CaptureValue.js";
import { DiscoveryValue } from "../value/DiscoveryValue.js";
import { DiscoveryIdentity } from "./DiscoveryIdentity.js";

export type DiscoveryResultId = number & {
  readonly __brand: "discoveryResult";
};

export class DiscoveryResult {
  constructor(
    readonly resultId: DiscoveryResultId,
    readonly parentResultId: DiscoveryResultId | null,
    readonly nodeType: string,
    readonly identity: DiscoveryIdentity,
    readonly value: DiscoveryValue,
    readonly captures: Map<string, CaptureValue>,
  ) {}
}

export const discoveryResultShape: StructuredObjectShape = {
  properties: {
    resultId: {
      valueType: { kind: "scalar", sqlType: SQL_INTEGER },
      nullable: false,
    },
    parentResultId: {
      valueType: { kind: "scalar", sqlType: SQL_INTEGER },
      nullable: true,
    },
    nodeType: {
      valueType: { kind: "scalar", sqlType: SQL_VARCHAR },
      nullable: false,
    },
    identity: {
      valueType: { kind: "array" },
      nullable: false,
    },
    value: {
      valueType: { kind: "structured-value" },
      nullable: false,
    },
    captures: {
      valueType: { kind: "map" },
      nullable: false,
    },
  },
};