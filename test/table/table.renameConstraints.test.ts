import { describe, it, expect } from 'vitest';
import {
  buildTable,
  buildTableWithForeignKey,
  createCheckTestSpec,
  createColumnTestSpec,
} from '../utils/buildSchema.js';
import { SQL_DECIMAL, SQL_INTEGER } from '../../src/types/SqlType.js';

describe('Table::renameConstraints', () => {
  function buildTableWithConstraints() {
    return buildTable()
      .createColumn(createColumnTestSpec({
        name: "Id",
        type: SQL_INTEGER,
        nullable: false,
      }))
      .createColumn(createColumnTestSpec({
        name: "Age",
        type: SQL_DECIMAL,
      }))
      .createColumn(createColumnTestSpec({
        name: "Email",
        type: SQL_INTEGER,
        nullable: false,
      }))
      .createIndex({
        name: "PK_Users",
        columns: ["Id"],
        unique: true,
      })
      .createPrimaryKey({
        name: "PK_Users",
        columns: ["Id"],
      })
      .createIndex({
        name: "UQ_Users_Email",
        columns: ["Email"],
        unique: true,
      })
      .createUnique({
        name: "UQ_Users_Email",
        using: "UQ_Users_Email",
      })
      .createCheck(createCheckTestSpec({
          name: "CHK_PositiveAge",
      }));
  }

  it('renames a check constraint', () => {
    const table = buildTableWithConstraints();

    const updated = table.renameConstraints([
      { from: "CHK_PositiveAge", to: "CHK_AdultAge" },
    ]);

    expect(updated.checks.requireByName("CHK_AdultAge")).toBeDefined();
  });

  it('renames a unique constraint', () => {
    const table = buildTableWithConstraints();

    const updated = table.renameConstraints([
      { from: "UQ_Users_Email", to: "UQ_Users_Contact" },
    ]);

    expect(updated.uniques.requireByName("UQ_Users_Contact")).toBeDefined();
  });

  it('renames a foreign key constraint', () => {
    const table = buildTableWithForeignKey();

    const updated = table.renameConstraints([
      {
        from: "FK1",
        to: "FK_Users_Organizations_New",
      },
    ]);

    expect(
      updated.foreignKeys.requireByName("FK_Users_Organizations_New")
    ).toBeDefined();
  });

  it('renames a primary key constraint', () => {
    const table = buildTableWithConstraints();

    const updated = table.renameConstraints([
      { from: "PK_Users", to: "PK_Users_New" },
    ]);

    expect(updated.primaryKey?.name).toBe("PK_Users_New");
  });

  it('removes old constraint names', () => {
    const table = buildTableWithConstraints();

    const updated = table.renameConstraints([
      { from: "CHK_PositiveAge", to: "CHK_AdultAge" },
      { from: "UQ_Users_Email", to: "UQ_Users_Contact" },
      { from: "PK_Users", to: "PK_Users_New" },
    ]);

    expect(updated.getConstraintByName("CHK_PositiveAge")).toBeUndefined();
    expect(updated.getConstraintByName("UQ_Users_Email")).toBeUndefined();
    expect(updated.getConstraintByName("PK_Users")).toBeUndefined();
  });

  it('does not mutate the original table', () => {
    const table = buildTableWithConstraints();

    const updated = table.renameConstraints([
      { from: "CHK_PositiveAge", to: "CHK_AdultAge" },
    ]);

    expect(table.checks.requireByName("CHK_PositiveAge")).toBeDefined();
    expect(updated.checks.requireByName("CHK_AdultAge")).toBeDefined();
  });

  it('supports case-insensitive source lookup', () => {
    const table = buildTableWithConstraints();

    const updated = table.renameConstraints([
      { from: "chk_positiveage", to: "CHK_AdultAge" },
    ]);

    expect(updated.checks.requireByName("CHK_AdultAge")).toBeDefined();
  });

  it('throws when a constraint does not exist', () => {
    const table = buildTableWithConstraints();

    expect(() => {
      table.renameConstraints([
        { from: "MissingConstraint", to: "CHK_New" },
      ]);
    }).toThrow();
  });

  it('throws when another constraint already uses a destination name', () => {
    const table = buildTableWithConstraints();

    expect(() => {
      table.renameConstraints([
        { from: "CHK_PositiveAge", to: "UQ_Users_Email" },
      ]);
    }).toThrow();
  });

  it('throws when destination names are duplicated', () => {
    const table = buildTableWithConstraints();

    expect(() => {
      table.renameConstraints([
        { from: "CHK_PositiveAge", to: "NewName" },
        { from: "UQ_Users_Email", to: "NewName" },
      ]);
    }).toThrow();
  });

  it('throws when a source constraint is duplicated', () => {
    const table = buildTableWithConstraints();

    expect(() => {
      table.renameConstraints([
        { from: "CHK_PositiveAge", to: "NewName1" },
        { from: "CHK_PositiveAge", to: "NewName2" },
      ]);
    }).toThrow();
  });

  it('supports swapping names across constraint types', () => {
    const table = buildTableWithConstraints();

    const updated = table.renameConstraints([
      { from: "CHK_PositiveAge", to: "UQ_Users_Email" },
      { from: "UQ_Users_Email", to: "CHK_PositiveAge" },
    ]);

    expect(updated.checks.requireByName("UQ_Users_Email")).toBeDefined();
    expect(updated.uniques.requireByName("CHK_PositiveAge")).toBeDefined();
  });

  it('supports cycling names across three constraint types', () => {
    const table = buildTableWithConstraints();

    const updated = table.renameConstraints([
      { from: "PK_Users", to: "UQ_Users_Email" },
      { from: "UQ_Users_Email", to: "CHK_PositiveAge" },
      { from: "CHK_PositiveAge", to: "PK_Users" },
    ]);

    expect(updated.primaryKey?.name).toBe("UQ_Users_Email");
    expect(updated.uniques.requireByName("CHK_PositiveAge")).toBeDefined();
    expect(updated.checks.requireByName("PK_Users")).toBeDefined();
  });

  it('returns the same table for an empty rename list', () => {
    const table = buildTableWithConstraints();

    expect(table.renameConstraints([])).toBe(table);
  });

  it('returns the same table when all names are unchanged', () => {
    const table = buildTableWithConstraints();

    const updated = table.renameConstraints([
      { from: "CHK_PositiveAge", to: "CHK_PositiveAge" },
    ]);

    expect(updated).toBe(table);
  });

  it('does not partially apply renames when a later rename fails', () => {
    const table = buildTableWithConstraints();

    expect(() => {
      table.renameConstraints([
        { from: "CHK_PositiveAge", to: "CHK_AdultAge" },
        { from: "MissingConstraint", to: "CHK_New" },
      ]);
    }).toThrow();

    expect(table.checks.requireByName("CHK_PositiveAge")).toBeDefined();
    expect(table.getConstraintByName("CHK_AdultAge")).toBeUndefined();
  });
});