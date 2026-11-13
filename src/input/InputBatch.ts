import {
  type Statement,
  BeginBuilder,
  CommitBuilder,
  UseDatabaseBuilder,
  CreateDatabaseBuilder,
  CreateTableBuilder,
  AlterTableBuilder,
  InsertIntoBuilder,
  SelectBuilder,
  UpdateSetBuilder,
  DeleteFromBuilder,
  type ConstraintStatement,
  type StatementBuilder,
} from "../statements/index.js";
import { type InlineColumnSpec } from "../relational/Column.js";
import { type ConstraintSpec } from "../relational/Constraint.js";
import { type ReferentialAction } from "../relational/ReferentialAction.js";
import { type PredicateNode } from "../ast/predicate/PredicateNode.js";
import { CONSTRAINT_KIND } from "../relational/ConstraintKind.js";
import {
  CURRENT_DATE,
  CURRENT_TIME,
  CURRENT_TIMESTAMP,
  DEFAULT,
  GETDATE,
  NOW,
} from "../dialect/keywords.js";
import type { UpdateInput } from "../types/UpdateInput.js";
import type { InsertValuesInput } from "../types/InsertSource.js";
import { QueryStatementBuilder } from "../statements/dql/QueryStatementBuilder.js";
import type { QueryStatement } from "../statements/dql/QueryStatement.js";
import type { QueryResult } from "../evaluation/QueryResult.js";
import {
  TabularExpressionReferencer,
  type TabularExpressionInput,
} from "../statements/dql/TabularExpressionReferencer.js";
import { JoinBuilder } from "../statements/dql/join/JoinStatement.js";
import type { QueryProjection } from "../ast/query/QueryProjection.js";
import type { TableReferenceNode } from "../ast/tabular/TableReferenceNode.js";
import { RollbackBuilder } from "../statements/session/RollbackStatement.js";
import { ForeignKeyBuilder } from "../statements/ddl/ForeignKeyBuilder.js";
import { AddConstraintBuilder } from "../statements/ddl/AddConstraintBuilder.js";
import { RenameColumnBuilder } from "../statements/ddl/RenameColumnBuilder.js";
import { RenameConstraintBuilder } from "../statements/ddl/RenameConstraintBuilder.js";
import { AlterColumnBuilder } from "../statements/ddl/AlterColumnBuilder.js";
import type { SqlType } from "../types/SqlType.js";
import type { ColumnValue } from "../types/ColumnValue.js";
import type { IndexSpec } from "../relational/Index.js";
import { RenameIndexBuilder } from "../statements/ddl/RenameIndexBuilder.js";
import {
  CreateIndexBuilder,
  type IndexColumnArg,
} from "../statements/ddl/CreateIndexBuilder.js";

export abstract class InputBatch {
  private currentBuilder: StatementBuilder | null = null;

  static statementStarters = [
    "begin",
    "commit",
    "rollback",
    "createDatabase",
    "createTable",
    "alterTable",
    "useDatabase",
    "insertInto",
    "select",
    "update",
    "deleteFrom",
    "createIndex",
    "createUniqueIndex",
  ];

  constructor(
    protected readonly executeStatement: (
      stmt: Statement,
    ) => QueryResult | void,
    private readonly isInner: boolean = false,
  ) {}

  protected abstract createInputBatch(): this;
  protected abstract createInnerInputBatch(): this;

  private finalizeStatement(): Statement {
    if (!this.currentBuilder) {
      throw new Error(`No current statement builder selected`);
    }

    const statement = this.currentBuilder.createStatement();

    this.currentBuilder = null;

    return statement;
  }

  private getAllowedCalls(): string[] {
    if (!this.currentBuilder) {
      return InputBatch.statementStarters;
    }

    const next = this.currentBuilder.getNextCalls();

    return [...next.required, ...next.optional];
  }

  private assertAllowed(canonical: string, fragment: string) {
    if (!this.getAllowedCalls().includes(canonical)) {
      throw new Error(`'${fragment}' is not valid here`);
    }
  }

  // ---- Statements ----

  protected begin(fragment: string = "BEGIN") {
    this.assertAllowed("begin", fragment);
    this.currentBuilder = new BeginBuilder();
    return this;
  }

  protected commit(fragment: string = "COMMIT") {
    this.assertAllowed("commit", fragment);
    this.currentBuilder = new CommitBuilder();
    return this;
  }

