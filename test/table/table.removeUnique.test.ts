import { describe, it, expect } from 'vitest';
import { buildTable, createColumnTestSpec } from '../utils/buildSchema.js';
import { SQL_VARCHAR } from '../../src/types/SqlType.js';

describe("Table::removeUnique", () => {
  it("removes a unique constraint", () => {
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
      })
      .createUnique({
        name: "UQ_Email",
        using: "UQ_Email",
      });

    const updated = table.removeUnique("UQ_Email");

    expect(() => {
      updated.uniques.requireByName("UQ_Email");
    }).toThrow();
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
      })
      .createUnique({
        name: "UQ_Email",
        using: "UQ_Email",
      });

    const updated = table.removeUnique("UQ_Email");

    expect(
      table.uniques.requireByName("UQ_Email")
    ).toBeDefined();

    expect(() => {
      updated.uniques.requireByName("UQ_Email");
    }).toThrow();
  });

  it("throws when unique does not exist", () => {
    const table = buildTable();

    expect(() => {
      table.removeUnique("Missing");
    }).toThrow();
  });

  it("removes an internal backing index when removing the unique constraint", () => {
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
        internal: true,
      })
      .createUnique({
        name: "UQ_Email",
        using: "UQ_Email",
      });

    const updated = table.removeUnique("UQ_Email");

    expect(updated.uniques.getByName("UQ_Email")).toBeUndefined();
    expect(updated.indexes.getByName("UQ_Email")).toBeUndefined();
  });

  it("preserves an internal backing index while another constraint references it", () => {
    const table = buildTable()
      .createColumn(createColumnTestSpec({
        name: "Email",
        type: SQL_VARCHAR,
        nullable: false,
      }))
      .createIndex({
        name: "I_Email",
        columns: ["Email"],
        unique: true,
        internal: true,
      })
      .createUnique({
        name: "UQ_Email_1",
        using: "I_Email",
      })
      .createUnique({
        name: "UQ_Email_2",
        using: "I_Email",
      });

    const afterFirstRemoval = table.removeUnique("UQ_Email_1");

    expect(afterFirstRemoval.indexes.getByName("I_Email")).toBeDefined();
    expect(afterFirstRemoval.uniques.getByName("UQ_Email_2")).toBeDefined();

    const afterSecondRemoval =
      afterFirstRemoval.removeUnique("UQ_Email_2");

    expect(afterSecondRemoval.indexes.getByName("I_Email")).toBeUndefined();
  });
});