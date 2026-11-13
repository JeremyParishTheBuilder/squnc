import { describe, it, expect } from 'vitest';
import { buildTable, createColumnTestSpec } from '../utils/buildSchema.js';
import { SQL_VARCHAR } from '../../src/types/SqlType.js';

describe("Table::createUnique", () => {
  it("adds a unique constraint to the table", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Email",
        type: SQL_VARCHAR,
        nullable: false,
      }))
      .createIndex({
        name: "UQ_Email",
        columns: ["Email"],
        unique: true,
      });

    const updated = table.createUnique({
      name: "UQ_Email",
      using: "UQ_Email",
    });

    expect(
      updated.uniques.requireByName("UQ_Email")
    ).toBeDefined();
  });

  it("does not mutate original table (immutability)", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Email",
        type: SQL_VARCHAR,
        nullable: false,
      }))
      .createIndex({
        name: "UQ_Email",
        columns: ["Email"],
        unique: true,
      });

    const updated = table.createUnique({
      name: "UQ_Email",
      using: "UQ_Email",
    });

    expect(() => {
      table.uniques.requireByName("UQ_Email");
    }).toThrow();

    expect(
      updated.uniques.requireByName("UQ_Email")
    ).toBeDefined();
  });

  it("throws when referenced index does not exist", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Email",
        type: SQL_VARCHAR,
        nullable: false,
      }));

    expect(() => {
      table.createUnique({
        name: "UQ_Email",
        using: "MissingIndex",
      });
    }).toThrow();
  });

  it("throws when referenced index is not unique", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Email",
        type: SQL_VARCHAR,
        nullable: false,
      }))
      .createIndex({
        name: "IDX_Email",
        columns: ["Email"],
        unique: false,
      });

    expect(() => {
      table.createUnique({
        name: "UQ_Email",
        using: "IDX_Email",
      });
    }).toThrow();
  });

  it("allows unique name to match backing index name", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Email",
        type: SQL_VARCHAR,
        nullable: false,
      }))
      .createIndex({
        name: "UQ_Email",
        columns: ["Email"],
        unique: true,
      });

    expect(() => {
      table.createUnique({
        name: "UQ_Email",
        using: "UQ_Email",
      });
    }).not.toThrow();
  });

  it("throws when another constraint with the same name exists", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Id",
        type: SQL_VARCHAR,
        nullable: false,
      }))
      .createColumn(createColumnTestSpec({
        name: "Email",
        type: SQL_VARCHAR,
        nullable: false,
      }))
      .createIndex({
        name: "PK_Test",
        columns: ["Id"],
        unique: true,
      })
      .createPrimaryKey({
        name: "PK_Test",
        using: "PK_Test",
      })
      .createIndex({
        name: "UQ_Email",
        columns: ["Email"],
        unique: true,
      });

    expect(() => {
      table.createUnique({
        name: "PK_Test",
        using: "UQ_Email",
      });
    }).toThrow();
  });
});