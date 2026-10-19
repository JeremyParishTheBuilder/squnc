import { describe, it, expect } from 'vitest';
import { createTestPostgresSql, freshEngine } from '../utils/engineHelpers.js';
import { SQL_INTEGER } from '../../src/types/SqlType.js';
import { createTableTestSpec } from '../utils/buildSchema.js';
import { ImportReport } from '../../src/mapping/import/ImportReport.js';
import { ImportInstruction } from '../../src/mapping/import/ImportInstruction.js';
import {
  ImportInstructionResult,
  type ImportInstructionStatus
} from '../../src/mapping/import/ImportInstructionResult.js';
import { ImportRuleset } from '../../src/mapping/import/ImportRuleset.js';


function createTestInstruction(
  name = "Test Instruction",
): ImportInstruction {
  const sql = createTestPostgresSql(freshEngine());

  return new ImportInstruction({
    name,
    statements: [
      sql
        .createTable(
          ...createTableTestSpec("Test", {
            Id: {
              type: SQL_INTEGER,
              nullable: false,
            },
          }),
        )
        .asStatement(),
    ],
  });
}

function createInstructionResult(
  instruction: ImportInstruction,
  status: ImportInstructionStatus = "succeeded",
): ImportInstructionResult {
  return new ImportInstructionResult({
    instruction,
    status,
  });
}

describe("ImportReport", () => {
  it("passes when all instructions succeed and the import commits", () => {
    const first = createTestInstruction("First Instruction");
    const second = createTestInstruction("Second Instruction");

    const ruleset = ImportRuleset
      .create({ name: "Test Import" })
      .withInstruction(first)
      .withInstruction(second);

    const report = new ImportReport({
      ruleset,
      instructionResults: [
        createInstructionResult(first),
        createInstructionResult(second),
      ],
      committed: true,
    });

    expect(report.passed).toBe(true);
    expect(report.failed).toBe(false);
    expect(report.committed).toBe(true);
    expect(report.failedInstructions).toEqual([]);
    expect(report.failedInstructionCount).toBe(0);
  });

  it("fails when an instruction fails", () => {
    const instruction = createTestInstruction();

    const ruleset = ImportRuleset
      .create({ name: "Test Import" })
      .withInstruction(instruction);

    const failedResult = new ImportInstructionResult({
      instruction,
      status: "failed",
      failedStatementIndex: 0,
      error: "Error: Test failure",
    });

    const report = new ImportReport({
      ruleset,
      instructionResults: [failedResult],
      committed: false,
    });

    expect(report.passed).toBe(false);
    expect(report.failed).toBe(true);
    expect(report.committed).toBe(false);
    expect(report.failedInstructions).toEqual([failedResult]);
    expect(report.failedInstructionCount).toBe(1);
  });

  it("does not count instructions that were not executed as failed", () => {
    const first = createTestInstruction("First Instruction");
    const second = createTestInstruction("Second Instruction");
    const third = createTestInstruction("Third Instruction");

    const ruleset = ImportRuleset
      .create({ name: "Test Import" })
      .withInstruction(first)
      .withInstruction(second)
      .withInstruction(third);

    const results = [
      createInstructionResult(first),
      new ImportInstructionResult({
        instruction: second,
        status: "failed",
        failedStatementIndex: 0,
        error: "Error: Test failure",
      }),
      createInstructionResult(third, "notExecuted"),
    ];

    const report = new ImportReport({
      ruleset,
      instructionResults: results,
      committed: false,
    });

    expect(report.failedInstructions).toHaveLength(1);
    expect(report.failedInstructions[0].instruction).toBe(second);
    expect(report.failedInstructionCount).toBe(1);
    expect(report.instructionResults[2].status).toBe("notExecuted");
  });

  it("fails if the transaction was not committed", () => {
    const instruction = createTestInstruction();

    const ruleset = ImportRuleset
      .create({ name: "Test Import" })
      .withInstruction(instruction);

    const report = new ImportReport({
      ruleset,
      instructionResults: [
        createInstructionResult(instruction),
      ],
      committed: false,
    });

    expect(report.passed).toBe(false);
    expect(report.failed).toBe(true);
  });

  it("serializes the ruleset and instruction results", () => {
    const instruction = createTestInstruction("Create Test Table");

    const ruleset = ImportRuleset
      .create({ name: "Test Import" })
      .withInstruction(instruction);

    const report = new ImportReport({
      ruleset,
      instructionResults: [
        createInstructionResult(instruction),
      ],
      committed: true,
    });

    const json = report.toJSON();

    expect(json.ruleset).toBe("Test Import");
    expect(json.passed).toBe(true);
    expect(json.committed).toBe(true);
    expect(json.instructionResults).toHaveLength(1);
    expect(json.instructionResults[0].instruction)
      .toBe("Create Test Table");
    expect(json.instructionResults[0].status).toBe("succeeded");
  });
});