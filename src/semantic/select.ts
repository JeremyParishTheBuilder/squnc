import { type PlanNode } from "../evaluation/plan/PlanNode.js";
import { FilterNode } from "../evaluation/plan/FilterNode.js";

import { type SelectStatement } from "../statements/index.js";
import { type SemanticAnalyzer } from "./SemanticAnalyzer.js";
import { bindPredicate, resolvePredicate } from "./predicate.js";
import {
  type QueryColumn,
  type QueryPlan,
} from "../evaluation/plan/QueryPlan.js";
import {
  ExpressionNode,
  type ExpressionProjection,
  type ResolvedExpressionNode,
} from "../ast/expression/ExpressionNode.js";
import {
  bindExpression,
  getExpressionNullability,
  getNameFromExpression,
  resolveExpression,
  sqlTypeFromExpression,
} from "./expression.js";
import { EvaluateNode } from "../evaluation/plan/EvaluateNode.js";
import type { ColumnValue } from "../types/ColumnValue.js";
import { asExpressionNode } from "../ast/expression/asExpressionNode.js";
import { IdAllocator } from "../types/IdAllocator.js";
import { normalizeIdentifier } from "../utils/normalizeIdentifier.js";
import { RelationScope } from "./relation/RelationScope.js";
import type { BoundRelation } from "./relation/BoundRelation.js";
import { bindTabularExpression } from "./relation/bindTabularExpression.js";
import type { RowView } from "../relational/RowView.js";
import type { Expression } from "../evaluation/expression/Expression.js";
import {
  ColumnExpressionNode,
  ResolvedColumnExpressionNode,
} from "../ast/expression/ColumnExpressionNode.js";
import { ColumnExpression } from "../evaluation/expression/ColumnExpression.js";

export function bindSelect(
  semantic: SemanticAnalyzer,
  stmt: SelectStatement,
): QueryPlan {
  const source = bindTabularExpression(semantic, stmt.source);

  let node: PlanNode = source.plan.root;

  const scope = new RelationScope([...source.relations]);
  //const scope: ExpressionResolver = createScope(source); // creates either RelationScope or StructuredValueScope

  const whereClause = stmt.where;
  if (whereClause) {
    //node = bindFilter(whereClause, scope); // can dispatch based on scope 'kind'

    const predicate = bindPredicate(
      resolvePredicate(whereClause, scope),
      scope,
    );

    node = new FilterNode(predicate, node);
  }

  //bindProjection(stmt.projection, scope); // can dispatch based on scope 'kind'
  const boundProjection =
    stmt.projection === "*"
      ? bindStarProjection(source)
      : bindExplicitProjection(stmt.projection, scope);

  node = new EvaluateNode(
    boundProjection.map((x) => x.bound),
    node,
  );

  const defaultColumnName: string = semantic.ctx.rules.default.resultColumnName;
  const defaultColumnNamingToolkit: ColumnNamingToolkit = {
    columnName: defaultColumnName,
    normalizedName: normalizeIdentifier(defaultColumnName),
    counter: new IdAllocator<number>(),
  };

  const columns: QueryColumn[] = boundProjection.map((x) => ({
    name: allocateColumnName(
      getColumnName(x.node, x.resolved),
      defaultColumnNamingToolkit,
    ),
    type: sqlTypeFromExpression(x.resolved),
    nullable: getExpressionNullability(x.resolved),
  }));

  return {
    root: node,
    columns,
  };
}

type ColumnNamingToolkit = {
  columnName: string;
  normalizedName: string;
  counter: IdAllocator<number>;
};

function allocateDefaultColumnName(
  toolkit: ColumnNamingToolkit,
): ColumnNamingToolkit {
  const [id, counter] = toolkit.counter.allocate();

  return {
    columnName: `${toolkit.columnName}${id}`,
    normalizedName: `${toolkit.normalizedName}${id}`,
    counter,
  };
}

function allocateColumnName(
  name: string | undefined,
  toolkit: ColumnNamingToolkit,
): string {
  let resultColumnName: string;
  let normalizedName: string;

  if (!name) {
    const defaultColumn = allocateDefaultColumnName(toolkit);
    resultColumnName = defaultColumn.columnName;
    toolkit.counter = defaultColumn.counter;
  } else {
    resultColumnName = name;
    normalizedName = normalizeIdentifier(name);

    if (normalizedName.startsWith(toolkit.normalizedName)) {
      throw new Error(
        `Column name "${resultColumnName}" uses the reserved default column name prefix`,
      );
    }
  }

  return resultColumnName;
}

function isExpressionProjection(value: unknown): value is ExpressionProjection {
  return typeof value === "object" && value !== null && "expression" in value;
}

function normalizeSelectInputs(
  inputs: (ExpressionNode | ExpressionProjection | ColumnValue)[],
): ExpressionProjection[] {
  return inputs.map((item) => {
    if (isExpressionProjection(item)) {
      return item;
    }

    return {
      expression: asExpressionNode(item),
    };
  });
}

function getColumnName(
  item: ExpressionProjection,
  resolvedExpression: ResolvedExpressionNode,
): string | undefined {
  const alias = item.alias;

  if (alias) {
    return alias;
  }

  return getNameFromExpression(resolvedExpression);
}

function bindStarProjection(source: BoundRelation): {
  node: ExpressionProjection;
  resolved: ResolvedExpressionNode;
  bound: Expression<RowView>;
}[] {
  return source.plan.columns.map((column, position) => {
    const node: ExpressionProjection = {
      expression: new ColumnExpressionNode(column.name),
    };

    const resolved = new ResolvedColumnExpressionNode({
      column: {
        column,
      },
    });

    const bound = new ColumnExpression(position);

    return {
      node,
      resolved,
      bound,
    };
  });
}

function bindExplicitProjection(
  projection: (ExpressionNode | ExpressionProjection | ColumnValue)[],
  scope: RelationScope,
  //scope: ExpressionResolver,
): {
  node: ExpressionProjection;
  resolved: ResolvedExpressionNode;
  bound: Expression<RowView>;
}[] {
  const normalizedProjection: ExpressionProjection[] =
    normalizeSelectInputs(projection);

  const boundProjection = normalizedProjection.map((node) => {
    const resolved = resolveExpression(node.expression, scope);
    const bound = bindExpression(resolved, scope);

    return {
      node,
      resolved,
      bound,
    };
  });

  return boundProjection;
}
