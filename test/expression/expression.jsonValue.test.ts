import { describe, it, expect } from 'vitest';
import { JsonValueExpression } from '../../src/evaluation/expression/JsonValueExpression.ts';
import { JsonValuePath } from '../../src/mapping/import/JsonValuePath.ts';
import { SourceExpression } from '../../src/evaluation/expression/SourceExpression.ts';
import File from '../../src/mapping/discovery/nodejs/File.ts';
import { createImportContext } from '../utils/importHelpers.ts';
import { isStructuredValue } from '../../src/mapping/value/StructuredValue.ts';
import { SourceExpressionNode } from '../../src/ast/expression/SourceExpressionNode.ts';

describe("Expression::JsonValue", () => {
  it("extracts a top-level scalar", () => {
    const expression = new JsonValueExpression(
      new SourceExpression,
      JsonValuePath.parse("$.chain_name"),
    );

    expect(
      expression.evaluate(createImportContext({
        chain_name: "osmosis",
      })),
    ).toBe("osmosis");
  });

  it("extracts a nested scalar", () => {
    const expression = new JsonValueExpression(
      new SourceExpression,
      JsonValuePath.parse("$.codebase.version"),
    );

    expect(expression.evaluate(createImportContext({
        codebase: {
          version: 12,
        },
      })),
    ).toBe(12);
  });

  it("returns null for an explicitly null value", () => {
    const expression = new JsonValueExpression(
      new SourceExpression(),
      JsonValuePath.parse("$.value"),
    );

    expect(
      expression.evaluate(createImportContext({
        value: null,
      })),
    ).toBeNull();
  });

  it("rejects an object result", () => {
    const expression = new JsonValueExpression(
      new SourceExpression(),
      JsonValuePath.parse("$.codebase"),
    );

    expect(() =>
      expression.evaluate(createImportContext({
        codebase: {
          version: 12,
        },
      })),
    ).toThrow();
  });

  it("rejects an array result", () => {
    const expression = new JsonValueExpression(
      new SourceExpression(),
      JsonValuePath.parse("$.versions"),
    );

    expect(() =>
      expression.evaluate(createImportContext({
        versions: [1, 2, 3],
      })),
    ).toThrow();
  });

  it("rejects a missing path", () => {
    const expression = new JsonValueExpression(
      new SourceExpression(),
      JsonValuePath.parse("$.missing"),
    );

    expect(() =>
      expression.evaluate(createImportContext({
        name: "Bob",
      })),
    ).toThrow();
  });

  it("rejects a non-structured source", () => {
    const expression = new JsonValueExpression(
      new SourceExpression(),
      JsonValuePath.parse("$.name"),
    );

    expect(() =>
      expression.evaluate(createImportContext(
        new File("."),
      )),
    ).toThrow();
  });

  it("rejects class instances", () => {
    expect(isStructuredValue(new SourceExpressionNode())).toBe(false);
  });

  it("accepts plain nested objects", () => {
    expect(
      isStructuredValue({
        name: "Bob",
        versions: [1, 2, 3],
        metadata: {
          active: true,
        },
      }),
    ).toBe(true);
  });
});