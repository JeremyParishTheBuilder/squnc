import { type Action } from "./Action.js";
import { type Databases } from "../relational/Databases.js";
import type { ColumnId } from "../relational/Column.js";

export interface ResolvedColumnRename {
  columnId: ColumnId;
  newName: string;
}

export class RenameColumnsAction implements Action {
  constructor(
    private dbName: string,
    private tableName: string,
    private columnRenames: ResolvedColumnRename[],
  ) {}

  apply(databases: Databases): Databases {
    const db = databases.requireByName(this.dbName);

    const updatedTable = db.tables
      .requireByName(this.tableName)
      .renameColumnsById(this.columnRenames);

    const updatedDb = db.updateTable(updatedTable);

    return databases.update(updatedDb);
  }
}
