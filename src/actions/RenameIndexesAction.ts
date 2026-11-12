import { type Action } from "./Action.js";
import { type Databases } from "../relational/Databases.js";
import type { IndexRename } from "../statements/index.js";

export class RenameIndexesAction implements Action {
  constructor(
    private dbName: string,
    private tableName: string,
    private indexRenames: IndexRename[],
  ) {}

  apply(databases: Databases): Databases {
    const db = databases.requireByName(this.dbName);

    const updatedTable = db.tables
      .requireByName(this.tableName)
      .renameIndexes(this.indexRenames);

    const updatedDb = db.updateTable(updatedTable);

    return databases.update(updatedDb);
  }
}
