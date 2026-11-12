import { type PredicateNode } from "../../ast/predicate/PredicateNode.js";
import { type BaseStatement } from "../Statement.js";
import { QueryStatementBuilder } from "./QueryStatementBuilder.js";
import type { QueryProjection } from "../../ast/query/QueryProjection.js";
import type { TabularExpressionProjection } from "../../ast/tabular/TabularExpressionNode.js";

export interface SelectStatement extends BaseStatement {
  kind: "select";
  source: TabularExpressionProjection;
  projection: QueryProjection;
  where?: PredicateNode;
}

export class SelectBuilder extends QueryStatementBuilder {
  protected whereClause?: PredicateNode;

  constructor(protected projection: QueryProjection) {
    super();
  }

  where(predicate: PredicateNode): this {
    this.whereClause = predicate;

    return this;
  }

  getNextCalls() {
    if (!this.source) {
      return {
        required: ["from"],
        optional: [],
      };
    }

    const { required, optional } = super.getNextCalls();

    if (!this.whereClause) {
      optional.push("where");
    }

    return {
      required,
      optional,
    };
  }

  createStatement(): SelectStatement {
    if (!this.source) {
      throw new Error("Missing required call: from()");
    }

    return {
      kind: "select",
      source: this.source,
      projection: this.projection,
      where: this.whereClause,
    };
  }
}
