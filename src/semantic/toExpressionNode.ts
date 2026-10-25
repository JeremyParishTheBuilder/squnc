import {
  DEFAULT,
  SQL_FUNCTION_KEYWORDS,
  SQL_FUNCTION_KINDS,
  TEMPORAL_EXPRESSION_KEYWORDS,
  TEMPORAL_EXPRESSION_KINDS,
  type SqlFunctionKeyword,
  type TemporalExpressionKeyword,
} from "../dialect/keywords.js";
import type { ExecutionContext } from "../engine/ExecutionContext.js";
import type { ExpressionInput } from "../types/ExpressionInput.js";
import type { UpdateInput } from "../types/UpdateInput.js";
import { DefaultValueNode } from "../ast/DefaultValueNode.js";
import { asExpressionNode } from "../ast/expression/asExpressionNode.js";
import { SqlFunctionExpressionNode } from "../ast/expression/SqlFunctionExpressionNode.js";
import { TemporalExpressionNode } from "../ast/expression/TemporalExpressionNode.js";
import { isExpressionNodeUnion } from "../ast/expression/ExpressionNode.js";
import type { ExpressionNode } from "../ast/expression/ExpressionNode.js";
import type { InsertValuesInput } from "../types/InsertSource.js";

export function toExpressionNode(
  value: UpdateInput | InsertValuesInput,
): ExpressionNode | DefaultValueNode {
  if (value === DEFAULT) {
    return new DefaultValueNode();
  }

  if (isTemporalExpressionKeyword(value)) {
    const kind = TEMPORAL_EXPRESSION_KINDS.get(value);

    if (kind === undefined) {
      throw new Error("Unsupported temporal expression keyword.");
    }

    return new TemporalExpressionNode(kind);
  }

  if (isSqlFunctionKeyword(value)) {
    const kind = SQL_FUNCTION_KINDS.get(value);

    if (kind === undefined) {
      throw new Error("Unsupported SQL function keyword.");
    }

    return new SqlFunctionExpressionNode(kind);
  }

  if (!isExpressionInput(value)) {
    throw new Error("Unsupported input value.");
  }

  return asExpressionNode(value);
}

function isExpressionInput(value: UpdateInput): value is ExpressionInput {
  return typeof value !== "symbol";
}

export function isTemporalExpressionKeyword(
  value: UpdateInput,
): value is TemporalExpressionKeyword {
  return TEMPORAL_EXPRESSION_KINDS.has(value as TemporalExpressionKeyword);
}

export function isSqlFunctionKeyword(
  value: UpdateInput,
): value is SqlFunctionKeyword {
  return SQL_FUNCTION_KINDS.has(value as SqlFunctionKeyword);
}

export function validateInputNode(
  value: ExpressionNode | DefaultValueNode,
  ctx: ExecutionContext,
): void {
  if (value.kind === "default") {
    if (!ctx.rules.input.keywords.has(DEFAULT)) {
      throw new Error("Keyword DEFAULT not allowed in dialect.");
    }

    return;
  }

  if (!isExpressionNodeUnion(value)) {
    throw new Error(`Unsupported expression node: ${value.kind}`);
  }

  if (value.kind === "temporal") {
    const keyword = TEMPORAL_EXPRESSION_KEYWORDS.get(value.expression);

    if (
      keyword === undefined ||
      !ctx.rules.input.temporalExpressions.has(keyword)
    ) {
      throw new Error(
        `Temporal expression '${value.expression}' is not allowed in this dialect.`,
      );
    }

    return;
  }

  if (value.kind === "sql_function") {
    const keyword = SQL_FUNCTION_KEYWORDS.get(value.function_);

    if (keyword === undefined || !ctx.rules.input.sqlFunctions.has(keyword)) {
      throw new Error(
        `SQL function '${value.function_}' is not allowed in this dialect.`,
      );
    }
  }
}
