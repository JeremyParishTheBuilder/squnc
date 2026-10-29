import { type QueryPlan } from "../../evaluation/plan/QueryPlan.js";
import {
  TableScanNode,
  queryColumnsFromTable,
} from "../../evaluation/plan/TableScanNode.js";
import { bindQuery } from "../query.js";
import type { SemanticAnalyzer } from "../SemanticAnalyzer.js";
import type { BoundRelation } from "./BoundRelation.js";
import {
  relationColumnsFromQueryPlan,
  relationColumnsFromTable,
  type RelationColumn,
} from "./RelationColumn.js";
import { normalizeIdentifier } from "../../utils/normalizeIdentifier.js";
import type {
  TabularExpressionNode,
  TabularExpressionProjection,
} from "../../ast/tabular/TabularExpressionNode.js";
import type { TableReferenceNode } from "../../ast/tabular/TableReferenceNode.js";
import { QueryReferenceNode } from "../../ast/tabular/QueryReferenceNode.js";
import type { JoinNode } from "../../ast/tabular/JoinNode.js";
import { bindPredicate, resolvePredicate } from "../predicate.js";
import { RelationScope } from "./RelationScope.js";
import type { PlanNode } from "../../evaluation/plan/PlanNode.js";
import type { Predicate } from "../../evaluation/predicate/Predicate.js";
import type { RowView } from "../../relational/RowView.js";
import { InnerJoinPlanNode } from "../../evaluation/plan/join/InnerJoinNode.js";

export function bindTabularExpression(
  semantic: SemanticAnalyzer,
  source: TabularExpressionProjection,
): BoundRelation {
  switch (source.source.kind) {
    case "table":
      return bindTableReference(semantic, source);

    case "query":
      return bindQueryReference(semantic, source);

    case "join":
      return bindJoin(semantic, source);

    default: {
      throw new Error(`Source unknown: ${source.source} `);
    }
  }
}

function bindTableReference(
  semantic: SemanticAnalyzer,
  source: TabularExpressionProjection,
): BoundRelation {
  const tableNode = source.source;
  assertTableReferenceNode(tableNode);

  const qualifiedName = tableNode.name;
  const separatorIndex = qualifiedName.indexOf(".");

  const table =
    separatorIndex === -1
      ? semantic.ctx.requireTable(qualifiedName)
      : semantic.ctx.requireTable(
          qualifiedName.slice(separatorIndex + 1),
          qualifiedName.slice(0, separatorIndex),
        );

  return {
    plan: {
      root: new TableScanNode(table),
      columns: queryColumnsFromTable(table),
    },
    relations: [
      {
        name: source.alias ?? qualifiedName,
        columns: relationColumnsFromTable(table),
      },
    ],
  };
}

function bindQueryReference(
  semantic: SemanticAnalyzer,
  source: TabularExpressionProjection,
): BoundRelation {
  const queryNode = source.source;
  assertQueryReferenceNode(queryNode);

  // const bindingKind = getBindingKind(source);;

  const plan = bindQuery(semantic, queryNode.query);

  const columns = relationColumnsFromQueryPlan(plan);

  if (semantic.ctx.rules.dql.denyDuplicateDerivedTableColumnNames) {
    assertNoDuplicateColumnNames(columns);
  }

  return {
    plan,
    relations: [
      {
        name: source.alias,
        columns: columns,
      },
    ],
  };
}

export function bindJoin(
  semantic: SemanticAnalyzer,
  source: TabularExpressionProjection,
): BoundRelation {
  const joinNode = source.source;
  assertJoinNode(joinNode);

  const left = bindTabularExpression(semantic, joinNode.left);
  const right = bindTabularExpression(semantic, joinNode.right);

  const scope = new RelationScope([...left.relations, ...right.relations]);

  const predicate = bindPredicate(resolvePredicate(joinNode.on, scope), scope);

  const plan: QueryPlan = {
    root: createJoinPlan(joinNode, left, right, predicate),
    columns: [...left.plan.columns, ...right.plan.columns],
  };

  const relations = source.alias
    ? [
        {
          name: source.alias,
          columns: relationColumnsFromQueryPlan(plan),
        },
      ]
    : [...left.relations, ...right.relations];

  return {
    plan,
    relations,
  };
}

function createJoinPlan(
  node: JoinNode,
  left: BoundRelation,
  right: BoundRelation,
  predicate: Predicate<RowView>,
): PlanNode {
  switch (node.type) {
    case "inner":
      return new InnerJoinPlanNode(left.plan.root, right.plan.root, predicate);

    // case "left":
    //   return new LeftJoinNode(
    //     left.plan.root,
    //     right.plan.root,
    //     predicate,
    //   );

    // case "right":
    //   return new RightJoinNode(
    //     left.plan.root,
    //     right.plan.root,
    //     predicate,
    //   );

    // case "full":
    //   return new FullJoinNode(
    //     left.plan.root,
    //     right.plan.root,
    //     predicate,
    //   );

    default:
      //return assertNever(kind);
      throw new Error(`Invalid Join type: ${node.type}.`);
  }
}

// TODO, switch to assert never after adding the remaining join types
// function assertNever(value: never): never {
//   throw new Error(`Unsupported join kind: ${value}`);
// }

function assertTableReferenceNode(
  source: TabularExpressionNode,
): asserts source is TableReferenceNode {
  if (source.kind !== "table") {
    throw new Error(`Expected table reference, got "${source.kind}".`);
  }
}

function assertQueryReferenceNode(
  source: TabularExpressionNode,
): asserts source is QueryReferenceNode {
  if (source.kind !== "query") {
    throw new Error(`Expected query reference, got "${source.kind}".`);
  }
}

function assertJoinNode(
  source: TabularExpressionNode,
): asserts source is JoinNode {
  if (source.kind !== "join") {
    throw new Error(`Expected join node, got "${source.kind}".`);
  }
}

function assertNoDuplicateColumnNames(columns: RelationColumn[]): void {
  const seen = new Set<string>();

  for (const col of columns) {
    const name = normalizeIdentifier(col.column.name);

    if (seen.has(name)) {
      throw new Error(`Duplicate column name '${col.column.name}'`);
    }

    seen.add(name);
  }
}
