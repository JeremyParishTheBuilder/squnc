import { type Action } from "./Action.js";
import { type Databases } from "../relational/Databases.js";

export class AlterColumnDropNotNullAction implements Action {
  constructor(
    private dbName: string,
    private tableName: string,
    private columnName: string,
  ) {}

  apply(databases: Databases): Databases {
    const db = databases.requireByName(this.dbName);

    const table = db.tables.requireByName(this.tableName);

    const updatedDatabase = db.updateTable(
      table.updateColumnNullable(this.columnName, true),
    );

    return databases.update(updatedDatabase);
  }
}
