import type { DiscoveryResults } from "../mapping/discovery/DiscoveryResults.js";
import { JsonValuePath } from "../mapping/import/JsonValuePath.js";
import type { ColumnValue } from "../types/ColumnValue.js";
import { CaseBuilder } from "./expression/CaseBuilder.js";
import { CastBuilder } from "./expression/CastBuilder.js";
import { ColumnExpressionNode } from "./expression/ColumnExpressionNode.js";
import { ConcatExpressionNode } from "./expression/ConcatExpressionNode.js";
import type { ExpressionNode } from "./expression/ExpressionNode.js";
import { JsonQueryExpressionNode } from "./expression/JsonQueryExpressionNode.js";
import { JsonValueExpressionNode } from "./expression/JsonValueExpressionNode.js";
import { LiteralExpressionNode } from "./expression/LiteralExpressionNode.js";
import { AndPredicateNode } from "./predicate/AndPredicateNode.js";
import { NotPredicateNode } from "./predicate/NotPredicateNode.js";
import { OrPredicateNode } from "./predicate/OrPredicateNode.js";
import type { PredicateNode } from "./predicate/PredicateNode.js";
import { XorPredicateNode } from "./predicate/XorPredicateNode.js";
import { DiscoveryResultsNode } from "./tabular/DiscoveryResultsNode.js";
import { TableReferenceNode } from "./tabular/TableReferenceNode.js";

// Expressions

export function col(reference: string) {
  return new ColumnExpressionNode(reference);
}

export function case_() {
  return new CaseBuilder();
}

export function concat(expressions: (ExpressionNode | ColumnValue)[]) {
  return new ConcatExpressionNode(expressions);
}

export function val(value: ColumnValue) {
  return new LiteralExpressionNode(value);
}

export function cast(expression: ExpressionNode | ColumnValue) {
  return new CastBuilder(expression);
}

type DiscoveryColumnName =
  | "resultId"
  | "parentResultId"
  | "nodeType"
  | "identity"
  | "value"
  | "captures";

export function property(name: DiscoveryColumnName) {
  return col(name);
}

export function json_value(
  source: ExpressionNode,
  path: string,
) {
  return new JsonValueExpressionNode(source, JsonValuePath.parse(path));
}

export function json_query(
  source: ExpressionNode,
  path: string,
) {
  return new JsonQueryExpressionNode(source, JsonValuePath.parse(path));
}

// Tabular Expressions

export function table(reference: string) {
  return new TableReferenceNode(reference);
}

export function discovery(results?: DiscoveryResults) {
  return new DiscoveryResultsNode(results);
}

// Predicates

export function and(left: PredicateNode, right: PredicateNode) {
  return new AndPredicateNode([left, right]);
}

export function or(left: PredicateNode, right: PredicateNode) {
  return new OrPredicateNode([left, right]);
}

export function xor(left: PredicateNode, right: PredicateNode) {
  return new XorPredicateNode(left, right);
}

export function not(inner: PredicateNode) {
  return new NotPredicateNode(inner);
}
