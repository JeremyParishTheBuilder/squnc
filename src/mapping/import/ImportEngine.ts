import type { Engine } from "../../engine/Engine.js";
import type { StatementExecutionOptions } from "../../engine/StatementExecutionOptions.js";
import type { InputBatch } from "../../input/InputBatch.js";
import type { DiscoveryResults } from "../discovery/DiscoveryResults.js";
import { ImportInstructionResult } from "./ImportInstructionResult.js";
import { ImportReport } from "./ImportReport.js";
import type { ImportRuleset } from "./ImportRuleset.js";

export interface ImportEngineSpec<TInputBatch extends InputBatch = InputBatch> {
  readonly engine: Engine;
  readonly databaseName: string;
  readonly discovery?: DiscoveryResults;
  readonly ruleset: (sql: TInputBatch) => ImportRuleset;
}

export class ImportEngine {
  static import<TInputBatch extends InputBatch>(
    spec: ImportEngineSpec<TInputBatch>,
  ): ImportReport {
    const { engine, discovery } = spec;

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

    engine.setCurrentDatabase(spec.databaseName);

    const options: StatementExecutionOptions = {
      sources: discovery ? new Map([["discovery", discovery]]) : new Map(),
    };

    const instructionResults: ImportInstructionResult[] = [];

    engine.beginTx();

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
          engine.executeStatement(statement, options);
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

          engine.rollbackTx();

          return new ImportReport({
            ruleset: importRuleset,
            instructionResults,
            committed: false,
          });
        }
      }

      instructionResults.push(
        new ImportInstructionResult({
          instruction,
          status: "succeeded",
        }),
      );
    }

    engine.commitTx();

    return new ImportReport({
      ruleset: importRuleset,
      instructionResults,
      committed: true,
    });
  }
}
