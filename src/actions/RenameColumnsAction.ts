import { type Action } from "./Action.js";
import { type Databases } from "../relational/Databases.js";
import type { ColumnRename } from "../statements/index.js";

export class RenameColumnsAction implements Action {
  constructor(
    private dbName: string,
    private tableName: string,
    private columnRenames: ColumnRename[],
  ) {}

  apply(databases: Databases): Databases {
    const db = databases.requireByName(this.dbName);

    const updatedTable = db.tables
      .requireByName(this.tableName)
      .renameColumns(this.columnRenames);

    const updatedDb = db.updateTable(updatedTable);

    return databases.update(updatedDb);
  }
}
