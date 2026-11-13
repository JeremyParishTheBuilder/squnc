import { type Action } from "./Action.js";
import { type Databases } from "../relational/Databases.js";
import type { ConstraintRename } from "../statements/index.js";

export class RenameConstraintsAction implements Action {
  constructor(
    private dbName: string,
    private tableName: string,
    private constraintRenames: ConstraintRename[],
  ) {}

  apply(databases: Databases): Databases {
    const db = databases.requireByName(this.dbName);

    const updatedTable = db.tables
      .requireByName(this.tableName)
      .renameConstraints(this.constraintRenames);

    const updatedDb = db.updateTable(updatedTable);

    return databases.update(updatedDb);
  }
}
