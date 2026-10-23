import { adaptDiscoveryResult } from "../../mapping/discovery/adaptDiscoveryResults.js";
import type { DiscoveryResult } from "../../mapping/discovery/DiscoveryResult.js";
import type { DiscoveryResults } from "../../mapping/discovery/DiscoveryResults.js";
import type { RowView } from "../../relational/RowView.js";
import { SQL_INTEGER, SQL_JSON, SQL_VARCHAR } from "../../types/SqlType.js";
import type { PlanNode } from "./PlanNode.js";
import type { QueryColumn } from "./QueryPlan.js";

export class DiscoveryScanNode implements PlanNode {
  constructor(
    readonly discovery: DiscoveryResults,
  ) {}

  *execute(): IterableIterator<RowView> {
    for (const result of this.discovery.getAll()) {
      yield discoveryResultAsRowView(result);
    }
  }
}

function discoveryResultAsRowView(
  result: DiscoveryResult,
): RowView {
  const adapted = adaptDiscoveryResult(result);

  return {
    index: result.resultId,
    values: [
      adapted.resultId,
      adapted.parentResultId,
      adapted.nodeType,
      adapted.identity,
      adapted.value,
      adapted.metadata,
      adapted.captures,
    ],
  };
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