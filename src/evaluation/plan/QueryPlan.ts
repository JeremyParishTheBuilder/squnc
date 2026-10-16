import type { RowView } from "../../relational/RowView.js";
import type { Table } from "../../relational/Table.js";
import type { SqlType } from "../../types/SqlType.js";
import { type PlanNode } from "./PlanNode.js";

export interface QueryPlan {
  root: PlanNode;
  columns: readonly QueryColumn[];
}

export type QueryColumn = {
  name: string;
  type: SqlType;
  nullable: boolean;
};