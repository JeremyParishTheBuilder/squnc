import { BinaryExpression } from "../evaluation/expression/BinaryExpression.js";
import { ResolvedCaseExpressionNode } from "../ast/expression/CaseExpressionNode.js";
import { ColumnExpression } from "../evaluation/expression/ColumnExpression.js";
import { LiteralExpression } from "../evaluation/expression/LiteralExpression.js";
import { type RowView } from "../relational/RowView.js";
import {
  assertInsertPredicate,
  bindInsertPredicate,
  bindPredicate,
  resolvePredicate,
} from "./predicate.js";
import { CaseExpression } from "../evaluation/expression/CaseExpression.js";
import { ResolvedColumnExpressionNode } from "../ast/expression/ColumnExpressionNode.js";
import { ResolvedBinaryExpressionNode } from "../ast/expression/BinaryExpressionNode.js";
import type {
  ExpressionNode,
  ResolvedExpressionNode,
} from "../ast/expression/ExpressionNode.js";
import type { Expression } from "../evaluation/expression/Expression.js";
import { TemporalExpression } from "../evaluation/expression/TemporalExpression.js";
import { ResolvedConcatExpressionNode } from "../ast/expression/ConcatExpressionNode.js";
import { ConcatExpression } from "../evaluation/expression/ConcatExpression.js";
import { SqlFunctionExpression } from "../evaluation/expression/SqlFunctionExpression.js";
import { isColumnValue, type ColumnValue } from "../types/ColumnValue.js";
import {
  decimal,
  isCastable,
  isSameType,
  SQL_DATE,
  SQL_INTEGER,
  SQL_JSON,
  SQL_TIMESTAMP,
  SQL_VARCHAR,
  sqlTypeFromValue,
  type DecimalType,
  type SqlType,
} from "../types/SqlType.js";
import { ResolvedCastExpressionNode } from "../ast/expression/CastExpressionNode.js";
import { CastExpression } from "../evaluation/expression/CastExpression.js";
import { LiteralExpressionNode } from "../ast/expression/LiteralExpressionNode.js";
import { isExpressionNodeUnion } from "../ast/expression/ExpressionNode.js";
import type { TemporalExpressionNode } from "../ast/expression/TemporalExpressionNode.js";
import type { SqlFunctionExpressionNode } from "../ast/expression/SqlFunctionExpressionNode.js";
import type { ColumnResolver } from "./relation/ColumnResolver.js";
import type { ColumnBinder } from "./relation/ColumnBinder.js";
import { JsonValueExpression } from "../evaluation/expression/JsonValueExpression.js";
import { JsonQueryExpression } from "../evaluation/expression/JsonQueryExpression.js";
import { ResolvedJsonValueExpressionNode } from "../ast/expression/JsonValueExpressionNode.js";
import { ResolvedJsonQueryExpressionNode } from "../ast/expression/JsonQueryExpressionNode.js";

export function bindExpression(
  expr: ResolvedExpressionNode,
  binder: ColumnBinder,
): Expression<RowView, ColumnValue> { 
  switch (expr.kind) {
    case "literal":
      return new LiteralExpression(expr.value);

    case "column":
      return new ColumnExpression(binder.requireColumnPosition(expr.column));

    case "json_value":
      return new JsonValueExpression(
        bindExpression(expr.source, binder),
        expr.path,
      );

    case "json_query":
      return new JsonQueryExpression(
        bindExpression(expr.source, binder),
        expr.path,
      );

    case "temporal":
      return new TemporalExpression(expr.expression);

    case "sql_function":
      return new SqlFunctionExpression(expr.function_);

    case "case":
      return new CaseExpression(
        expr.branches.map((branch) => ({
          when: bindPredicate(branch.when, binder),
          then: bindExpression(branch.then, binder),
        })),
        expr.elseExpr ? bindExpression(expr.elseExpr, binder) : undefined,
      );

    case "cast": {
      return new CastExpression(bindExpression(expr.expr, binder), expr.type);
    }

    case "binary": {
      return new BinaryExpression(
        bindExpression(expr.left, binder),
        expr.operator,
        bindExpression(expr.right, binder),
      );
    }

    case "concat": {
      return new ConcatExpression(
        expr.expressions.map((expression) =>
          bindExpression(expression, binder),
        ),
      );
    }

    default: {
      throw new Error(`Unsupported expression kind: ${expr}`);
    }
  }
}

