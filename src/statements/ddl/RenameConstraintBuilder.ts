import type { Statement, StatementBuilder } from "../Statement.js";
import type {
  AlterTableBuilder,
  RenameConstraintsOperation,
} from "./AlterTableStatement.js";

export class RenameConstraintBuilder implements StatementBuilder {
  constructor(
    private alterTableBuilder: AlterTableBuilder,
    private from: string,
  ) {}

  to(to: string) {
    const operation: RenameConstraintsOperation = {
      op: "rename_constraints",
      constraintRenames: [
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
