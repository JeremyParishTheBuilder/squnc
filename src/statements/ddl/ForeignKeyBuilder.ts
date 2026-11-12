import type { ConstraintSpec } from "../../relational/Constraint.js";
import { CONSTRAINT_KIND } from "../../relational/ConstraintKind.js";
import type { Statement, StatementBuilder } from "../Statement.js";
import type { AddConstraintBuilder } from "./AddConstraintBuilder.js";
import type { AddConstraintOperation } from "./AlterTableStatement.js";

export class ForeignKeyBuilder implements StatementBuilder {
  constructor(
    private readonly addConstraintBuilder: AddConstraintBuilder,
    private readonly childColumns: string[],
  ) {}

  references(parentTable: string, parentColumns: string[]) {
    const constraint: ConstraintSpec = {
      name: this.addConstraintBuilder.name,
      kind: CONSTRAINT_KIND.foreignKey,
      columns: this.childColumns,
      parentTable,
      parentColumns,
    };

    const operation: AddConstraintOperation = {
      op: "add_constraint",
      constraint,
    };

    return this.addConstraintBuilder.alterTableBuilder.withOperation(operation);
  }

  getNextCalls() {
    return {
      required: ["references"],
      optional: [],
    };
  }

  createStatement(): Statement {
    throw new Error(`Foreign Key Constraint not completely defined`);
  }
}