  protected rollback(fragment: string = "ROLLBACK") {
    this.assertAllowed("rollback", fragment);
    this.currentBuilder = new RollbackBuilder();
    return this;
  }

  protected useDatabase(dbName: string, fragment: string = "USE DATABASE") {
    this.assertAllowed("useDatabase", fragment);
    this.currentBuilder = new UseDatabaseBuilder(dbName);
    return this;
  }

  protected createDatabase(
    dbName: string,
    fragment: string = "CREATE DATABASE",
  ) {
    this.assertAllowed("createDatabase", fragment);
    this.currentBuilder = new CreateDatabaseBuilder(dbName);
    return this;
  }

  protected createTable(
    name: string,
    columnList?: InlineColumnSpec[],
    constraintList?: ConstraintSpec[],
    fragment: string = "CREATE TABLE",
  ) {
    this.assertAllowed("createTable", fragment);

    this.currentBuilder = new CreateTableBuilder(
      name,
      columnList,
      constraintList,
    );

    return this;
  }

  protected as(input: string | InputBatch, fragment: string = "AS") {
    this.assertAllowed("as", fragment);

    if (typeof input === "string") {
      if (!(this.currentBuilder instanceof TabularExpressionReferencer)) {
        throw new Error(`Cannot use '${fragment}' as a tabular alias here`);
      }

      this.currentBuilder = this.currentBuilder.as(input);
      return this;
    }

    if (!(this.currentBuilder instanceof CreateTableBuilder)) {
      throw new Error(
        `Cannot use '${fragment}' with a constructed query outside CREATE TABLE`,
      );
    }

    this.currentBuilder = this.currentBuilder.as(input.asQueryStatement());
    return this;
  }

  protected insertInto(
    table: string | TableReferenceNode,
    columns: string[],
    fragment: string = "INSERT INTO",
  ) {
    this.assertAllowed("insertInto", fragment);

    this.currentBuilder = new InsertIntoBuilder(table, columns);

    return this;
  }

  protected values(data: InsertValuesInput[][], fragment: string = "VALUES") {
    this.assertAllowed("values", fragment);

    if (!(this.currentBuilder instanceof InsertIntoBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of InsertInto`);
    }

    this.currentBuilder = this.currentBuilder.values(data);
    return this;
  }

  protected defaultValues(fragment: string = "DEFAULT VALUES") {
    this.assertAllowed("defaultValues", fragment);

    if (!(this.currentBuilder instanceof InsertIntoBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of InsertInto`);
    }

    this.currentBuilder = this.currentBuilder.defaultValues();
    return this;
  }

  protected returning(cols: string[], fragment: string = "RETURNING") {
    this.assertAllowed("returning", fragment);
    if (
      !(this.currentBuilder instanceof InsertIntoBuilder) &&
      !(this.currentBuilder instanceof UpdateSetBuilder)
    ) {
      throw new Error(`Cannot call '${fragment}' outside of InsertInto`);
    }
    this.currentBuilder = this.currentBuilder.returning(cols);
    return this;
  }

  protected update(table: string, fragment: string = "UPDATE") {
    this.assertAllowed("update", fragment);
    this.currentBuilder = new UpdateSetBuilder(table);
    return this;
  }

