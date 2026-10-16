import {
  type QueryPlan,
} from "../../evaluation/plan/QueryPlan.js";
import { TableScanNode, queryColumnsFromTable } from "../../evaluation/plan/TableScanNode.js";
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
import type { DiscoveryResultsNode } from "../../ast/tabular/DiscoveryResultsNode.js";
import { discoveryColumns, DiscoveryScanNode } from "../../evaluation/plan/DiscoveryScanNode.js";

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

    case "discovery":
      return bindDiscoveryResults(semantic, source);

    default: {
      throw new Error(`Source unknown: ${source.source} `);
    }
  }
}

function bindDiscoveryResults(
  _semantic: SemanticAnalyzer,
  source: TabularExpressionProjection,
): BoundRelation {
  const discoveryNode = source.source;
  assertDiscoveryResultsNode(discoveryNode);

  const discoveryResults = discoveryNode.discoveryResults;

  const columns = discoveryColumns();

  return {
    plan: {
      root: new DiscoveryScanNode(discoveryResults),
      columns: columns,
    },
    relations: [
      {
        name: source.alias ?? "discovery",
        columns: columns.map((column) => ({ column })),
      },
    ],
  };
}

function bindTableReference(
  semantic: SemanticAnalyzer,
  source: TabularExpressionProjection,
): BoundRelation {
  const tableNode = source.source;
  assertTableReferenceNode(tableNode);

  const table = semantic.ctx.requireTable(tableNode.name);

  return {
    //bindingKind: "relational",
    plan: {
      root: new TableScanNode(table),
      columns: queryColumnsFromTable(table),
    },
    relations: [
      {
        name: source.alias ?? tableNode.name,
        columns: relationColumnsFromTable(table),
      },
    ],
  };
}

// function getBindingKind(
//   source: TabularExpressionProjection
// ): "relational" | "structured" {
//   if (source.source.kind === "table") {
//     return "relational";
//   }

//   if (source.source.kind === "query") {
//     asserts source.source is QueryReferenceNode
//     return getBindingKind(source.source.query.source); // only works if query is Select, not UnionAll
//   }

//   // join case still not covered

//   return "structured";
// }

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
    //kind: "relational",
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

  // if (
  //   left.bindingKind !== "relational" ||
  //   right.bindingKind !== "relational"
  // ) {
  //   throw new Error(
  //     "Joins currently require relational sources",
  //   );
  // }

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

function assertDiscoveryResultsNode(
  source: TabularExpressionNode,
): asserts source is DiscoveryResultsNode {
  if (source.kind !== "discovery") {
    throw new Error(`Expected discovery reference, got "${source.kind}".`);
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
