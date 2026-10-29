import type { TableReferenceNode } from "../ast/tabular/TableReferenceNode.js";
import type { QueryResult } from "../evaluation/QueryResult.js";
import type { InlineColumnSpec } from "../relational/Column.js";
import type { ConstraintSpec } from "../relational/Constraint.js";
import type { InsertValuesInput } from "../types/InsertSource.js";

export interface PublicInputBatch {
  begin(): PublicInputBatch;
  commit(): PublicInputBatch;
  rollback(): PublicInputBatch;
  createDatabase(name: string): PublicInputBatch;
  useDatabase(name: string): PublicInputBatch;
  createTable(
    table: string,
    columnList?: InlineColumnSpec[],
    constraintList?: ConstraintSpec[],
  ): PublicInputBatch;
  insertInto(
    table: string | TableReferenceNode,
    columns?: string[],
  ): PublicInputBatch;
  values(data: InsertValuesInput[][]): PublicInputBatch;
  execute(): QueryResult[];
}