  protected set(data: Record<string, UpdateInput>, fragment: string = "SET") {
    this.assertAllowed("set", fragment);
    if (!(this.currentBuilder instanceof UpdateSetBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of Update`);
    }
    this.currentBuilder = this.currentBuilder.set(data);
    return this;
  }

  protected deleteFrom(table: string, fragment: string = "DELETE FROM") {
    this.assertAllowed("deleteFrom", fragment);
    this.currentBuilder = new DeleteFromBuilder(table);
    return this;
  }

  protected alterTable(name: string, fragment: string = "ALTER TABLE") {
    this.assertAllowed("alterTable", fragment);
    this.currentBuilder = new AlterTableBuilder(name);
    return this;
  }

  protected renameTo(name: string, fragment: string = "RENAME TO") {
    this.assertAllowed("renameTo", fragment);
    if (!(this.currentBuilder instanceof AlterTableBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.renameTo(name);
    return this;
  }

  protected addColumn(
    columnOrList: InlineColumnSpec | InlineColumnSpec[],
    fragment: string = "ADD COLUMN",
  ) {
    this.assertAllowed("addColumn", fragment);

    if (!(this.currentBuilder instanceof AlterTableBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }

    this.currentBuilder = this.currentBuilder.addColumn(columnOrList);

    return this;
  }

  protected dropColumn(
    nameOrNames: string | string[],
    fragment: string = "DROP COLUMN",
  ) {
    this.assertAllowed("dropColumn", fragment);
    if (!(this.currentBuilder instanceof AlterTableBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.dropColumn(nameOrNames);
    return this;
  }

  protected renameColumn(name: string, fragment: string = "RENAME COLUMN") {
    this.assertAllowed("renameColumn", fragment);
    if (!(this.currentBuilder instanceof AlterTableBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.renameColumn(name);
    return this;
  }

  protected to(name: string, fragment: string = "TO") {
    this.assertAllowed("to", fragment);
    if (
      !(this.currentBuilder instanceof RenameColumnBuilder) &&
      !(this.currentBuilder instanceof RenameConstraintBuilder) &&
      !(this.currentBuilder instanceof RenameIndexBuilder)
    ) {
      throw new Error(
        `Cannot call '${fragment}' outside of Rename Column/Constriant`,
      );
    }
    this.currentBuilder = this.currentBuilder.to(name);
    return this;
  }

  protected alterColumn(name: string, fragment: string = "ALTER COLUMN") {
    this.assertAllowed("alterColumn", fragment);
    if (!(this.currentBuilder instanceof AlterTableBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.alterColumn(name);
    return this;
  }

  protected setType(type: SqlType, fragment: string = "SET TYPE") {
    this.assertAllowed("setType", fragment);
    if (!(this.currentBuilder instanceof AlterColumnBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.setType(type);
    return this;
  }

  protected setDefault(value: ColumnValue, fragment: string = "SET DEFAULT") {
    this.assertAllowed("setDefault", fragment);
    if (!(this.currentBuilder instanceof AlterColumnBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.setDefault(value);
    return this;
  }

  protected dropDefault(fragment: string = "DROP DEFAULT") {
    this.assertAllowed("dropDefault", fragment);
    if (!(this.currentBuilder instanceof AlterColumnBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.dropDefault();
    return this;
  }

  protected setNotNull(fragment: string = "SET NOT NULL") {
    this.assertAllowed("setNotNull", fragment);
    if (!(this.currentBuilder instanceof AlterColumnBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.setNotNull();
    return this;
  }

  protected dropNotNull(fragment: string = "DROP NOT NULL") {
    this.assertAllowed("dropNotNull", fragment);
    if (!(this.currentBuilder instanceof AlterColumnBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.dropNotNull();
    return this;
  }

  protected dropConstraint(
    nameOrNames: string | string[],
    fragment: string = "DROP CONSTRAINT",
  ) {
    this.assertAllowed("dropConstraint", fragment);
    if (!(this.currentBuilder instanceof AlterTableBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.dropConstraint(nameOrNames);
    return this;
  }

  protected dropIndex(name: string, fragment: string = "DROP INDEX") {
    this.assertAllowed("dropIndex", fragment);

    if (this.currentBuilder instanceof AlterTableBuilder) {
      this.currentBuilder = this.currentBuilder.dropIndex(name);
      //} else if (this.currentBuilder === undefined) {
      //  this.currentBuilder = new DropIndexBuilder(name);  // TODO
    } else {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }

    return this;
  }

  protected renameIndex(name: string, fragment: string = "RENAME INDEX") {
    this.assertAllowed("renameIndex", fragment);
    if (!(this.currentBuilder instanceof AlterTableBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.renameIndex(name);
    return this;
  }

  protected renameConstraint(
    name: string,
    fragment: string = "RENAME CONSTRAINT",
  ) {
    this.assertAllowed("renameConstraint", fragment);
    if (!(this.currentBuilder instanceof AlterTableBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.renameConstraint(name);
    return this;
  }

  protected addConstraint(name: string, fragment: string = "ADD CONSTRAINT") {
    this.assertAllowed("addConstraint", fragment);
    if (!(this.currentBuilder instanceof AlterTableBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.addConstraint(name);
    return this;
  }

  protected addIndex(indexSpec: IndexSpec, fragment: string = "ADD INDEX") {
    this.assertAllowed("addIndex", fragment);
    if (!(this.currentBuilder instanceof AlterTableBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.addIndex(indexSpec);
    return this;
  }

  protected createIndex(name: string, fragment: string = "CREATE INDEX") {
    this.assertAllowed("createIndex", fragment);
    this.currentBuilder = new CreateIndexBuilder(name, false);
    return this;
  }

  protected createUniqueIndex(
    name: string,
    fragment: string = "CREATE UNIQUE INDEX",
  ) {
    this.assertAllowed("createUniqueIndex", fragment);
    this.currentBuilder = new CreateIndexBuilder(name, true);
    return this;
  }

  protected on(
    arg1: string | PredicateNode,
    arg2?: IndexColumnArg[],
    fragment: string = "ON",
  ) {
    this.assertAllowed("on", fragment);

    if (this.currentBuilder instanceof JoinBuilder) {
      if (typeof arg1 === "string") {
        throw new Error(`Invalid argument type for JOIN ... ON predicate`);
      }
      this.currentBuilder = this.currentBuilder.on(arg1);
    } else if (this.currentBuilder instanceof CreateIndexBuilder) {
      if (typeof arg1 !== "string" || arg2 === undefined) {
        throw new Error(
          `Invalid arguments for CREATE INDEX ... ON table, cols`,
        );
      }
      this.currentBuilder = this.currentBuilder.on(arg1, arg2);
    } else {
      throw new Error(
        `Cannot call '${fragment}' outside of JOIN | CREATE INDEX `,
      );
    }

    return this;
  }

  protected dropPrimaryKey(fragment: string = "DROP PRIMARY KEY") {
    this.assertAllowed("dropPrimaryKey", fragment);
    if (!(this.currentBuilder instanceof AlterTableBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.dropPrimaryKey();
    return this;
  }

  protected primaryKey(columns: string[], fragment: string = "PRIMARY KEY") {
    this.assertAllowed("primaryKey", fragment);
    if (!(this.currentBuilder instanceof AddConstraintBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.primaryKey(columns);
    return this;
  }

  protected unique(columns: string[], fragment: string = "UNIQUE") {
    this.assertAllowed("unique", fragment);
    if (!(this.currentBuilder instanceof AddConstraintBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.unique(columns);
    return this;
  }

  protected check(predicate: PredicateNode, fragment: string = "CHECK") {
    this.assertAllowed("check", fragment);
    if (!(this.currentBuilder instanceof AddConstraintBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.check(predicate);
    return this;
  }

  protected foreignKey(columns: string[], fragment: string = "FOREIGN KEY") {
    this.assertAllowed("foreignKey", fragment);
    if (!(this.currentBuilder instanceof AddConstraintBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.foreignKey(columns);
    return this;
  }

  protected references(
    parentTable: string,
    parentColumns: string[],
    fragment: string = "REFERENCES",
  ) {
    this.assertAllowed("references", fragment);
    if (!(this.currentBuilder instanceof ForeignKeyBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.references(
      parentTable,
      parentColumns,
    );
    return this;
  }

  protected onDelete(
    action: ReferentialAction,
    fragment: string = "ON DELETE",
  ) {
    this.assertAllowed("onDelete", fragment);
    if (!(this.currentBuilder instanceof AlterTableBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.onDelete(action);
    return this;
  }

  protected onUpdate(
    action: ReferentialAction,
    fragment: string = "ON UPDATE",
  ) {
    this.assertAllowed("onUpdate", fragment);
    if (!(this.currentBuilder instanceof AlterTableBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of AlterTable`);
    }
    this.currentBuilder = this.currentBuilder.onUpdate(action);
    return this;
  }

