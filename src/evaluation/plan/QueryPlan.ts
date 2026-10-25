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
