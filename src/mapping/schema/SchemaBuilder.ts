import { type ImportResult } from "../import/oldTypes/ImportResult.js";
import { DatabaseSchema } from "./DatabaseSchema.js";

export class SchemaBuilder {
  readonly schema = new DatabaseSchema();

  observe(result: ImportResult): void {
    //const table = this.schema.getOrCreateTable(result.mapping.tableName);
    const table = this.schema.getOrCreateTable(result.tableName);

    for (const [column, value] of result.values) {
      table.observe(column, value);
    }
  }
}
