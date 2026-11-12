import { type BaseStatement, type StatementBuilder } from "../Statement.js";
import { type InlineColumnSpec } from "../../relational/Column.js";
import { type ConstraintSpec } from "../../relational/Constraint.js";
import type { QueryStatement } from "../dql/QueryStatement.js";

export interface CreateTableStatement extends BaseStatement {
  kind: "create_table";
  table: string;

  columnList?: InlineColumnSpec[];
  constraintList?: ConstraintSpec[];

  source?: QueryStatement;
}

export class CreateTableBuilder implements StatementBuilder {
  private source?: QueryStatement;

  constructor(
    private table: string,
    private columns?: InlineColumnSpec[],
    private constraints?: ConstraintSpec[],
  ) {}

  as(query: QueryStatement): this {
    this.assertNoSource();

    this.source = query;

    return this;
  }

  getNextCalls() {
    if (!this.source) {
      return {
        required: [],
        optional: ["as"],
      };
    }

    return {
      required: [],
      optional: [],
    };
  }

  createStatement(): CreateTableStatement {
    return {
      kind: "create_table",
      table: this.table,
      columnList: this.columns,
      constraintList: this.constraints,
      source: this.source,
    };
  }

  assertNoSource(): void {
    if (this.source) {
      throw new Error(`Insert Into Builder already has an Insert Source.`);
    }
  }
}