  protected select(
    projectionOrQuery: QueryProjection | InputBatch,
    fragment: string = "SELECT",
  ) {
    if (!isInputBatch(projectionOrQuery) && this.currentBuilder !== null) {
      const inner = this.createInnerInputBatch();
      inner.select(projectionOrQuery);
      return inner;
    }

    this.assertAllowed("select", fragment);

    if (isInputBatch(projectionOrQuery)) {
      if (this.currentBuilder instanceof InsertIntoBuilder) {
        this.currentBuilder = this.currentBuilder.select(
          projectionOrQuery.asQueryStatement(),
        );
        return this;
      }

      throw new Error(`Statement does not accept a query here.`);
    }

    this.currentBuilder = new SelectBuilder(projectionOrQuery);
    return this;
  }

  protected unionAll(query: InputBatch, fragment: string = "UNION ALL") {
    this.assertAllowed("unionAll", fragment);

    if (!(this.currentBuilder instanceof QueryStatementBuilder)) {
      throw new Error(`Cannot call '${fragment}' without a preceding Query`);
    }

    this.currentBuilder = this.currentBuilder.unionAll(
      query.asQueryStatement(),
    );
    return this;
  }

  protected from(
    input: TabularExpressionInput | InputBatch,
    fragment: string = "FROM",
  ) {
    this.assertAllowed("from", fragment);
    if (!(this.currentBuilder instanceof SelectBuilder)) {
      throw new Error(`Cannot call '${fragment}' outside of Select`);
    }

    const source = isInputBatch(input) ? input.asQueryStatement() : input;

    this.currentBuilder = this.currentBuilder.from(source);
    return this;
  }

