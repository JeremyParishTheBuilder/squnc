import { type Action } from "./Action.js";
import { type Databases } from "../relational/Databases.js";
import type { SqlType } from "../types/SqlType.js";

export class AlterColumnSetTypeAction implements Action {
  constructor(
    private dbName: string,
    private tableName: string,
    private columnName: string,
    private newType: SqlType,
  ) {}

  apply(databases: Databases): Databases {
    const db = databases.requireByName(this.dbName);

    const updatedDatabase = db.alterColumn(
      this.tableName,
      this.columnName,
      this.newType,
    );

    return databases.update(updatedDatabase);
  }
}
