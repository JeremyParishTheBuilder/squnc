import { type BaseStatement, type StatementBuilder } from "../Statement.js";
import { type InlineColumnSpec } from "../../relational/Column.js";
import { type ConstraintSpec } from "../../relational/Constraint.js";
import { CONSTRAINT_KIND } from "../../relational/ConstraintKind.js";
import { type ReferentialAction } from "../../relational/ReferentialAction.js";
import { AddConstraintBuilder } from "./AddConstraintBuilder.js";
import { RenameColumnBuilder } from "./RenameColumnBuilder.js";
import { RenameConstraintBuilder } from "./RenameConstraintBuilder.js";
import { AlterColumnBuilder } from "./AlterColumnBuilder.js";
import type { ColumnValue } from "../../types/ColumnValue.js";
import type { SqlType } from "../../types/SqlType.js";
import type { IndexSpec } from "../../relational/Index.js";
import { RenameIndexBuilder } from "./RenameIndexBuilder.js";
import type { Predicate } from "../../evaluation/predicate/Predicate.js";
import type { RowView } from "../../relational/RowView.js";

export interface AlterTableStatement extends BaseStatement {
  kind: "alter_table";
  table: string;
  operations: AlterTableOperation[];
}

export type AlterTableOperation =
  | RenameTableOperation
  | AddColumnOperation
  | DropColumnOperation
  | RenameColumnsOperation
  | AddConstraintOperation
  | DropConstraintOperation
  | DropPrimaryKeyOperation
  | RenameConstraintsOperation
  | SetColumnTypeOperation
  | SetColumnDefaultOperation
  | DropColumnDefaultOperation
  | SetColumnNotNullOperation
  | DropColumnNotNullOperation
  | RenameIndexesOperation
  | AddIndexOperation
  | DropIndexOperation;

export interface RenameTableOperation {
  op: "rename_table";
  newName: string;
}

export interface AddColumnOperation {
  op: "add_column";
  columnSpec: InlineColumnSpec;
}

export interface DropColumnOperation {
  op: "drop_column";
  columnName: string;
}

export interface ObjectRename {
  from: string;
  to: string;
}

export type ColumnRename = ObjectRename;
export type ConstraintRename = ObjectRename;
export type IndexRename = ObjectRename;

export interface RenameIndexesOperation {
  op: "rename_indexes";
  indexRenames: IndexRename[];
}

export interface RenameColumnsOperation {
  op: "rename_columns";
  columnRenames: ColumnRename[];
}

export interface SetColumnTypeOperation {
  op: "set_column_type";
  columnName: string;
  type: SqlType;
}

export interface SetColumnDefaultOperation {
  op: "set_column_default";
  columnName: string;
  value: ColumnValue;
}

export interface DropColumnDefaultOperation {
  op: "drop_column_default";
  columnName: string;
}

export interface SetColumnNotNullOperation {
  op: "set_column_not_null";
  columnName: string;
}

export interface DropColumnNotNullOperation {
  op: "drop_column_not_null";
  columnName: string;
}

export interface AddConstraintOperation {
  op: "add_constraint";
  constraint: ConstraintSpec;
}

export interface DropConstraintOperation {
  op: "drop_constraint";
  constraintName: string;
}

export interface RenameConstraintsOperation {
  op: "rename_constraints";
  constraintRenames: ConstraintRename[];
}

export interface DropPrimaryKeyOperation {
  op: "drop_primary_key";
}

export interface AddIndexOperation {
  op: "add_index";
  index: IndexSpec;
}

export interface DropIndexOperation {
  op: "drop_index";
  indexName: string;
}

export class AlterTableBuilder implements StatementBuilder {
  private operations: AlterTableOperation[] = [];

  constructor(private table: string) {}

  public withOperation(operation: AlterTableOperation): this {
    const index = this.operations.length - 1;
    const latestOperation = this.operations[index];

    if (
      operation.op === "rename_columns" &&
      latestOperation?.op === "rename_columns"
    ) {
      this.operations[index] = {
        ...latestOperation,
        columnRenames: [
          ...latestOperation.columnRenames,
          ...operation.columnRenames,
        ],
      };
    } else if (
      operation.op === "rename_constraints" &&
      latestOperation?.op === "rename_constraints"
    ) {
      this.operations[index] = {
        ...latestOperation,
        constraintRenames: [
          ...latestOperation.constraintRenames,
          ...operation.constraintRenames,
        ],
      };
    } else if (
      operation.op === "rename_indexes" &&
      latestOperation?.op === "rename_indexes"
    ) {
      this.operations[index] = {
        ...latestOperation,
        indexRenames: [
          ...latestOperation.indexRenames,
          ...operation.indexRenames,
        ],
      };
    } else {
      this.operations.push(operation);
    }

    return this;
  }

  renameTo(newName: string): this {
    return this.withOperation({
      op: "rename_table",
      newName,
    });
  }

  addColumn(columnOrList: InlineColumnSpec | InlineColumnSpec[]): this {
    const columnList = Array.isArray(columnOrList)
      ? columnOrList
      : [columnOrList];

    for (const columnSpec of columnList) {
      this.withOperation({
        op: "add_column",
        columnSpec,
      });
    }

    return this;
  }

