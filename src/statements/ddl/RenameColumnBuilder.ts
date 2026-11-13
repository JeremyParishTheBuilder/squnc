import type { Statement, StatementBuilder } from "../Statement.js";
import type {
  AlterTableBuilder,
  RenameColumnsOperation,
} from "./AlterTableStatement.js";

export class RenameColumnBuilder implements StatementBuilder {
  constructor(
    private alterTableBuilder: AlterTableBuilder,
    private from: string,
  ) {}

  to(to: string) {
    const operation: RenameColumnsOperation = {
      op: "rename_columns",
      columnRenames: [
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
