import type { Engine } from "../engine/Engine.js";
import type { PublicInputBatch } from "../input/PublicInputBatch.js";
import {
  ConstraintViolationError,
  type ConstraintViolationParticipant,
} from "../relational/ConstraintViolationError.js";
import type { Database } from "../relational/Database.js";
import { ValidationReport } from "./ValidationReport.js";
import type { ValidationRule } from "./ValidationRule.js";
import { ValidationRuleResult } from "./ValidationRuleResult.js";
import type { ValidationRuleset } from "./ValidationRuleset.js";
import { ValidationViolation } from "./ValidationViolation.js";
import type { ValidationViolationParticipant } from "./ValidationViolationParticipant.js";

export interface ValidationEngineSpec<
  TInputBatch extends PublicInputBatch = PublicInputBatch,
> {
  engine: Engine;
  databaseName: string;
  ruleset: (sql: TInputBatch) => ValidationRuleset;
}

export class ValidationEngine {
  static validate<TInputBatch extends PublicInputBatch>(
    spec: ValidationEngineSpec<TInputBatch>,
  ): ValidationReport {
    const results: ValidationRuleResult[] = spec
      .ruleset(spec.engine.input() as TInputBatch)
      .rules.map((rule) => evaluateRule(spec.engine, spec.databaseName, rule));

    return new ValidationReport({
      ruleResults: results,
    });
  }
}

function evaluateRule(
  engine: Engine,
  databaseName: string,
  rule: ValidationRule,
): ValidationRuleResult {
  const violations: ValidationViolation[] = [];

  const database = engine.databases.requireByName(databaseName);

  engine.setCurrentDatabase(databaseName);

  engine.beginTx();
  try {
    for (const statement of rule.statements) {
      try {
        engine.executeStatement(statement);
      } catch (error) {
        if (!(error instanceof ConstraintViolationError)) {
          throw error;
        }

        violations.push(
          new ValidationViolation({
            participants: error.participants.map((p) =>
              resolveViolationParticipant(p, database),
            ),
          }),
        );

        break;
      }
    }
  } finally {
    engine.rollbackTx();
  }

  return new ValidationRuleResult({
    rule,
    violations,
  });
}

function resolveViolationParticipant(
  participant: ConstraintViolationParticipant,
  database: Database,
): ValidationViolationParticipant {
  const table = database.tables.require(participant.table);

  return {
    table: participant.table,
    tableName: table.name,

    rowId: participant.rowId,

    columns: participant.columns,
    columnNames: participant.columns.map(
      (columnId) => table.columns.require(columnId).name,
    ),
    columnValues: participant.columnValues,

    referencedTable: participant.referencedTable,
    referencedTableName:
      participant.referencedTable !== undefined
        ? database.tables.require(participant.referencedTable).name
        : undefined,

    referencedColumns: participant.referencedColumns,
    referencedColumnNames:
      participant.referencedTable !== undefined &&
      participant.referencedColumns !== undefined
        ? participant.referencedColumns.map(
            (columnId) =>
              database.tables
                .require(participant.referencedTable!)
                .columns.require(columnId).name,
          )
        : undefined,
  };
}
