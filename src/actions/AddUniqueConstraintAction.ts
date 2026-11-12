import { type Action } from "./Action.js";
import { type Databases } from "../relational/Databases.js";

export class AddUniqueConstraintAction implements Action {
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

    const table = db.tables.requireByName(this.tableName);

    const updatedTable = table.createUnique(this.spec);

    return databases.update(db.updateTable(updatedTable));
  }
}
