import { type Action } from "./Action.js";
import { type Databases } from "../relational/Databases.js";

export class AddPrimaryKeyAction implements Action {
  constructor(
    private dbName: string,
    private tableName: string,
    private spec: {
      name: string;
      columns?: string[];
      using?: string;
      nullsDistinct: boolean;
    },
  ) {}

  apply(databases: Databases): Databases {
    const db = databases.requireByName(this.dbName);

    const updatedTable = db.tables
      .requireByName(this.tableName)
      .createPrimaryKey({
        ...this.spec,
      });

    const updatedDb = db.updateTable(updatedTable);

    return databases.update(updatedDb);
  }
}
