import { describe, it, expect } from 'vitest';
import { buildTable } from '../utils/buildSchema';
import { SQL_VARCHAR } from '../../src/types/SqlType.ts';

describe('Table::requirePrimaryKey', () => {
  it('returns the primary key', () => {
    const table = buildTable()
      .createColumn({
        name: "Id",
        type: SQL_VARCHAR,
        nullable: false,
      })
      .createIndex({
        name: "PK_T1",
        columns: ["Id"],
        unique: true,
      })
      .createPrimaryKey({
        name: "PK_T1",
        using: "PK_T1",
      });

    expect(
      table.requirePrimaryKey()
    ).toBeDefined();
  });

  it('throws when no primary key exists', () => {
    const table = buildTable();

    expect(() => {
      table.requirePrimaryKey();
    }).toThrow();
  });
});