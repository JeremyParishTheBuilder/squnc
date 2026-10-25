import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../../src/relational/Database.js';
import { ExecutionContext } from '../../src/engine/ExecutionContext.js';
import { SemanticAnalyzer } from '../../src/semantic/SemanticAnalyzer.js';
import { Engine } from '../../src/engine/Engine.js';
import { freshEngine } from '../utils/engineHelpers.js';
import { SelectBuilder } from '../../src/statements/index.ts';
import { bindQuery } from '../../src/semantic/query.ts';
import { buildDatabase, buildTable, createColumnTestSpec } from '../utils/buildSchema.ts';
import { SQL_DECIMAL, SQL_JSON, SQL_VARCHAR } from '../../src/types/SqlType.ts';
import { cast, col, json_query, json_value } from '../../src/ast/dsl.ts';
import type { ExpressionNode } from '../../src/ast/expression/ExpressionNode.ts';

describe("SemanticAnalyzer::bindJsonExpressions", () => {
  let engine: Engine;

  beforeEach(() => {
    engine = freshEngine();
  });

  function createSemantic(database: Database) {
    const ctx = new ExecutionContext(
      engine.requireTx(),
      engine.rules,
      database.name,
    );

    return new SemanticAnalyzer(ctx);
  }

  function createTestSemantic() {
    const documents = buildTable({ name: "Documents" })
      .createColumn(createColumnTestSpec({
        name: "Document",
        type: SQL_JSON,
        nullable: false,
      }))
      .createColumn(createColumnTestSpec({
        name: "Text",
        type: SQL_VARCHAR,
        nullable: true,
      }))
      .addRows([
        [
          {
            chain_name: "osmosis",
            version: 12,
            metadata: {
              network: "mainnet",
            },
          },
          "not JSON",
        ],
      ]);

    const database = buildDatabase()
      .addTable(documents);

    engine.databases = engine.databases.add(database);
    engine.beginTx();

    return createSemantic(database);
  }

  function bindSelect(semantic: SemanticAnalyzer, expression: ExpressionNode) {
    const select = new SelectBuilder([expression]);
    select.from("Documents");

    return bindQuery(semantic, select.createStatement());
  }

  describe("JSON_VALUE", () => {
    it("resolves to SQL_VARCHAR", () => {
      const semantic = createTestSemantic();

      const plan = bindSelect(
        semantic,
        json_value(col("Document"), "$.chain_name"),
      );

      expect(plan.columns[0].type).toBe(SQL_VARCHAR);
    });

    it("rejects a non-JSON source", () => {
      const semantic = createTestSemantic();

      expect(() =>
        bindSelect(
          semantic,
          json_value(col("Text"), "$.chain_name"),
        ),
      ).toThrow();
    });
  });

  describe("JSON_QUERY", () => {
    it("resolves to SQL_JSON", () => {
      const semantic = createTestSemantic();

      const plan = bindSelect(
        semantic,
        json_query(col("Document"), "$.metadata"),
      );

      expect(plan.columns[0].type).toBe(SQL_JSON);
    });

    it("rejects a non-JSON source", () => {
      const semantic = createTestSemantic();

      expect(() =>
        bindSelect(
          semantic,
          json_query(col("Text"), "$.metadata"),
        ),
      ).toThrow();
    });
  });

  describe("JSON expression composition", () => {
    it("allows JSON_VALUE to extract a scalar from JSON_QUERY", () => {
      const semantic = createTestSemantic();

      const plan = bindSelect(
        semantic,
        json_value(
          json_query(col("Document"), "$.metadata"),
          "$.network",
        ),
      );

      expect(plan.columns[0].type).toBe(SQL_VARCHAR);
    });

    it("allows JSON_QUERY to extract a nested object from JSON_QUERY", () => {
      const semantic = createTestSemantic();

      const plan = bindSelect(
        semantic,
        json_query(
          json_query(col("Document"), "$.metadata"),
          "$.network",
        ),
      );

      expect(plan.columns[0].type).toBe(SQL_JSON);
    });

    it("allows casting JSON_VALUE to SQL_DECIMAL", () => {
      const semantic = createTestSemantic();

      const plan = bindSelect(
        semantic,
        cast(
          json_value(col("Document"), "$.version"),
        ).as(SQL_DECIMAL),
      );

      expect(plan.columns[0].type).toBe(SQL_DECIMAL);
    });
  });
});
