import { QueryReferenceNode } from "../../ast/tabular/QueryReferenceNode.js";
import { TableReferenceNode } from "../../ast/tabular/TableReferenceNode.js";
import {
  TabularExpressionNode,
  type TabularExpressionProjection,
} from "../../ast/tabular/TabularExpressionNode.js";
import type { Statement, StatementBuilder } from "../Statement.js";
import { InnerJoinBuilder } from "./join/InnerJoinStatement.js";
import type { QueryStatement } from "./QueryStatement.js";

export type TabularExpressionInput =
  string | QueryStatement | TabularExpressionNode | TabularExpressionProjection;

export abstract class TabularExpressionReferencer implements StatementBuilder {
  protected source?: TabularExpressionProjection;

  from(source: TabularExpressionInput) {
    if (this.source) {
      throw new Error("Source already provided");
    }

    this.source = asTabularExpressionProjection(source);
  }

  innerJoin(right: TabularExpressionInput): InnerJoinBuilder {
    if (!this.source) {
      throw new Error(`No Left Relation Source`);
    }

    return new InnerJoinBuilder(
      this.source,
      asTabularExpressionProjection(right),
      this,
    );
  }

  withSource(source: TabularExpressionNode): this {
    this.source = {
      kind: "tabularProjection",
      source,
    };

    return this;
  }

  as(alias: string) {
    if (!this.source) {
      throw new Error(`No Source`);
    }

    this.assertSourceNotProjected();

    this.source = {
      kind: "tabularProjection",
      source: this.source.source,
      alias,
    };
  }
  assertSourceNotProjected(): void {
    if (!this.source) {
      throw new Error(`No source`);
    }

    if (this.source.alias) {
      throw new Error(`Source already projected.`);
    }
  }

  getNextCalls(): {
    required: string[];
    optional: string[];
  } {
    const required: string[] = [];
    let optional: string[] = [];

    if (this.source && !this.source.alias) {
      optional.push("as");
    }

    optional = optional.concat([
      "innerJoin",
      "leftJoin",
      "rightJoin",
      "fullJoin",
    ]);

    return {
      required,
      optional,
    };
  }

  abstract createStatement(): Statement;
}

function isTabularExpressionProjection(
  value: unknown,
): value is TabularExpressionProjection {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "tabularProjection"
  );
}

export function asTabularExpressionProjection(
  source:
    | string
    | QueryStatement
    | TabularExpressionNode
    | TabularExpressionProjection,
): TabularExpressionProjection {
  if (isTabularExpressionProjection(source)) {
    return source;
  }

  if (typeof source === "string") {
    return {
      kind: "tabularProjection",
      source: new TableReferenceNode(source),
    };
  }

  if (source instanceof TabularExpressionNode) {
    return {
      kind: "tabularProjection",
      source,
    };
  }

  return {
    kind: "tabularProjection",
    source: new QueryReferenceNode(source),
  };
}
