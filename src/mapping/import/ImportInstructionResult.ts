import type { ImportInstruction } from "./ImportInstruction.js";

export type ImportInstructionStatus = "succeeded" | "failed" | "notExecuted";

export interface ImportInstructionResultSpec {
  readonly instruction: ImportInstruction;
  readonly status: ImportInstructionStatus;
  readonly error?: string;
  readonly failedStatementIndex?: number;
}

export class ImportInstructionResult {
  readonly instruction: ImportInstruction;
  readonly status: ImportInstructionStatus;
  readonly error?: string;
  readonly failedStatementIndex?: number;

  constructor(spec: ImportInstructionResultSpec) {
    this.instruction = spec.instruction;
    this.status = spec.status;
    this.error = spec.error;
    this.failedStatementIndex = spec.failedStatementIndex;
  }

  toJSON() {
    return {
      instruction: this.instruction.name,
      description: this.instruction.description,
      status: this.status,
      error: this.error,
      failedStatementIndex: this.failedStatementIndex,
    };
  }
}
