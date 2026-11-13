import type { PredicateNode } from "../../ast/predicate/PredicateNode.js";
import type { ConstraintSpec } from "../../relational/Constraint.js";
import { CONSTRAINT_KIND } from "../../relational/ConstraintKind.js";
import type { Statement, StatementBuilder } from "../Statement.js";
import type {
  AddConstraintOperation,
  AlterTableBuilder,
} from "./AlterTableStatement.js";
import { ForeignKeyBuilder } from "./ForeignKeyBuilder.js";

export class AddConstraintBuilder implements StatementBuilder {
  constructor(
    public readonly alterTableBuilder: AlterTableBuilder,
    public readonly name: string,
  ) {}

  primaryKey(columns: string[]) {
    const constraint: ConstraintSpec = {
      name: this.name,
      kind: CONSTRAINT_KIND.primaryKey,
      columns,
    };

    const operation: AddConstraintOperation = {
      op: "add_constraint",
      constraint,
    };

    return this.alterTableBuilder.withOperation(operation);
  }

  unique(columns: string[]) {
    const constraint: ConstraintSpec = {
      name: this.name,
      kind: CONSTRAINT_KIND.unique,
      columns,
    };

    const operation: AddConstraintOperation = {
      op: "add_constraint",
      constraint,
    };

    return this.alterTableBuilder.withOperation(operation);
  }

  check(predicate: PredicateNode) {
    const constraint: ConstraintSpec = {
      name: this.name,
      kind: CONSTRAINT_KIND.check,
      predicate,
    };

    const operation: AddConstraintOperation = {
      op: "add_constraint",
      constraint,
    };

    return this.alterTableBuilder.withOperation(operation);
  }

  foreignKey(childColumns: string[]) {
    return new ForeignKeyBuilder(this, childColumns);
  }

  getNextCalls() {
    return {
      required: ["primaryKey", "unique", "check", "foreignKey"],
      optional: [],
    };
  }

  createStatement(): Statement {
    throw new Error(`Contraint not completely defined`);
  }
}