export function resolveExpression(
  expr: ExpressionNode | ColumnValue,
  scope: ColumnResolver,
): ResolvedExpressionNode {
  if (isColumnValue(expr)) {
    return new LiteralExpressionNode(expr);
  }

  if (!isExpressionNodeUnion(expr)) {
    throw new Error(`Unsupported expression node: ${expr.kind}`);
  }

  switch (expr.kind) {
    case "literal":
      return expr;

    case "column":
      return new ResolvedColumnExpressionNode(
        scope.resolveColumn(expr.columnName),
      );

    case "json_value": {
      const source = resolveExpression(expr.source, scope);
      assertJsonSource(source);

      return new ResolvedJsonValueExpressionNode(
        source,
        expr.path,
      );
    }

    case "json_query": {
      const source = resolveExpression(expr.source, scope);
      assertJsonSource(source);

      return new ResolvedJsonQueryExpressionNode(
        source,
        expr.path,
      );
    }

    case "temporal":
      return expr;

    case "sql_function":
      return expr;

    case "case":
      return new ResolvedCaseExpressionNode(
        expr.branches.map((branch) => ({
          when: resolvePredicate(branch.when, scope),
          then: resolveExpression(branch.then, scope),
        })),
        expr.elseExpr ? resolveExpression(expr.elseExpr, scope) : undefined,
      );

    case "cast": {
      const resolvedInnerExpression = resolveExpression(expr.expr, scope);

      const sourceType = getKnownSqlType(resolvedInnerExpression);

      if (sourceType !== undefined && !isCastable(sourceType, expr.type)) {
        throw new Error(`Cannot CAST from ${sourceType} to ${expr.type}`);
      }

      return new ResolvedCastExpressionNode(resolvedInnerExpression, expr.type);
    }

    case "binary": {
      return new ResolvedBinaryExpressionNode(
        resolveExpression(expr.left, scope),
        expr.operator,
        resolveExpression(expr.right, scope),
      );
    }

    case "concat":
      return new ResolvedConcatExpressionNode(
        expr.expressions.map((expression) =>
          resolveExpression(expression, scope),
        ),
      );

    default: {
      throw new Error(`Unsupported expression kind: ${expr}`);
    }
  }
}

function assertJsonSource(source: ResolvedExpressionNode) {
  const sourceSqlType = sqlTypeFromExpression(source);

  if (sourceSqlType !== SQL_JSON) {
    throw new Error("Source of JSON expression must have SQL_JSON type");
  }
}

export function assertInsertExpression(
  expr: ExpressionNode | ColumnValue,
): void {
  if (isColumnValue(expr)) {
    return;
  }

  if (!isExpressionNodeUnion(expr)) {
    throw new Error(`Unsupported expression node: ${expr.kind}`);
  }

  switch (expr.kind) {
    case "literal":
    case "temporal":
    case "sql_function":
      return;

    case "column":
      throw new Error(`INSERT VALUES expressions cannot reference columns.`);

    case "binary":
      assertInsertExpression(expr.left);
      assertInsertExpression(expr.right);
      return;

    case "concat":
      for (const expression of expr.expressions) {
        assertInsertExpression(expression);
      }
      return;

    case "cast":
      assertInsertExpression(expr.expr);
      return;

    case "case":
      for (const branch of expr.branches) {
        assertInsertPredicate(branch.when);
        assertInsertExpression(branch.then);
      }

      if (expr.elseExpr) {
        assertInsertExpression(expr.elseExpr);
      }

      return;

    default:
      throw new Error();
  }
}

export function bindInsertExpression(
  expr: ExpressionNode | ColumnValue,
): Expression<undefined, ColumnValue> {
  if (isColumnValue(expr)) {
    return new LiteralExpression(expr);
  }

  if (!isExpressionNodeUnion(expr)) {
    throw new Error(`Unsupported expression node: ${expr.kind}`);
  }

  switch (expr.kind) {
    case "literal":
      return new LiteralExpression(expr.value);

    case "temporal":
      return new TemporalExpression(expr.expression);

    case "sql_function":
      return new SqlFunctionExpression(expr.function_);

    case "binary":
      return new BinaryExpression(
        bindInsertExpression(expr.left),
        expr.operator,
        bindInsertExpression(expr.right),
      );

    case "concat":
      return new ConcatExpression(
        expr.expressions.map((e) => bindInsertExpression(e)),
      );

    case "cast":
      return new CastExpression(bindInsertExpression(expr.expr), expr.type);

    case "case":
      return new CaseExpression(
        expr.branches.map((branch) => ({
          when: bindInsertPredicate(branch.when),
          then: bindInsertExpression(branch.then),
        })),
        expr.elseExpr ? bindInsertExpression(expr.elseExpr) : undefined,
      );

    case "column":
      throw new Error("INSERT VALUES expressions cannot reference columns.");

    default:
      throw new Error(`Invalid Expression Node`);
  }
}

