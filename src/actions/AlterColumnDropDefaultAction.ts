import { type Action } from "./Action.js";
import { type Databases } from "../relational/Databases.js";

export class AlterColumnDropDefaultAction implements Action {
  constructor(
    private dbName: string,
    private tableName: string,
    private columnName: string,
  ) {}

  apply(databases: Databases): Databases {
    const db = databases.requireByName(this.dbName);

    const table = db.tables.requireByName(this.tableName);

    const column = table.columns.requireByName(this.columnName);

    const updatedTable = table.updateColumn(column.updateDefault(undefined));

    const updatedDatabase = db.updateTable(updatedTable);

    return databases.update(updatedDatabase);
  }
}
