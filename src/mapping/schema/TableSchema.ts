import { ColumnSchema } from "./ColumnSchema.js";

export class TableSchema {
  private observedRows = 0;

  constructor(
    readonly name: string,
    readonly columns = new Map<string, ColumnSchema>(),
    readonly parentTableName?: string,
    readonly sourcePath?: string,
  ) {}

  observeRow(values: ReadonlyMap<string, unknown>): void {
    for (const column of this.columns.values()) {
      if (!values.has(column.name)) {
        column.nullable = true;
      }
    }

    for (const [name, value] of values) {
      let column = this.columns.get(name);

      if (!column) {
        column = new ColumnSchema(
          name,
          undefined,
          this.observedRows > 0 || value == null,
        );

        this.columns.set(name, column);
      }

      column.observe(value);
    }

    this.observedRows++;
  }
}
