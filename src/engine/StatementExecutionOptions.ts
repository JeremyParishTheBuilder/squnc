import type { SourceName } from "../types/ExecutionSource.js";

export interface StatementExecutionOptions {
  readonly sources?: ReadonlyMap<SourceName, unknown>;
}
