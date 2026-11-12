import { type BaseStatement, type StatementBuilder } from "../Statement.js";
import type {
  InsertSource,
  InsertValuesInput,
} from "../../types/InsertSource.js";
import type { DefaultValueNode } from "../../ast/DefaultValueNode.js";
import { toExpressionNode } from "../../semantic/toExpressionNode.js";
import type { ExpressionNode } from "../../ast/expression/ExpressionNode.js";
import type { QueryStatement } from "../dql/QueryStatement.js";
import { TableReferenceNode } from "../../ast/tabular/TableReferenceNode.js";

export interface InsertIntoStatement extends BaseStatement {
  kind: "insert_into";
  table: TableReferenceNode;
  columns: string[];
  source: InsertSource;
  returning?: string[];
}

export class InsertIntoBuilder implements StatementBuilder {
  private readonly table: TableReferenceNode;
  private source?: InsertSource;
  private returningCols?: string[];

  constructor(
    table: string | TableReferenceNode,
    private columns: string[] = [],
  ) {
    this.table =
      typeof table === "string" ? new TableReferenceNode(table) : table;
  }

  defaultValues(): this {
    this.assertNoSource();

    this.source = { kind: "defaultValues" };

    return this;
  }

  values(data: InsertValuesInput[][]): this {
    this.assertNoSource();

    this.source = {
      kind: "values",
      rows: normalizeInsertValues(data),
    };

    return this;
  }

  select(query: QueryStatement): this {
    this.assertNoSource();

    this.source = {
      kind: "query",
      query,
    };

    return this;
  }

  returning(cols: string[]): this {
    if (!this.source) {
      throw new Error(`Cannot call returning() before Insert Source provided`);
    }
    this.returningCols = cols;

    return this;
  }

  getNextCalls() {
    if (!this.source)
      return {
        required: ["defaultValues", "values", "select"],
        optional: [],
      };
    return {
      required: [],
      optional: ["returning"],
    };
  }

  createStatement(): InsertIntoStatement {
    if (!this.source) {
      throw new Error("INSERT requires a Source");
    }

    return {
      kind: "insert_into",
      table: this.table,
      columns: this.columns,
      source: this.source,
      returning: this.returningCols,
    };
  }

  assertNoSource(): void {
    if (this.source) {
      throw new Error(`Insert Into Builder already has an Insert Source.`);
    }
  }
}

export function normalizeInsertValues(
  data: InsertValuesInput[][],
): (ExpressionNode | DefaultValueNode)[][] {
  const normalized: (ExpressionNode | DefaultValueNode)[][] = [];

  for (const row of data) {
    const normalizedRow: (ExpressionNode | DefaultValueNode)[] = [];

    for (const value of row) {
      normalizedRow.push(toExpressionNode(value));
    }

    normalized.push(normalizedRow);
  }

  return normalized;
}
