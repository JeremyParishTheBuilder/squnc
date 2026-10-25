import type {
  QueryColumn,
  QueryPlan,
} from "../../evaluation/plan/QueryPlan.js";
import type { ColumnId } from "../../relational/Column.js";
import type { Table } from "../../relational/Table.js";

export interface RelationColumn {
  column: QueryColumn;
  columnId?: ColumnId;
}

export function relationColumnsFromTable(table: Table): RelationColumn[] {
  return [...table.getColumnsInOrder()].map((column) => ({
    column: {
      name: column.name,
      type: column.type,
      nullable: column.nullable,
    },
    columnId: column.id,
  }));
}

export function relationColumnsFromQueryPlan(
  plan: QueryPlan,
): RelationColumn[] {
  return plan.columns.map((column) => ({
    column,
  }));
}
