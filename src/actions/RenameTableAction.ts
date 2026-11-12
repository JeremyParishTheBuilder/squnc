import { type Action } from "./Action.js";
import { type Databases } from "../relational/Databases.js";

export class RenameTableAction implements Action {
  constructor(
    private dbName: string,
    private tableName: string,
    private newName: string,
  ) {}

  apply(databases: Databases): Databases {
    const updatedDatabase = databases
      .requireByName(this.dbName)
      .renameTable(this.tableName, this.newName);

    return databases.update(updatedDatabase);
  }
}
