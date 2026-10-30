import type { ImportInstructionResult } from "./ImportInstructionResult.js";
import type { ImportRuleset } from "./ImportRuleset.js";

export interface ImportReportSpec {
  readonly ruleset: ImportRuleset;
  readonly instructionResults: readonly ImportInstructionResult[];
  readonly committed: boolean;
  readonly transactionError?: string;
}

export class ImportReport {
  readonly ruleset: ImportRuleset;
  readonly instructionResults: readonly ImportInstructionResult[];
  readonly committed: boolean;
  readonly transactionError?: string;

  constructor(spec: ImportReportSpec) {
    this.ruleset = spec.ruleset;
    this.instructionResults = Object.freeze([...spec.instructionResults]);
    this.committed = spec.committed;
    this.transactionError = spec.transactionError;
  }

  get passed(): boolean {
    return (
      this.committed &&
      this.instructionResults.every((result) => result.status === "succeeded")
    );
  }

  get failed(): boolean {
    return !this.passed;
  }

  get failedInstructions(): readonly ImportInstructionResult[] {
    return this.instructionResults.filter(
      (result) => result.status === "failed",
    );
  }

  get failedInstructionCount(): number {
    return this.failedInstructions.length;
  }

  toJSON() {
    return {
      ruleset: this.ruleset.name,
      description: this.ruleset.description,
      passed: this.passed,
      committed: this.committed,
      transactionError: this.transactionError,
      instructionResults: this.instructionResults.map((result) =>
        result.toJSON(),
      ),
    };
  }
}
