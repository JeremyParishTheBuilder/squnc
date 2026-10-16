import type { JsonValuePath } from "../../mapping/import/JsonValuePath.js";
import {
  ExpressionNode,
  type ResolvedExpressionNode,
} from "./ExpressionNode.js";

export class ResolvedJsonQueryExpressionNode {
  readonly kind = "json_query" as const;

  constructor(
    public readonly source: ResolvedExpressionNode,
    public readonly path: JsonValuePath,
  ) {}
}

export class JsonQueryExpressionNode extends ExpressionNode {
  readonly kind = "json_query" as const;

  constructor(
    public readonly source: ExpressionNode,
    public readonly path: JsonValuePath,
  ) {
    super();
  }
}
