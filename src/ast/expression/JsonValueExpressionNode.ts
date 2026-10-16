import type { JsonValuePath } from "../../mapping/import/JsonValuePath.js";
import { ExpressionNode, type ResolvedExpressionNode, } from "./ExpressionNode.js";

export class ResolvedJsonValueExpressionNode {
  readonly kind = "json_value" as const;

  constructor(
    public readonly source: ResolvedExpressionNode,
    public readonly path: JsonValuePath,
  ) {}
}

export class JsonValueExpressionNode extends ExpressionNode {
  readonly kind = "json_value" as const;

  constructor(
    public readonly source: ExpressionNode,
    public readonly path: JsonValuePath,
  ) {
    super();
  }
}