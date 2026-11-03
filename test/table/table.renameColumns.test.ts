import { describe, it, expect } from 'vitest';
import { buildTable, createColumnTestSpec } from '../utils/buildSchema.js';
import { SQL_BOOLEAN, SQL_DECIMAL, SQL_VARCHAR } from '../../src/types/SqlType.js';


describe("Table::renameColumns", () => {
  it("renames an existing column", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }));

    const updated = table.renameColumns([
      { from: "C1", to: "C1_new" },
    ]);

    expect(updated.columns.requireByName("C1_new")).toBeDefined();
    expect(() => updated.columns.requireByName("C1")).toThrow();
  });

  it("renames multiple columns", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "C2", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "C3", type: SQL_DECIMAL }));

    const updated = table.renameColumns([
      { from: "C1", to: "C1_new" },
      { from: "C2", to: "C2_new" },
    ]);

    expect(updated.columns.requireByName("C1_new")).toBeDefined();
    expect(updated.columns.requireByName("C2_new")).toBeDefined();
    expect(updated.columns.requireByName("C3")).toBeDefined();

    expect(() => updated.columns.requireByName("C1")).toThrow();
    expect(() => updated.columns.requireByName("C2")).toThrow();
  });

  it("supports swapping two column names", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "C2", type: SQL_VARCHAR }));

    const updated = table.renameColumns([
      { from: "C1", to: "C2" },
      { from: "C2", to: "C1" },
    ]);

    expect(updated.columns.requireByName("C1").type).toBe(SQL_VARCHAR);
    expect(updated.columns.requireByName("C2").type).toBe(SQL_DECIMAL);
  });

  it("supports cycling three column names", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "C2", type: SQL_VARCHAR }))
      .createColumn(createColumnTestSpec({ name: "C3", type: SQL_BOOLEAN }));

    const updated = table.renameColumns([
      { from: "C1", to: "C2" },
      { from: "C2", to: "C3" },
      { from: "C3", to: "C1" },
    ]);

    expect(updated.columns.requireByName("C1").type).toBe(SQL_BOOLEAN);
    expect(updated.columns.requireByName("C2").type).toBe(SQL_DECIMAL);
    expect(updated.columns.requireByName("C3").type).toBe(SQL_VARCHAR);
  });

  it("preserves column positions after renaming", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "C2", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "C3", type: SQL_DECIMAL }));

    const updated = table.renameColumns([
      { from: "C1", to: "C1_new" },
      { from: "C3", to: "C3_new" },
    ]);

    expect(updated.columns.requireByName("C1_new").position).toBe(0);
    expect(updated.columns.requireByName("C2").position).toBe(1);
    expect(updated.columns.requireByName("C3_new").position).toBe(2);
  });

  it("does not mutate the original table", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "C2", type: SQL_DECIMAL }));

    const updated = table.renameColumns([
      { from: "C1", to: "C1_new" },
      { from: "C2", to: "C2_new" },
    ]);

    expect(table.columns.requireByName("C1")).toBeDefined();
    expect(table.columns.requireByName("C2")).toBeDefined();
    expect(() => table.columns.requireByName("C1_new")).toThrow();
    expect(() => table.columns.requireByName("C2_new")).toThrow();

    expect(updated.columns.requireByName("C1_new")).toBeDefined();
    expect(updated.columns.requireByName("C2_new")).toBeDefined();
  });

  it("throws when renaming a non-existent column", () => {
    const table = buildTable();

    expect(() => {
      table.renameColumns([
        { from: "C1", to: "C2" },
      ]);
    }).toThrow();
  });

  it("throws when a destination name belongs to an unchanged column", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "C2", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "C3", type: SQL_DECIMAL }));

    expect(() => {
      table.renameColumns([
        { from: "C1", to: "C2" },
      ]);
    }).toThrow();
  });

  it("throws when multiple columns have the same destination name", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "C2", type: SQL_DECIMAL }));

    expect(() => {
      table.renameColumns([
        { from: "C1", to: "C3" },
        { from: "C2", to: "c3" },
      ]);
    }).toThrow();
  });

  it("throws when the same column is renamed more than once", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }));

    expect(() => {
      table.renameColumns([
        { from: "C1", to: "C2" },
        { from: "c1", to: "C3" },
      ]);
    }).toThrow();
  });

  it("preserves row data after renaming", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "C2", type: SQL_VARCHAR }));

    const withRow = table.addRows([
      [123, "Alice"],
    ]);

    const updated = withRow.renameColumns([
      { from: "C1", to: "C1_new" },
      { from: "C2", to: "C2_new" },
    ]);

    expect(updated.requireRow(0)).toEqual([123, "Alice"]);
    expect(updated.columns.requireByName("C1_new").position).toBe(0);
    expect(updated.columns.requireByName("C2_new").position).toBe(1);
  });

  it("returns the original table for an empty rename list", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }));

    const updated = table.renameColumns([]);

    expect(updated).toBe(table);
  });

  it("does not mutate the original table when a batch rename fails", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }))
      .createColumn(createColumnTestSpec({ name: "C2", type: SQL_DECIMAL }));

    expect(() => {
      table.renameColumns([
        { from: "C1", to: "C3" },
        { from: "C2", to: "C3" },
      ]);
    }).toThrow();

    expect(table.columns.requireByName("C1")).toBeDefined();
    expect(table.columns.requireByName("C2")).toBeDefined();
    expect(() => table.columns.requireByName("C3")).toThrow();
  });

  it("handles renaming a column to its existing name", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({ name: "C1", type: SQL_DECIMAL }));

    const updated = table.renameColumns([
      { from: "C1", to: "C1" },
    ]);

    expect(updated).toBe(table);
  });
});
