import { describe, it, expect, } from 'vitest';
import { buildTable, buildTableWithForeignKey, createForeignKeyTestSpec_Table } from '../utils/buildSchema.js';
import { SQL_INTEGER } from '../../src/types/SqlType.js';

describe('Table::createForeignKey', () => {
  it('adds a foreign key to the table', () => {
    const table = buildTableWithForeignKey();

    expect(
      table.foreignKeys.requireByName("FK1")
    ).toBeDefined();
  });

  it('rejects a foreign key when the reverese index name is already taken', () => {
    const table = buildTable()
      .createColumn({ name: "C1", type: SQL_INTEGER })
      .createIndex({
        name: "IDX1",
        columns: ["C1"],
        unique: false,
      });

    expect(() => {
      table.createForeignKey(createForeignKeyTestSpec_Table({
        name: "FK1",
        columns: ["C1"],
        reverseIndex: "IDX1",
      }));
    }).toThrow();
  });
});