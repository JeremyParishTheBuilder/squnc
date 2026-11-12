import { type Action } from "./Action.js";
import { type Databases } from "../relational/Databases.js";
import type { CheckId } from "../relational/Check.js";

export class DropCheckAction implements Action {
  constructor(
    private dbName: string,
    private tableName: string,
    private checkId: CheckId,
  ) {}

  apply(databases: Databases): Databases {
    const db = databases.requireByName(this.dbName);

    const updatedTable = db.tables
      .requireByName(this.tableName)
      .removeCheckById(this.checkId);

    const updatedDb = db.updateTable(updatedTable);

    return databases.update(updatedDb);
  }
}