  protected innerJoin(
    input: TabularExpressionInput | InputBatch,
    fragment: string = "INNER JOIN",
  ) {
    this.assertAllowed("innerJoin", fragment);
    if (!(this.currentBuilder instanceof TabularExpressionReferencer)) {
      throw new Error(
        `Cannot call '${fragment}' outside of Select/Update/Delete`,
      );
    }

    const right = isInputBatch(input) ? input.asQueryStatement() : input;

    this.currentBuilder = this.currentBuilder.innerJoin(right);

    return this;
  }

  protected where(predicate: PredicateNode, fragment: string = "WHERE") {
    this.assertAllowed("where", fragment);
    if (
      !(this.currentBuilder instanceof SelectBuilder) &&
      !(this.currentBuilder instanceof UpdateSetBuilder) &&
      !(this.currentBuilder instanceof DeleteFromBuilder)
    ) {
      throw new Error(
        `Cannot call '${fragment}' outside of SELECT/UPDATE/DELETE`,
      );
    }
    this.currentBuilder = this.currentBuilder.where(predicate);
    return this;
  }

  readonly DEFAULT: typeof DEFAULT = DEFAULT;

  readonly CURRENT_TIMESTAMP: typeof CURRENT_TIMESTAMP = CURRENT_TIMESTAMP;
  readonly CURRENT_DATE: typeof CURRENT_DATE = CURRENT_DATE;
  readonly CURRENT_TIME: typeof CURRENT_TIME = CURRENT_TIME;

  NOW(): typeof NOW {
    return NOW;
  }

  GETDATE(): typeof GETDATE {
    return GETDATE;
  }

  private tryAsStatement(assertNotInner: boolean = true): Statement {
    if (assertNotInner && this.isInner) {
      throw new Error(`Not allowed to finalize inner statement`);
    }

    return this.finalizeStatement();
  }

  public asStatement(): Statement {
    return this.tryAsStatement();
  }

  public asConstraintStatement(): ConstraintStatement {
    const statement = this.tryAsStatement();

    if (!isConstraintStatement(statement)) {
      throw new Error(
        "Statement is not a Unique, Check, or ForeignKey addition statement.",
      );
    }

    return statement;
  }

  private asQueryStatement(): QueryStatement {
    const statement = this.tryAsStatement(false);

    if (!isQueryStatement(statement)) {
      throw new Error("Statement is not a query statement.");
    }

    return statement;
  }

  execute(): QueryResult | void {
    return this.executeStatement(this.finalizeStatement());
  }

  fetch(): QueryResult {
    const result = this.executeStatement(this.finalizeStatement());

    if (!result) {
      throw new Error("Expected statement to produce a query result");
    }

    return result;
  }
}

function isConstraintStatement(
  statement: Statement | undefined,
): statement is ConstraintStatement {
  return (
    statement?.kind === "alter_table" &&
    statement.operations.length === 1 &&
    statement.operations[0].op === "add_constraint" &&
    statement.operations[0].constraint.kind !== CONSTRAINT_KIND.primaryKey
  );
}

function isQueryStatement(value: unknown): value is QueryStatement {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value.kind === "select" || value.kind === "unionAll")
  );
}

export function isInputBatch(value: unknown): value is InputBatch {
  return value instanceof InputBatch;
}
