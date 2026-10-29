import type { QueryColumn } from "../../evaluation/plan/QueryPlan.js";
import { SQL_INTEGER, SQL_JSON, SQL_VARCHAR } from "../../types/SqlType.js";
import type { StructuredValue } from "../value/StructuredValue.js";
import { DiscoveryIdentity } from "./DiscoveryIdentity.js";
import type { DiscoveryMetadata } from "./DiscoveryMetadata.js";
import type { DiscoveryPayload } from "./DiscoveryPayload.js";

export type DiscoveryResultId = number & {
  readonly __brand: "discoveryResult";
};

export class DiscoveryResult {
  constructor(
    readonly resultId: DiscoveryResultId,
    readonly parentResultId: DiscoveryResultId | null,
    readonly nodeType: string,
    readonly identity: DiscoveryIdentity,
    readonly value: DiscoveryPayload,
    readonly metadata: DiscoveryMetadata,
    readonly captures: Map<string, StructuredValue>,
  ) {}
}

export function discoveryColumns(): QueryColumn[] {
  return [
    { name: "resultId", type: SQL_INTEGER, nullable: false },
    { name: "parentResultId", type: SQL_INTEGER, nullable: true },
    { name: "nodeType", type: SQL_VARCHAR, nullable: false },
    { name: "identity", type: SQL_JSON, nullable: false },
    { name: "value", type: SQL_JSON, nullable: true },
    { name: "metadata", type: SQL_JSON, nullable: true },
    { name: "captures", type: SQL_JSON, nullable: false },
  ];
}