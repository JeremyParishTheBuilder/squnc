import { describe, it, expect } from 'vitest';
import { buildTable, createColumnTestSpec } from '../utils/buildSchema.js';
import { SQL_INTEGER } from '../../src/types/SqlType.js';

describe('Table::requireIndex', () => {
  it('returns an existing index', () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_INTEGER }))
      .createIndex({
        name: "I1",
        columns: ["C1"],
        unique: false,
      });

    const index = table.indexes.requireByName("I1");

    expect(index).toBeDefined();
    expect(index.name).toBe("I1");
  });

  it('throws when index does not exist', () => {
    const table = buildTable();

    expect(() => {
      table.indexes.requireByName("I1");
    }).toThrow();
  });

  it('retrieves an index regardless of casing', () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_INTEGER }))
      .createIndex({
        name: "UserLookup",
        columns: ["C1"],
        unique: false,
      });

    expect(
      table.indexes.requireByName("userlookup")
    ).toBeDefined();

    expect(
      table.indexes.requireByName("USERLOOKUP")
    ).toBeDefined();

    expect(
      table.indexes.requireByName("UsErLoOkUp")
    ).toBeDefined();
  });

  it('preserves original index casing', () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_INTEGER }))
      .createIndex({
        name: "UserLookup",
        columns: ["C1"],
        unique: false,
      });

    expect(
      table.indexes.requireByName("userlookup").name
    ).toBe("UserLookup");
  });
});