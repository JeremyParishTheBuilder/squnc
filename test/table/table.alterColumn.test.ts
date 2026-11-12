import { describe, it, expect } from 'vitest';
import { buildTable, createCheckTestSpec, createColumnTestSpec } from '../utils/buildSchema.js';
import { ColumnExpressionNode } from '../../src/ast/expression/ColumnExpressionNode.js';
import { LiteralExpressionNode } from '../../src/ast/expression/LiteralExpressionNode.js';
import { ComparisonPredicateNode } from '../../src/ast/predicate/ComparisonPredicateNode.js';
import { SQL_DECIMAL, SQL_INTEGER, SQL_VARCHAR } from '../../src/types/SqlType.js';

describe('Table::alterColumn', () => {
  it('rejects altering a column rows fail existing checks', () => {

    const table =
      buildTable()
        .createColumn(createColumnTestSpec({
          name: "Age",
          type: SQL_DECIMAL,
        }))
        .createCheck(
          createCheckTestSpec({
            name: "CHK_Adult",
            predicate: new ComparisonPredicateNode(
              new ColumnExpressionNode("Age"),
              "gte",
              new LiteralExpressionNode(18),
            ),
          })
        )
        .addRows([[20]]);

    expect(() => {
      table.alterColumn(
        "Age",
        SQL_VARCHAR
      );
    }).toThrow();
  });

  it('allows altering column when checks still satisfied', () => {
    const table =
      buildTable()
        .createColumn(createColumnTestSpec({
          name: "Age",
          type: SQL_DECIMAL,
        }))
        .createCheck(
          createCheckTestSpec({
            name: "CHK_Adult",
            predicate: new ComparisonPredicateNode(
              new ColumnExpressionNode("Age"),
              "gte",
              new LiteralExpressionNode(18),
            ),
          })
        )
        .addRows([[20]]);

    expect(() => {
      table.alterColumn("Age", SQL_DECIMAL);
    }).not.toThrow();
  });

  it("converts existing values when altering to a castable type", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Age",
        type: SQL_DECIMAL,
      }))
      .addRows([[20], [30]]);

    const altered = table.alterColumn("Age", SQL_VARCHAR);

    expect(altered.columns.requireByName("Age").data)
      .toEqual(["20", "30"]);
  });

  it("rejects altering a column when an existing value cannot be cast", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Amount",
        type: SQL_DECIMAL,
      }))
      .addRows([[12.5]]);

    expect(() => {
      table.alterColumn("Amount", SQL_INTEGER);
    }).toThrow();
  });

  it("allows altering a decimal column to integer when all values are integral", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Amount",
        type: SQL_DECIMAL,
      }))
      .addRows([[12], [25]]);

    const altered = table.alterColumn("Amount", SQL_INTEGER);

    expect(altered.columns.requireByName("Amount").data)
      .toEqual([12, 25]);
  });

  it("preserves null values when altering to a castable type", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Value",
        type: SQL_INTEGER,
        nullable: true,
      }))
      .addRows([[10], [null]]);

    const altered = table.alterColumn("Value", SQL_VARCHAR);

    expect(altered.columns.requireByName("Value").data)
      .toEqual(["10", null]);
  });

  it("does not modify the original table when an existing value cannot be cast", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Amount",
        type: SQL_DECIMAL,
      }))
      .addRows([[12.5]]);

    expect(() => table.alterColumn("Amount", SQL_INTEGER))
      .toThrow();

    expect(table.columns.requireByName("Amount").type)
      .toBe(SQL_DECIMAL);

    expect(table.columns.requireByName("Amount").data)
      .toEqual([12.5]);
  });
});