  dropColumn(nameOrNames: string | string[]): this {
    const columnNames = Array.isArray(nameOrNames)
      ? nameOrNames
      : [nameOrNames];

    for (const columnName of columnNames) {
      this.withOperation({
        op: "drop_column",
        columnName,
      });
    }

    return this;
  }

  renameColumn(name: string): RenameColumnBuilder {
    return new RenameColumnBuilder(this, name);
  }

  alterColumn(name: string): AlterColumnBuilder {
    return new AlterColumnBuilder(this, name);
  }

  dropConstraint(nameOrNames: string | string[]): this {
    const constraintNames = Array.isArray(nameOrNames)
      ? nameOrNames
      : [nameOrNames];

    for (const constraintName of constraintNames) {
      this.withOperation({
        op: "drop_constraint",
        constraintName,
      });
    }

    return this;
  }

  dropPrimaryKey(): this {
    return this.withOperation({
      op: "drop_primary_key",
    });
  }

  addConstraint(name: string): AddConstraintBuilder {
    return new AddConstraintBuilder(this, name);
  }

  onDelete(action: ReferentialAction): this {
    const index = this.operations.length - 1;
    const operation = this.operations[index];

    if (
      operation?.op !== "add_constraint" ||
      operation.constraint.kind !== CONSTRAINT_KIND.foreignKey ||
      operation.constraint.onDelete !== undefined
    ) {
      throw new Error("Latest operation not accepting ON DELETE");
    }

    this.operations[index] = {
      ...operation,
      constraint: {
        ...operation.constraint,
        onDelete: action,
      },
    };

    return this;
  }

  onUpdate(action: ReferentialAction): this {
    const index = this.operations.length - 1;
    const operation = this.operations[index];

    if (
      operation?.op !== "add_constraint" ||
      operation.constraint.kind !== CONSTRAINT_KIND.foreignKey ||
      operation.constraint.onUpdate !== undefined
    ) {
      throw new Error("Latest operation not accepting ON UPDATE");
    }

    this.operations[index] = {
      ...operation,
      constraint: {
        ...operation.constraint,
        onUpdate: action,
      },
    };

    return this;
  }

  nullsDistinct(): this {
    const index = this.operations.length - 1;
    const operation = this.operations[index];

    if (
      operation?.op !== "add_index" ||
      operation.index.nullsDistinct !== undefined
    ) {
      throw new Error("Latest operation not accepting NULLS DISTINCT");
    }

    this.operations[index] = {
      ...operation,
      index: {
        ...operation.index,
        nullsDistinct: true,
      },
    };

    return this;
  }

  nullsNotDistinct(): this {
    const index = this.operations.length - 1;
    const operation = this.operations[index];

    if (
      operation?.op !== "add_index" ||
      operation.index.nullsDistinct !== undefined
    ) {
      throw new Error("Latest operation not accepting NULLS NOT DISTINCT");
    }

    this.operations[index] = {
      ...operation,
      index: {
        ...operation.index,
        nullsDistinct: false,
      },
    };

    return this;
  }

  where(predicate: Predicate<RowView>): this {
    const index = this.operations.length - 1;
    const operation = this.operations[index];

    if (
      operation?.op !== "add_index" ||
      operation.index.predicate !== undefined
    ) {
      throw new Error("Latest operation not accepting WHERE");
    }

    this.operations[index] = {
      ...operation,
      index: {
        ...operation.index,
        predicate,
      },
    };

    return this;
  }

  renameConstraint(name: string): RenameConstraintBuilder {
    return new RenameConstraintBuilder(this, name);
  }

  renameIndex(name: string): RenameIndexBuilder {
    return new RenameIndexBuilder(this, name);
  }

  addIndex(indexSpec: IndexSpec): this {
    this.withOperation({
      op: "add_index",
      index: indexSpec,
    });

    return this;
  }

  dropIndex(indexName: string): this {
    this.withOperation({
      op: "drop_index",
      indexName,
    });

    return this;
  }

  getNextCalls(): {
    required: string[];
    optional: string[];
  } {
    const operationsList = [
      "renameTable",
      "addColumn",
      "dropColumn",
      "renameColumn",
      "alterColumn",
      "addConstraint",
      "dropConstraint",
      "dropPrimaryKey",
      "renameConstraint",
      "renameIndex",
      "dropIndex",
      "addIndex",
    ];

    const required: string[] = [];
    const optional: string[] = [];

    if (this.operations.length === 0) {
      required.push(...operationsList);
    } else {
      optional.push(...operationsList);
    }

    const operation = this.operations.at(-1);

    if (
      operation?.op === "add_constraint" &&
      operation.constraint.kind === CONSTRAINT_KIND.foreignKey
    ) {
      if (operation.constraint.onUpdate === undefined) {
        optional.push("onUpdate");
      }

      if (operation.constraint.onDelete === undefined) {
        optional.push("onDelete");
      }
    }

    if (operation?.op === "add_index") {
      if (operation.index.nullsDistinct === undefined) {
        optional.push("nullsDistinct");
        optional.push("nullsNotDistinct");
      }

      if (operation.index.predicate === undefined) {
        optional.push("where");
      }
    }

    return { required, optional };
  }

  createStatement(): AlterTableStatement {
    if (this.operations.length < 1) {
      throw new Error(`No operations specified in ALTER TABLE statement`);
    }

    return {
      kind: "alter_table",
      table: this.table,
      operations: [...this.operations],
    };
  }
}
