import { describe, it, expect } from 'vitest';
import { buildTable } from '../utils/buildSchema.js';
import { SQL_INTEGER } from '../../src/types/SqlType.js';

describe('Table::requireUnique', () => {
  it('returns the unique constraint', () => {
    const table = buildTable()
      .createColumn({
        name: "Id",
        type: SQL_INTEGER,
        nullable: false,
      })
      .createIndex({
        name: "I1",
        columns: ["Id"],
        unique: true,
      })
      .createUnique({
        name: "U1",
        using: "I1",
      });

    expect(
      table.uniques.requireByName("U1")
    ).toBeDefined();
  });

  it('throws when unique exists', () => {
    const table = buildTable();

    expect(() => {
      table.uniques.requireByName("U1");
    }).toThrow();
  });
});