import type { ColumnValue } from "../../types/ColumnValue.js";
import type { SqlType } from "../../types/SqlType.js";
import type { Statement, StatementBuilder } from "../Statement.js";
import type {
  AlterTableBuilder,
  DropColumnDefaultOperation,
  DropColumnNotNullOperation,
  SetColumnDefaultOperation,
  SetColumnNotNullOperation,
  SetColumnTypeOperation,
} from "./AlterTableStatement.js";

export class AlterColumnBuilder implements StatementBuilder {
  constructor(
    private alterTableBuilder: AlterTableBuilder,
    private name: string,
  ) {}

  setType(type: SqlType) {
    const operation: SetColumnTypeOperation = {
      op: "set_column_type",
      columnName: this.name,
      type,
    };

    return this.alterTableBuilder.withOperation(operation);
  }

  setDefault(value: ColumnValue) {
    const operation: SetColumnDefaultOperation = {
      op: "set_column_default",
      columnName: this.name,
      value,
    };

    return this.alterTableBuilder.withOperation(operation);
  }

  dropDefault() {
    const operation: DropColumnDefaultOperation = {
      op: "drop_column_default",
      columnName: this.name,
    };

    return this.alterTableBuilder.withOperation(operation);
  }

  setNotNull() {
    const operation: SetColumnNotNullOperation = {
      op: "set_column_not_null",
      columnName: this.name,
    };

    return this.alterTableBuilder.withOperation(operation);
  }

  dropNotNull() {
    const operation: DropColumnNotNullOperation = {
      op: "drop_column_not_null",
      columnName: this.name,
    };

    return this.alterTableBuilder.withOperation(operation);
  }

  getNextCalls() {
    return {
      required: [
        "setType",
        "setNotNull",
        "dropNotNull",
        "setDefault",
        "dropDefault",
      ],
      optional: [],
    };
  }

  createStatement(): Statement {
    throw new Error(`Alter column not fully defined`);
  }
}
