import { describe, it, expect } from 'vitest';
import { JsonValueExpression } from '../../src/evaluation/expression/structuredValues/JsonValueExpression.js';
import { JsonValuePath } from '../../src/mapping/import/JsonValuePath.js';
import { isStructuredContainer, isStructuredValue } from '../../src/mapping/value/StructuredValue.js';
import { CastExpression } from '../../src/evaluation/expression/CastExpression.js';
import { SQL_DECIMAL } from '../../src/types/SqlType.js';
import { LiteralExpression } from '../../src/evaluation/expression/LiteralExpression.js';
import { JsonQueryExpression } from '../../src/evaluation/expression/structuredValues/JsonQueryExpression.js';

describe("Expression::JsonValue", () => {
  it("extracts a top-level scalar", () => {
    const customObject = {
      chain_name: "osmosis",
    };

    const expression = new JsonValueExpression(
      new LiteralExpression(customObject),
      JsonValuePath.parse("$.chain_name"),
    );

    expect(
      expression.evaluate(undefined),
    ).toBe("osmosis");
  });

  it("extracts a nested scalar", () => {
    const customObject = {
      codebase: {
        version: 12,
      },
    };

    const expression = new JsonValueExpression(
      new LiteralExpression(customObject),
      JsonValuePath.parse("$.codebase.version"),
    );

    expect(
      expression.evaluate(undefined)
    ).toBe("12");
  });

  it("extracts and casts nested scalar", () => {
    const customObject = {
      codebase: {
        version: 12,
      },
    };

    const expression = new CastExpression(
      new JsonValueExpression(
        new LiteralExpression(customObject),
        JsonValuePath.parse("$.codebase.version"),
      ),
      SQL_DECIMAL
    );

    expect(
      expression.evaluate(undefined)
    ).toBe(12);
  });

  it("returns null for an explicitly null value", () => {
    const customObject = {
      value: null,
    };

    const expression = new JsonValueExpression(
      new LiteralExpression(customObject),
      JsonValuePath.parse("$.value"),
    );

    expect(
      expression.evaluate(undefined)
    ).toBeNull();
  });

  it("rejects an object result", () => {
    const customObject = {
      codebase: {
        version: 12,
      },
    };

    const expression = new JsonValueExpression(
      new LiteralExpression(customObject),
      JsonValuePath.parse("$.codebase"),
    );

    expect(() =>
      expression.evaluate(undefined),
    ).toThrow();
  });

  it("rejects an array result", () => {
    const customObject = {
      versions: [1, 2, 3],
    };

    const expression = new JsonValueExpression(
      new LiteralExpression(customObject),
      JsonValuePath.parse("$.versions"),
    );

    expect(() =>
      expression.evaluate(undefined),
    ).toThrow();
  });

  it("rejects a missing path", () => {
    const customObject = {
      name: "Bob",
    };

    const expression = new JsonValueExpression(
      new LiteralExpression(customObject),
      JsonValuePath.parse("$.missing"),
    );

    expect(() =>
      expression.evaluate(undefined),
    ).toThrow();
  });

  it("rejects a non-structured source", () => {
    const expression = new JsonValueExpression(
      new LiteralExpression(1),
      JsonValuePath.parse("$.name"),
    );

    expect(() =>
      expression.evaluate(undefined),
    ).toThrow();
  });

  
  it("extracts false as a string", () => {
    const expression = new JsonValueExpression(
      new LiteralExpression({ value: false }),
      JsonValuePath.parse("$.value"),
    );

    expect(expression.evaluate(undefined)).toBe("false");
  });

  it("extracts zero as a string", () => {
    const expression = new JsonValueExpression(
      new LiteralExpression({ value: 0 }),
      JsonValuePath.parse("$.value"),
    );

    expect(expression.evaluate(undefined)).toBe("0");
  });

});

describe("Expression::JsonQuery", () => {
  it("extracts a nested object", () => {
    const metadata = {
      network: "mainnet",
      active: true,
    };

    const expression = new JsonQueryExpression(
      new LiteralExpression({ metadata }),
      JsonValuePath.parse("$.metadata"),
    );

    expect(expression.evaluate(undefined)).toEqual(metadata);
  });

  it("extracts an array", () => {
    const versions = [1, 2, 3];

    const expression = new JsonQueryExpression(
      new LiteralExpression({ versions }),
      JsonValuePath.parse("$.versions"),
    );

    expect(expression.evaluate(undefined)).toEqual(versions);
  });

  it("extracts a nested object from an array element", () => {
    const document = {
      networks: [
        { name: "osmosis", type: "mainnet" },
      ],
    };

    const expression = new JsonQueryExpression(
      new LiteralExpression(document),
      JsonValuePath.parse("$.networks"),
    );

    expect(expression.evaluate(undefined)).toEqual(document.networks);
  });

  it("rejects a scalar result", () => {
    const expression = new JsonQueryExpression(
      new LiteralExpression({ name: "osmosis" }),
      JsonValuePath.parse("$.name"),
    );

    expect(() => expression.evaluate(undefined)).toThrow();
  });

  it("rejects a null result", () => {
    const expression = new JsonQueryExpression(
      new LiteralExpression({ value: null }),
      JsonValuePath.parse("$.value"),
    );

    expect(() => expression.evaluate(undefined)).toThrow();
  });

  it("rejects a missing path", () => {
    const expression = new JsonQueryExpression(
      new LiteralExpression({ name: "osmosis" }),
      JsonValuePath.parse("$.missing"),
    );

    expect(() => expression.evaluate(undefined)).toThrow();
  });

  it("rejects a non-structured source", () => {
    const expression = new JsonQueryExpression(
      new LiteralExpression(1),
      JsonValuePath.parse("$.name"),
    );

    expect(() => expression.evaluate(undefined)).toThrow();
  });
});
