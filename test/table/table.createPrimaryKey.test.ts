import { describe, it, expect } from 'vitest';
import { buildTable, createColumnTestSpec } from '../utils/buildSchema.js';
import { SQL_INTEGER } from '../../src/types/SqlType.js';

describe('Table::createPrimaryKey', () => {
  it('adds a primary key to the table', () => {
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
      });

    const updated = table.createPrimaryKey({
      name: "PK_T1",
      columns: ["Id"],
    });

    expect(
      updated.requirePrimaryKey()
    ).toBeDefined();
  });

  it('does not mutate original table (immutability)', () => {
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
      });

    const updated = table.createPrimaryKey({
      name: "PK_T1",
      columns: ["Id"],
    });

    expect(table.primaryKey).toBeUndefined();

    expect(
      updated.requirePrimaryKey()
    ).toBeDefined();
  });

  it('throws when a primary key already exists', () => {
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
      })
      .createPrimaryKey({
        name: "PK_T1",
        columns: ["Id"],
      });

    expect(() => {
      table.createPrimaryKey({
        name: "PK_T2",
        columns: ["Id"],
      });
    }).toThrow();
  });

  it('throws when primary key columns are nullable', () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Id",
        type: SQL_INTEGER,
        nullable: true,
      }))
      .createIndex({
        name: "PK_T1",
        columns: ["Id"],
        unique: true,
      });

    expect(() => {
      table.createPrimaryKey({
        name: "PK_T1",
        columns: ["Id"],
      });
    }).toThrow();
  });

  it('allows primary key name to match backing index name', () => {
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
      });

    expect(() => {
      table.createPrimaryKey({
        name: "PK_T1",
        columns: ["Id"],
      });
    }).not.toThrow();
  });

  it('throws when another constraint with the same name exists', () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Id",
        type: SQL_INTEGER,
        nullable: false,
      }))
      .createColumn(createColumnTestSpec({
        name: "OtherId",
        type: SQL_INTEGER,
        nullable: false,
      }))
      .createIndex({
        name: "UQ_1",
        columns: ["OtherId"],
        unique: true,
      })
      .createUnique({
        name: "UQ_1",
        using: "UQ_1",
      })
      .createIndex({
        name: "UQ_2",
        columns: ["Id"],
        unique: true,
      });

    expect(() => {
      table.createPrimaryKey({
        name: "UQ_1",
        columns: ["Id"],
      });
    }).toThrow();
  });

  it('throws when primary key index is not unique', () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Id",
        type: SQL_INTEGER,
        nullable: false,
      }))
      .createIndex({
        name: "PK_T1",
        columns: ["Id"],
        unique: false,
      });

    expect(() => {
      table.createPrimaryKey({
        name: "PK_T1",
        using: "PK_T1",
      });
    }).toThrow();
  });
});