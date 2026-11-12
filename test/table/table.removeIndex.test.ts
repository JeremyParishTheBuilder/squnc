import { describe, it, expect } from 'vitest';
import { buildTable, createForeignKeyTestSpec_Table, createIndexTestSpec, } from '../utils/buildSchema.js';
import { SQL_DECIMAL, SQL_VARCHAR } from '../../src/types/SqlType.js';

describe('Table::removeIndex', () => {
  it('removes an index from the table', () => {
    const table = buildTable()
      .createColumn({ name: "C1", type: SQL_DECIMAL })
      .createIndex({
        name: "I1",
        columns: ["C1"],
        unique: false,
      });

    const updated = table.removeIndex("I1");

    expect(() => {
      updated.indexes.requireByName("I1");
    }).toThrow();
  });

  it('does not mutate original table (immutability)', () => {
    const table = buildTable()
      .createColumn({ name: "C1", type: SQL_DECIMAL })
      .createIndex({
        name: "I1",
        columns: ["C1"],
        unique: false,
      });

    const updated = table.removeIndex("I1");

    expect(
      table.indexes.requireByName("I1")
    ).toBeDefined();

    expect(() => {
      updated.indexes.requireByName("I1");
    }).toThrow();
  });

  it('throws when removing non-existent index', () => {
    const table = buildTable();

    expect(() => {
      table.removeIndex("I1");
    }).toThrow();
  });

  it('rejects removing an index owned by a foreign key', () => {
    const table = buildTable()
      .createColumn({
        name: "c1",
        type: SQL_DECIMAL,
      });

    const tableWithFk = table
      .createForeignKey(createForeignKeyTestSpec_Table({
        name: "FK1",
        columns: ["c1"],
        reverseIndex: "i1",
      }));

    expect(() =>
      tableWithFk.removeIndex("i1")
    ).toThrow();
  });

  it('allows removing non-owned indexes', () => {
    const table = buildTable()
      .createColumn({
        name: "Email",
        type: SQL_VARCHAR,
      })
      .createIndex({
        name: "IDX_Email",
        columns: ["Email"],
      });

    const updated =
      table.removeIndex("IDX_Email");

    expect(
      updated.indexes.getByName("IDX_Email")
    ).toBeUndefined();
  });

  // Enable later if PK indexes gain ownership semantics
  it('rejects removing an index owned by a primary key', () => {
    const table = buildTable()
      .createColumn({
        name: "Id",
        type: SQL_DECIMAL,
        nullable: false,
      })
      .createIndex(createIndexTestSpec({
        name: "i1",
        columns: ["Id"],
        unique: true,
      }))
      .createPrimaryKey({
        name: "PK_Users",
        columns: ["Id"],
      });

    expect(() =>
      table.removeIndex("i1")
    ).toThrow();
  });
});