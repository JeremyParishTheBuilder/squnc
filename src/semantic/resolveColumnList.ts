import { type Column, type ColumnId } from "../relational/Column.js";
import { type Table } from "../relational/Table.js";

export function resolveTargetColumns(
  table: Table,
  statementColumns: string[],
): Column[] {
  if (
    statementColumns.length === 0 ||
    (statementColumns.length === 1 && statementColumns[0] === "*")
  ) {
    return table.getColumnsInOrder();
  }

  const columnsSeen = new Set<ColumnId>();
  const result: Column[] = [];

  for (const name of statementColumns) {
    const column = table.columns.requireByName(name);

    if (columnsSeen.has(column.id)) {
      throw new Error(`Duplicate column: ${name}`);
    }

    columnsSeen.add(column.id);

    result.push(column);
  }

  return result;
}
