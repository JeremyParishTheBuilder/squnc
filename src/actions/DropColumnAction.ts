import { type Action } from "./Action.js";
import { type Databases } from "../relational/Databases.js";
import type { ColumnId } from "../relational/Column.js";

export class DropColumnAction implements Action {
  constructor(
    private dbName: string,
    private tableName: string,
    private columnId: ColumnId,
  ) {}

  apply(databases: Databases): Databases {
    const db = databases.requireByName(this.dbName);

    const updatedTable = db.tables
      .requireByName(this.tableName)
      .removeColumnById(this.columnId);

    return databases.update(db.updateTable(updatedTable));
  }
}
