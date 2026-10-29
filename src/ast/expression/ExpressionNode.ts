import {
  type BinaryExpressionNode,
  type ResolvedBinaryExpressionNode,
} from "./BinaryExpressionNode.js";
import {
  type ResolvedCaseExpressionNode,
  type CaseExpressionNode,
} from "./CaseExpressionNode.js";
import {
  type ResolvedColumnExpressionNode,
  type ColumnExpressionNode,
} from "./ColumnExpressionNode.js";
import { type LiteralExpressionNode } from "./LiteralExpressionNode.js";
import {
  type ConcatExpressionNode,
  type ResolvedConcatExpressionNode,
} from "./ConcatExpressionNode.js";
import type { TemporalExpressionNode } from "./TemporalExpressionNode.js";
import type { SqlFunctionExpressionNode } from "./SqlFunctionExpressionNode.js";
import type {
  CastExpressionNode,
  ResolvedCastExpressionNode,
} from "./CastExpressionNode.js";
import type { ColumnValue } from "../../types/ColumnValue.js";
import { ComparisonPredicateNode } from "../predicate/ComparisonPredicateNode.js";
import { IsNullPredicateNode } from "../predicate/IsNullPredicateNode.js";
import { IsNotNullPredicateNode } from "../predicate/IsNotNullPredicateNode.js";
import type {
  JsonValueExpressionNode,
  ResolvedJsonValueExpressionNode,
} from "./JsonValueExpressionNode.js";
import type {
  JsonQueryExpressionNode,
  ResolvedJsonQueryExpressionNode,
} from "./JsonQueryExpressionNode.js";

export type ResolvedExpressionNode =
  | ResolvedColumnExpressionNode
  | LiteralExpressionNode
  | ResolvedCaseExpressionNode
  | ResolvedCastExpressionNode
  | ResolvedBinaryExpressionNode
  | ResolvedConcatExpressionNode
  | TemporalExpressionNode
  | SqlFunctionExpressionNode
  | ResolvedJsonValueExpressionNode
  | ResolvedJsonQueryExpressionNode;

export type ExpressionNodeUnion =
  | ColumnExpressionNode
  | LiteralExpressionNode
  | CaseExpressionNode
  | CastExpressionNode
  | BinaryExpressionNode
  | ConcatExpressionNode
  | TemporalExpressionNode
  | SqlFunctionExpressionNode
  | JsonValueExpressionNode
  | JsonQueryExpressionNode;

export function isExpressionNodeUnion(
  expr: ExpressionNode,
): expr is ExpressionNodeUnion {
  switch (expr.kind) {
    case "literal":
    case "column":
    case "case":
    case "cast":
    case "binary":
    case "concat":
    case "temporal":
    case "sql_function":
    case "json_value":
    case "json_query":
      return true;

    default:
      return false;
  }
}

export type ExpressionKind =
  | "column"
  | "literal"
  | "case"
  | "cast"
  | "binary"
  | "concat"
  | "temporal"
  | "sql_function"
  | "json_value"
  | "json_query";

export interface ExpressionProjection {
  readonly expression: ExpressionNode;
  readonly alias?: string;
}

export abstract class ExpressionNode {
  abstract readonly kind: ExpressionKind;

  as(alias: string): ExpressionProjection {
    return {
      expression: this,
      alias,
    };
  }

  eq(this: ExpressionNode, expr: ExpressionNode | ColumnValue) {
    return new ComparisonPredicateNode(this, "eq", expr);
  }

  ne(this: ExpressionNode, expr: ExpressionNode | ColumnValue) {
    return new ComparisonPredicateNode(this, "ne", expr);
  }

  gt(this: ExpressionNode, expr: ExpressionNode | ColumnValue) {
    return new ComparisonPredicateNode(this, "gt", expr);
  }

  gte(this: ExpressionNode, expr: ExpressionNode | ColumnValue) {
    return new ComparisonPredicateNode(this, "gte", expr);
  }

  lt(this: ExpressionNode, expr: ExpressionNode | ColumnValue) {
    return new ComparisonPredicateNode(this, "lt", expr);
  }

  lte(this: ExpressionNode, expr: ExpressionNode | ColumnValue) {
    return new ComparisonPredicateNode(this, "lte", expr);
  }

  isNull(this: ExpressionNode) {
    return new IsNullPredicateNode(this);
  }

  isNotNull(this: ExpressionNode) {
    return new IsNotNullPredicateNode(this);
  }
}
