import { type BaseStatement, type StatementBuilder } from "../Statement.js";
import { type PredicateNode } from "../../ast/predicate/PredicateNode.js";

export interface DeleteFromStatement extends BaseStatement {
  kind: "delete_from";
  table: string;
  where?: PredicateNode;
  returning?: string[];
}

export class DeleteFromBuilder implements StatementBuilder {
  private whereClause?: PredicateNode;
  private returningCols?: string[];

  constructor(private table: string) {}

  where(predicate: PredicateNode) {
    this.whereClause = predicate;
  }

  returning(cols: string[]) {
    this.returningCols = cols;
  }

  getNextCalls(): {
    required: string[];
    optional: string[];
  } {
    const required: string[] = [];
    const optional: string[] = [];

    const nextCalls = {
      required,
      optional,
    };

    if (this.returningCols) {
      return nextCalls;
    }
    optional.push("returning");

    if (this.whereClause) {
      return nextCalls;
    }
    optional.push("where");

    return nextCalls;
  }

  createStatement(): DeleteFromStatement {
    return {
      kind: "delete_from",
      table: this.table,
      where: this.whereClause,
      returning: this.returningCols,
    };
  }
}
