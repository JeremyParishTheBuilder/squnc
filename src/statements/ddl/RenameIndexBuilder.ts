import type { Statement, StatementBuilder } from "../Statement.js";
import type {
  AlterTableBuilder,
  RenameIndexesOperation,
} from "./AlterTableStatement.js";

export class RenameIndexBuilder implements StatementBuilder {
  constructor(
    private alterTableBuilder: AlterTableBuilder,
    private from: string,
  ) {}

  to(to: string) {
    const operation: RenameIndexesOperation = {
      op: "rename_indexes",
      indexRenames: [
        {
          from: this.from,
          to,
        },
      ],
    };

    return this.alterTableBuilder.withOperation(operation);
  }

  getNextCalls() {
    return {
      required: ["to"],
      optional: [],
    };
  }

  createStatement(): Statement {
    throw new Error(`Rename not fully defined`);
  }
}
