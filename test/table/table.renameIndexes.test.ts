import { describe, it, expect } from 'vitest';
import { buildTable, createColumnTestSpec } from '../utils/buildSchema.js';
import { SQL_DECIMAL } from '../../src/types/SqlType.js';

describe('Table::renameIndexes', () => {
  it('renames an index', () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createIndex({
        name: "I1",
        columns: ["C1"],
        unique: false,
      });

    const updated = table.renameIndexes([{from: "I1", to: "I2"}]);

    expect(() => {
      updated.indexes.requireByName("I1");
    }).toThrow();

    expect(
      updated.indexes.requireByName("I2")
    ).toBeDefined();
  });

  it('preserves index properties during rename', () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createIndex({
        name: "I1",
        columns: ["C1"],
        unique: true,
      });

    const columnsBeforeUpdate = table.indexes.requireByName("I1").columns;

    const updated = table.renameIndexes([{from: "I1", to: "I2"}]);

    const index = updated.indexes.requireByName("I2");

    expect(index.unique).toBe(true);
    expect(index.columns).toEqual(columnsBeforeUpdate);
  });

  it('does not mutate original table (immutability)', () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createIndex({
        name: "I1",
        columns: ["C1"],
        unique: false,
      });

    const updated = table.renameIndexes([{from: "I1", to: "I2"}]);

    expect(
      table.indexes.requireByName("I1")
    ).toBeDefined();

    expect(() => {
      table.indexes.requireByName("I2");
    }).toThrow();

    expect(
      updated.indexes.requireByName("I2")
    ).toBeDefined();
  });

  it('throws when renaming non-existent index', () => {
    const table = buildTable();

    expect(() => {
      table.renameIndexes([{from: "I1", to: "I2"}]);
    }).toThrow();
  });

  it('throws when target index name already exists', () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createIndex({
        name: "I1",
        columns: ["C1"],
        unique: false,
      })
      .createIndex({
        name: "I2",
        columns: ["C1"],
        unique: false,
      });

    expect(() => {
      table.renameIndexes([{from: "I1", to: "I2"}]);
    }).toThrow();
  });

  it('renames regardless of casing', () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createIndex({
        name: "UserLookup",
        columns: ["C1"],
        unique: false,
      });

    const updated = table.renameIndexes([{
      from: "userlookup",
      to: "I2"
    }]);

    expect(
      updated.indexes.requireByName("I2")
    ).toBeDefined();
  });

  it("renames multiple indexes", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createIndex({ name: "I1", columns: ["C1"], unique: false })
      .createIndex({ name: "I2", columns: ["C1"], unique: true })
      .createIndex({ name: "I3", columns: ["C1"], unique: false });

    const updated = table.renameIndexes([
      { from: "I1", to: "J1" },
      { from: "I2", to: "J2" },
      { from: "I3", to: "J3" },
    ]);

    expect(updated.indexes.requireByName("J1").unique).toBe(false);
    expect(updated.indexes.requireByName("J2").unique).toBe(true);
    expect(updated.indexes.requireByName("J3").unique).toBe(false);

    expect(() => updated.indexes.requireByName("I1")).toThrow();
    expect(() => updated.indexes.requireByName("I2")).toThrow();
    expect(() => updated.indexes.requireByName("I3")).toThrow();
  });

  it("supports index-name swaps", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createIndex({ name: "I1", columns: ["C1"], unique: false })
      .createIndex({ name: "I2", columns: ["C1"], unique: true });

    const updated = table.renameIndexes([
      { from: "I1", to: "I2" },
      { from: "I2", to: "I1" },
    ]);

    expect(updated.indexes.requireByName("I1").unique).toBe(true);
    expect(updated.indexes.requireByName("I2").unique).toBe(false);
  });

  it("supports index-name cycles", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createIndex({ name: "I1", columns: ["C1"], unique: false })
      .createIndex({ name: "I2", columns: ["C1"], unique: true })
      .createIndex({ name: "I3", columns: ["C1"], unique: false });

    const updated = table.renameIndexes([
      { from: "I1", to: "I2" },
      { from: "I2", to: "I3" },
      { from: "I3", to: "I1" },
    ]);

    expect(updated.indexes.requireByName("I1").unique).toBe(false);
    expect(updated.indexes.requireByName("I2").unique).toBe(false);
    expect(updated.indexes.requireByName("I3").unique).toBe(true);
  });

  it("throws when the same source index is renamed more than once", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createIndex({ name: "I1", columns: ["C1"], unique: false })
      .createIndex({ name: "I2", columns: ["C1"], unique: false });

    expect(() => {
      table.renameIndexes([
        { from: "I1", to: "J1" },
        { from: "I1", to: "J2" },
      ]);
    }).toThrow();

    expect(table.indexes.requireByName("I1")).toBeDefined();
    expect(table.indexes.requireByName("I2")).toBeDefined();
  });

  it("throws when a target name belongs to an index outside the rename batch", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createIndex({ name: "I1", columns: ["C1"], unique: false })
      .createIndex({ name: "I2", columns: ["C1"], unique: false })
      .createIndex({ name: "I3", columns: ["C1"], unique: false });

    expect(() => {
      table.renameIndexes([
        { from: "I1", to: "J1" },
        { from: "I2", to: "I3" },
      ]);
    }).toThrow();

    expect(table.indexes.requireByName("I1")).toBeDefined();
    expect(table.indexes.requireByName("I2")).toBeDefined();
    expect(table.indexes.requireByName("I3")).toBeDefined();
  });

  it("returns the same table when no indexes are renamed", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createIndex({ name: "I1", columns: ["C1"], unique: false });

    const updated = table.renameIndexes([]);

    expect(updated).toBe(table);
  });
});