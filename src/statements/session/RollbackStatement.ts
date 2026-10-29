import { type BaseStatement, type StatementBuilder } from "../Statement.js";

export interface RollbackStatement extends BaseStatement {
  kind: "rollback";
}

export class RollbackBuilder implements StatementBuilder {
  constructor() {}

  getNextCalls() {
    return {
      required: [],
      optional: [],
    };
  }

  createStatement(): RollbackStatement {
    return { kind: "rollback" };
  }
}
