import type { ImportInstructionResult } from "./ImportInstructionResult.js";

export class ImportInstructionFailure extends Error {
  constructor(readonly instructionResults: ImportInstructionResult[]) {
    super("Import instruction failed");
    this.name = "ImportInstructionFailure";
  }
}