export function getNameFromExpression(
  expr: ResolvedExpressionNode,
): string | undefined {
  switch (expr.kind) {
    case "column":
      return expr.column.column.column.name;

    default:
      return undefined;
  }
}

function mergeDecimalTypes(types: readonly DecimalType[]): DecimalType {
  const precision = types.every((type) => type.precision === types[0].precision)
    ? types[0].precision
    : undefined;

  const scale = types.every((type) => type.scale === types[0].scale)
    ? types[0].scale
    : undefined;

  return decimal(precision, scale);
}

export function commonSqlType(types: readonly SqlType[]): SqlType {
  if (types.length === 0) {
    throw new Error("Cannot determine common SQL type from no types.");
  }

  const first = types[0];

  if (types.every((type) => isSameType(type, first))) {
    return first;
  }

  // Prefer DECIMAL for INTEGER + DECIMAL.
  if (
    types.every((type) => type.kind === "integer" || type.kind === "decimal")
  ) {
    const decimals = types.filter(
      (type): type is DecimalType => type.kind === "decimal",
    );

    if (decimals.length > 0) {
      return mergeDecimalTypes(decimals);
    }

    return SQL_INTEGER;
  }

  // VARCHAR can represent all currently supported scalar
  // values that are explicitly castable to VARCHAR.
  if (types.every((type) => isCastable(type, SQL_VARCHAR))) {
    return SQL_VARCHAR;
  }

  throw new Error(
    `No common SQL type exists for: ${types
      .map((type) => type.kind)
      .join(", ")}`,
  );
}

function sqlTypeFromTemporalExpression(expr: TemporalExpressionNode): SqlType {
  switch (expr.expression) {
    case "current_timestamp":
      return SQL_TIMESTAMP;

    case "current_date":
      return SQL_DATE;

    case "current_time":
      return SQL_VARCHAR;
  }
}

function sqlTypeFromSqlFunction(expr: SqlFunctionExpressionNode): SqlType {
  switch (expr.function_) {
    case "now":
    case "getdate":
      return SQL_TIMESTAMP;

    default:
      throw new Error(`Cannot get type from Sql Function Kind: ${expr}`);
  }
}

function getKnownSqlType(expr: ResolvedExpressionNode): SqlType | undefined {
  if (expr.kind !== "column") {
    return undefined;
  }

  return expr.column.column.column.type;
}

export function sqlTypeFromExpression(expr: ResolvedExpressionNode): SqlType {
  switch (expr.kind) {
    case "literal":
      return sqlTypeFromValue(expr.value);

    case "column":
      return expr.column.column.column.type;

    case "cast":
      return expr.type;

    case "case": {
      const types = expr.branches.map((branch) =>
        sqlTypeFromExpression(branch.then),
      );

      if (expr.elseExpr) {
        types.push(sqlTypeFromExpression(expr.elseExpr));
      }

      if (types.length === 0) {
        throw new Error("Cannot derive SQL type from empty CASE expression.");
      }

      return commonSqlType(types);
    }

    case "concat":
      return SQL_VARCHAR;

    case "binary":
      return commonSqlType([
        sqlTypeFromExpression(expr.left),
        sqlTypeFromExpression(expr.right),
      ]);

    case "temporal":
      return sqlTypeFromTemporalExpression(expr);

    case "sql_function":
      return sqlTypeFromSqlFunction(expr);

    case "json_query":
      return SQL_JSON;

    case "json_value":
      return SQL_VARCHAR;

    default:
      throw new Error(`Unsupported expression: ${expr}`);
  }
}

export function getExpressionNullability(
  expr: ResolvedExpressionNode,
): boolean {
  switch (expr.kind) {
    case "literal":
      return expr.value === null;

    case "column":
      return expr.column.column.column.nullable;

    case "cast":
      return getExpressionNullability(expr.expr);

    case "case": {
      if (!expr.elseExpr) {
        return true;
      }

      if (getExpressionNullability(expr.elseExpr)) {
        return true;
      }

      return expr.branches.some((branch) =>
        getExpressionNullability(branch.then),
      );
    }

    case "binary":
      return (
        getExpressionNullability(expr.left) ||
        getExpressionNullability(expr.right)
      );

    case "concat":
      return expr.expressions.some((expression) =>
        getExpressionNullability(expression),
      );

    case "temporal":
      return false;

    case "sql_function":
      return false;

    case "json_value":
      return true;

    case "json_query":
      return true;
  }
}
