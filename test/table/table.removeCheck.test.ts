import { describe, it, expect } from 'vitest';
import { Table } from '../../src/relational/Table.js';
import { buildTable, createCheckTestSpec } from '../utils/buildSchema.js';
import { SQL_INTEGER } from '../../src/types/SqlType.js';

describe('Table::removeCheck', () => {
  function buildTableWithCheck(): Table {
    return buildTable()
      .createColumn({
        name: "Age",
        type: SQL_INTEGER,
      })
      .createCheck(createCheckTestSpec({
        name: "CHK_PositiveAge",
      }));
  }

  it('removes the check constraint', () => {
    const table = buildTableWithCheck();

    const updated = table.removeCheck(
      "CHK_PositiveAge"
    );

    expect(() => {
      updated.checks.requireByName(
        "CHK_PositiveAge"
      );
    }).toThrow();
  });

  it('does not mutate original table (immutability)', () => {
    const table = buildTableWithCheck();

    const updated = table.removeCheck(
      "CHK_PositiveAge"
    );

    expect(
      table.checks.requireByName(
        "CHK_PositiveAge"
      )
    ).toBeDefined();

    expect(() => {
      updated.checks.requireByName(
        "CHK_PositiveAge"
      );
    }).toThrow();
  });

  it('supports case-insensitive lookup', () => {
    const table = buildTableWithCheck();

    const updated = table.removeCheck(
      "chk_positiveage"
    );

    expect(() => {
      updated.checks.requireByName(
        "CHK_PositiveAge"
      );
    }).toThrow();
  });

  it('throws when check constraint does not exist', () => {
    const table = buildTableWithCheck();

    expect(() => {
      table.removeCheck("MissingCheck");
    }).toThrow();
  });
});