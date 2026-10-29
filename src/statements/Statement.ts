import { type BeginStatement } from "./session/BeginStatement.js";
import { type CommitStatement } from "./session/CommitStatement.js";
import { type UseDatabaseStatement } from "./session/UseDatabaseStatement.js";
import { type CreateDatabaseStatement } from "./ddl/CreateDatabaseStatement.js";
import { type CreateTableStatement } from "./ddl/CreateTableStatement.js";
import {
  type AlterAddConstraint,
  type AlterTableStatement,
} from "./ddl/AlterTableStatement.js";
import { type InsertIntoStatement } from "./dml/InsertIntoStatement.js";
import { type SelectStatement } from "./dql/SelectStatement.js";
import { type UpdateSetStatement } from "./dml/UpdateSetStatement.js";
import { type DeleteFromStatement } from "./dml/DeleteFromStatement.js";
import type { UnionAllStatement } from "./dql/setOperations/UnionAllStatement.js";
import type { InnerJoinStatement } from "./dql/join/InnerJoinStatement.js";
import type { RightJoinStatement } from "./dql/join/RightJoinStatement.js";
import type { LeftJoinStatement } from "./dql/join/LeftJoinStatement.js";
import type { FullJoinStatement } from "./dql/join/FullJoinStatement.js";
import type { RollbackStatement } from "./session/RollbackStatement.js";

export interface BaseStatement {
  readonly kind: StatementKind;
}

export type StatementKind =
  | "begin"
  | "commit"
  | "rollback"
  | "create_database"
  | "use_database"
  | "create_table"
  | "alter_table"
  | "insert_into"
  | "update_set"
  | "delete_from"
  | "select"
  | "where"
  | "unionAll"
  | "innerJoin"
  | "leftJoin"
  | "rightJoin"
  | "fullJoin";

export type Statement =
  | BeginStatement
  | CommitStatement
  | RollbackStatement
  | CreateDatabaseStatement
  | UseDatabaseStatement
  | CreateTableStatement
  | AlterTableStatement
  | InsertIntoStatement
  | UpdateSetStatement
  | DeleteFromStatement
  | SelectStatement
  | UnionAllStatement
  | InnerJoinStatement
  | LeftJoinStatement
  | RightJoinStatement
  | FullJoinStatement;

export type ConstraintStatement = AlterAddConstraint;

export interface StatementBuilder {
  getNextCalls(): {
    required: string[];
    optional: string[];
  };

  createStatement(): Statement;
}
