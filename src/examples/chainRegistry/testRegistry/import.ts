import { json_value, property } from "../../../ast/dsl.js";
import type { PostgresInputBatch } from "../../../input/PostgresInputBatch.js";
import { ImportRuleset } from "../../../mapping/import/ImportRuleset.js";
import type { InlineColumnSpec } from "../../../relational/Column.js";
import { SQL_VARCHAR } from "../../../types/SqlType.js";

export const testRegistry_ImportRuleset = (sql: PostgresInputBatch) => {
  return (
    ImportRuleset.create({
      name: "Chain Registry Test Import",
    })
      .withInstruction({
        name: "Chain Directories",
        description:
          "Import all chain directories, which may be incomplete/stubs.",
        statements: [
          sql
            .createTable("Chains", [
              {
                name: "chainDirectoryName",
                type: SQL_VARCHAR,
                nullable: false,
              } as InlineColumnSpec,
            ])
            .asStatement(),

          sql
            .insertInto("Chains", ["chainDirectoryName"])
            .select(
              sql
                .select([json_value(property("metadata"), "$.source.basename")])
                .from("discovery.chainDirectory"),
            )
            .asStatement(),
        ],
      })
  );
};