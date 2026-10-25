import { type ColumnValue } from "../../../types/ColumnValue.js";
import { type ImportRowIdentity } from "../ImportRowIdentity.js";

export class ImportResult {
  constructor(
    readonly tableName: string,
    readonly rowIdentity: ImportRowIdentity,
    readonly values: Map<string, ColumnValue>,
  ) {}
}
