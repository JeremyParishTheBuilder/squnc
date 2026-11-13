import type { Engine } from "../../engine/Engine.js";
import type { PublicInputBatch } from "../../input/PublicInputBatch.js";
import { ImportInstructionFailure } from "./ImportInstructionFailure.js";
import { ImportInstructionResult } from "./ImportInstructionResult.js";
import { ImportReport } from "./ImportReport.js";
import type { ImportRuleset } from "./ImportRuleset.js";

export interface ImportEngineSpec<
  TInputBatch extends PublicInputBatch = PublicInputBatch,
> {
  readonly engine: Engine;
  readonly discoveryDatabaseName: string;
  readonly businessDatabaseName: string;
  readonly ruleset: (sql: TInputBatch) => ImportRuleset;
}

export class ImportEngine {
  static import<TInputBatch extends PublicInputBatch>(
    spec: ImportEngineSpec<TInputBatch>,
  ): ImportReport {
    const { engine } = spec;
    const importRuleset = spec.ruleset(engine.input() as TInputBatch);

    // Transaction control and database selection belong to ImportEngine.
    for (const instruction of importRuleset.instructions) {
      for (const statement of instruction.statements) {
        if (
          statement.kind === "begin" ||
          statement.kind === "commit" ||
          statement.kind === "use_database" ||
          statement.kind === "create_database"
        ) {
          throw new Error(
            `Import instruction "${instruction.name}" ` +
              `cannot contain "${statement.kind}" statements.`,
          );
        }
      }
    }

    const instructionResults: ImportInstructionResult[] = [];

    try {
      engine.withTransaction(() => {
        for (
          let instructionIndex = 0;
          instructionIndex < importRuleset.instructions.length;
          instructionIndex++
        ) {
          const instruction = importRuleset.instructions[instructionIndex];

          for (
            let statementIndex = 0;
            statementIndex < instruction.statements.length;
            statementIndex++
          ) {
            const statement = instruction.statements[statementIndex];

            try {
              engine.executeStatement(statement);
            } catch (error) {
              instructionResults.push(
                new ImportInstructionResult({
                  instruction,
                  status: "failed",
                  failedStatementIndex: statementIndex,
                  error:
                    error instanceof Error
                      ? `${error.name}: ${error.message}`
                      : String(error),
                }),
              );

              for (
                let remainingIndex = instructionIndex + 1;
                remainingIndex < importRuleset.instructions.length;
                remainingIndex++
              ) {
                instructionResults.push(
                  new ImportInstructionResult({
                    instruction: importRuleset.instructions[remainingIndex],
                    status: "notExecuted",
                  }),
                );
              }

              throw new ImportInstructionFailure(instructionResults);
            }
          }

          instructionResults.push(
            new ImportInstructionResult({
              instruction,
              status: "succeeded",
            }),
          );
        }
      }, spec.businessDatabaseName);

      return new ImportReport({
        ruleset: importRuleset,
        instructionResults,
        committed: true,
      });
    } catch (error) {
      if (error instanceof ImportInstructionFailure) {
        return new ImportReport({
          ruleset: importRuleset,
          instructionResults: error.instructionResults,
          committed: false,
        });
      }

      // Transaction-level failure, including a failed commit.
      // Add a transactionError field to ImportReport if it does not
      // already have an appropriate place to represent this error.
      return new ImportReport({
        ruleset: importRuleset,
        instructionResults,
        committed: false,
        transactionError:
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error),
      });
    }
  }
}
