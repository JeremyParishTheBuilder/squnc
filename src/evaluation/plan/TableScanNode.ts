import { type PlanNode } from "./PlanNode.js";
import { type RowView } from "../../relational/RowView.js";
import { type Table } from "../../relational/Table.js";
import type { QueryColumn } from "./QueryPlan.js";

export class TableScanNode implements PlanNode {
  constructor(public table: Table) {}

  public *execute(): IterableIterator<RowView> {
    yield* this.table.iterateAliveRows();
  }
}

export function queryColumnsFromTable(table: Table): QueryColumn[] {
  return [...table.columns.values()].map((column) => ({
    name: column.name,
    type: column.type,
    nullable: column.nullable,
  }));
}
