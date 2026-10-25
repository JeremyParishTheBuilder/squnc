import { type ColumnValue } from "../../../types/ColumnValue.js";
import { LiteralExpression } from "../../../evaluation/expression/LiteralExpression.js";
import { ConcatExpression } from "../../../evaluation/expression/ConcatExpression.js";
import { BasenameExpression } from "../../../evaluation/expression/fs/BasenameExpression.js";
import {
  type CaseBranch,
  CaseExpression,
} from "../../../evaluation/expression/CaseExpression.js";
import { type Expression } from "../../../evaluation/expression/Expression.js";
import { ScalarExpressionBuilder } from "./ScalarExpressionBuilder.js";
import {
  CaptureExpression,
  CaptureScalarExpression,
} from "../../../evaluation/expression/discovery/CaptureExpression.js";
import {
  isStructuredElement,
  isStructuredProperty,
  type StructuredValue,
} from "../../value/StructuredValue.js";
import { PayloadExpression } from "../../../evaluation/expression/discovery/PayloadExpression.js";
import { PropertyNameExpression } from "../../../evaluation/expression/structuredValues/PropertyNameExpression.js";
import { DiscoveryContextExpression } from "../../../evaluation/expression/discovery/DiscoveryContextExpression.js";
import { ElementIndexExpression } from "../../../evaluation/expression/structuredValues/ElementIndexExpression.js";
import { requireFsObject } from "../../discovery/nodejs/FsObject.js";
import { JsonValueExpression } from "../../../evaluation/expression/structuredValues/JsonValueExpression.js";
import { JsonValuePath } from "../../value/JsonValuePath.js";
import { JsonQueryExpression } from "../../../evaluation/expression/structuredValues/JsonQueryExpression.js";
import { ExpressionBuilder } from "./ExpressionBuilder.js";

export function case_<TContext>(
  branches: CaseBranch<TContext>[],
  elseExpr: Expression<TContext>,
) {
  return new ScalarExpressionBuilder(new CaseExpression(branches, elseExpr));
}

export function literal(value: ColumnValue) {
  return new ScalarExpressionBuilder(new LiteralExpression(value));
}

export function basename() {
  return new ScalarExpressionBuilder(
    new DiscoveryContextExpression(new BasenameExpression(), (context) =>
      requireFsObject(context.current),
    ),
  );
}

export function propertyName() {
  return new ScalarExpressionBuilder(
    new DiscoveryContextExpression(new PropertyNameExpression(), (context) => {
      if (!isStructuredProperty(context.current)) {
        throw new Error("Expected a structured property.");
      }
      return context.current;
    }),
  );
}

export function elementIndex() {
  return new ScalarExpressionBuilder(
    new DiscoveryContextExpression(new ElementIndexExpression(), (context) => {
      if (!isStructuredElement(context.current)) {
        throw new Error("Expected a structured property.");
      }
      return context.current;
    }),
  );
}

export function concat<TContext>(
  ...parts: ScalarExpressionBuilder<TContext>[]
) {
  return new ScalarExpressionBuilder(
    new ConcatExpression(parts.map((p) => p.expression)),
  );
}

export function capture(name: string) {
  return new ExpressionBuilder(new CaptureExpression(name));
}

export function captureScalar(name: string) {
  return new ScalarExpressionBuilder(
    new CaptureScalarExpression(new CaptureExpression(name)),
  );
}

export function payload() {
  return new ExpressionBuilder(new PayloadExpression());
}

export function json_value<TContext>(
  source: ExpressionBuilder<TContext, StructuredValue>,
  path: string,
): ScalarExpressionBuilder<TContext> {
  return new ScalarExpressionBuilder(
    new JsonValueExpression<TContext>(source, JsonValuePath.parse(path)),
  );
}

export function json_query<TContext>(
  source: ExpressionBuilder<TContext, StructuredValue>,
  path: string,
): ExpressionBuilder<TContext, StructuredValue> {
  return new ExpressionBuilder(
    new JsonQueryExpression<TContext>(source, JsonValuePath.parse(path)),
  );
}
