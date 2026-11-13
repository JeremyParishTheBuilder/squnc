import { describe, it, expect } from 'vitest';
import { buildTable, createColumnTestSpec } from '../utils/buildSchema.js';
import { SQL_INTEGER } from '../../src/types/SqlType.js';

describe('Table::removePrimaryKey', () => {
  function buildTableWithPrimaryKey() {
    return buildTable()
      .createColumn(createColumnTestSpec({
        name: "Id",
        type: SQL_INTEGER,
        nullable: false,
      }))
      .createIndex({
        name: "PK_T1",
        columns: ["Id"],
        unique: true,
      })
      .createPrimaryKey({
        name: "PK_T1",
        using: "PK_T1",
      });
  }

  it('removes the primary key', () => {
    const table = buildTableWithPrimaryKey();

    const updated = table.removePrimaryKey();

    expect(updated.primaryKey).toBeUndefined();
  });

  it('does not mutate original table (immutability)', () => {
    const table = buildTableWithPrimaryKey();

    const updated = table.removePrimaryKey();

    expect(
      table.requirePrimaryKey()
    ).toBeDefined();

    expect(
      updated.primaryKey
    ).toBeUndefined();
  });

  it('throws when no primary key exists', () => {
    const table = buildTable();

    expect(() => {
      table.removePrimaryKey();
    }).toThrow();
  });

  it('preserves independent backing index', () => {
    const table = buildTableWithPrimaryKey()

    const updated = table.removePrimaryKey();

    expect(updated.primaryKey).toBeUndefined();

    expect(
      updated.indexes.requireByName("PK_T1")
    ).toBeDefined();
  });

  it('removes an internal backing index when removing the primary key', () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Id",
        type: SQL_INTEGER,
        nullable: false,
      }))
      .createIndex({
        name: "PK_T1",
        columns: ["Id"],
        unique: true,
        internal: true,
      })
      .createPrimaryKey({
        name: "PK_T1",
        using: "PK_T1",
      });

    const updated = table.removePrimaryKey();

    expect(updated.primaryKey).toBeUndefined();
    expect(updated.indexes.getByName("PK_T1")).toBeUndefined();
  });
});