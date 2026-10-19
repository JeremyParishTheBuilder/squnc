import { EngineRegistry } from "../engine/EngineRegistry.js";
import type { PostgresInputBatch } from "../input/PostgresInputBatch.js";
import { col, and, or } from "../ast/dsl.js";
import { ValidationEngine } from "./ValidationEngine.js";
import { ValidationRuleset } from "./ValidationRuleset.js";
import type { InputBatch } from "../input/InputBatch.js";

export const exampleChainRegistry_ValidationRuleset = (
  sql: PostgresInputBatch,
) => {
  return ValidationRuleset.create({
    name: "Chain Registry Test Validation",
  })
  .withRule({
    name: "ChainName Uniqueness",
    description: "Each chain_name must be unique",
    statements: [
      sql
        .alterTable("Chains")
        .addConstraint("ChainNameUnique")
        .unique(["ChainDirectory.ChainDirectoryName"])
        .asConstraintStatement(),
    ],
  })
  .withRule({
    name: "ChainName Consistency",
    description: "Chain Name must be consistent throughout associated files",
    statements: [
      sql
        .alterTable("Chains")
        .addConstraint("ChainDirectoryNameMatchesChainFile")
        .check(
          and(
            or(
              col("ChainFile.ChainName").isNotNull(),
              col("ChainFile.ChainName").eq(
                col("ChainDirectory.ChainDirectoryName"),
              ),
            ),
            or(
              col("AssetlistFile.ChainName").isNull(),
              col("AssetlistFile.ChainName").eq(
                col("ChainDirectory.ChainDirectoryName"),
              ),
            ),
          ),
        )
        .asConstraintStatement(),
    ],
  });
}

export function runExampleValidation(
  engineName?: string,
  databaseName?: string,
) {
  const report = ValidationEngine.validate({
    engine: EngineRegistry.getInstance().engine(engineName),
    databaseName: databaseName ?? "Test Registry",
    ruleset: exampleChainRegistry_ValidationRuleset as (sql: InputBatch) => ValidationRuleset,
  });

  console.log(`${report.failedRules.length} validation rules failed`);

  console.log(JSON.stringify(report, null, 2));
}
