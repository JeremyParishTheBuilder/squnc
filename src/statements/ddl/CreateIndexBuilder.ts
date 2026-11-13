import type { Predicate } from "../../evaluation/predicate/Predicate.js";
import type { RowView } from "../../relational/RowView.js";
import { type StatementBuilder } from "../Statement.js";
import type { AlterTableStatement } from "./AlterTableStatement.js";

export type IndexColumnSpec = {
  name: string;
  sort?: "ASC" | "DESC";
};

type SortOrder = "ASC" | "DESC";
export type IndexColumnArg = string | readonly [string, SortOrder];

export class CreateIndexBuilder implements StatementBuilder {
  private table?: string;
  private columns?: IndexColumnSpec[];
  private nullsDistinctValue?: boolean;
  private predicate?: Predicate<RowView>;

  constructor(
    private readonly name: string,
    private readonly unique: boolean,
  ) {}

  on(table: string, columns: IndexColumnArg[]): this {
    if (columns.length < 1) {
      throw new Error("No columns provided");
    }

    this.table = table;

    this.columns = columns.map((col) => {
      if (typeof col === "string") {
        return { name: col, sort: "ASC" as const };
      }
      return { name: col[0], sort: col[1] };
    });

    return this;
  }

  nullsDistinct(): this {
    this.nullsDistinctValue = true;

    return this;
  }

  nullsNotDistinct(): this {
    this.nullsDistinctValue = false;

    return this;
  }

  where(predicate: Predicate<RowView>): this {
    this.predicate = predicate;

    return this;
  }

  getNextCalls() {
    const optional: string[] = [];

    if (!this.table || !this.columns || this.columns.length < 1) {
      return {
        required: ["on"],
        optional,
      };
    }

    if (this.nullsDistinctValue === undefined) {
      optional.push("nullsDistinct");
      optional.push("nullsNotDistinct");
    }

    if (this.predicate === undefined) {
      optional.push("where");
    }

    return {
      required: [],
      optional,
    };
  }

  createStatement(): AlterTableStatement {
    if (!this.table || !this.columns || this.columns.length < 1) {
      throw new Error(`Missing table and/or columns`);
    }

    return {
      kind: "alter_table",
      table: this.table,
      operations: [
        {
          op: "add_index",
          index: {
            name: this.name,
            columns: this.columns.map((c) => c.name),
            unique: this.unique,
            nullsDistinct: this.nullsDistinctValue,
            predicate: this.predicate,
          },
        },
      ],
    };
  }
}
