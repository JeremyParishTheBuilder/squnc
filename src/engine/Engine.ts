import { Dialect, type DialectRules, DIALECT_RULES } from "../dialect/index.js";
import { type EnginePolicy } from "./EnginePolicy.js";
import { RuleResolver } from "./RuleResolver.js";
import { type RulesFacadeShape, RulesFacade } from "./RulesFacade.js";

import { type InputBatch } from "../input/InputBatch.js";
import { PostgresInputBatch } from "../input/PostgresInputBatch.js";
import { SqlServerInputBatch } from "../input/SqlServerInputBatch.js";
import { MySqlInputBatch } from "../input/MySqlInputBatch.js";

import { ExecutionContext } from "./ExecutionContext.js";
import { Transaction } from "./Transaction.js";

import { type Statement } from "../statements/index.js";
import { Databases } from "../relational/Databases.js";
import { SemanticAnalyzer } from "../semantic/SemanticAnalyzer.js";
import type { QueryResult } from "../evaluation/QueryResult.js";
import type { StatementExecutionOptions } from "./StatementExecutionOptions.js";
import type { Database } from "../relational/Database.js";

export class Engine {
  public databases: Databases = new Databases();
  private currentDb?: string;

  public readonly dialect: Dialect;
  public readonly dialectRules: DialectRules;
  public policy: EnginePolicy;

  readonly rules: RulesFacadeShape;
  private readonly ruleResolver: RuleResolver;

  constructor(dialect: Dialect, policy?: Partial<EnginePolicy>) {
    this.dialect = dialect;
    this.dialectRules = DIALECT_RULES[dialect];

    this.policy = policy ?? {};

    this.ruleResolver = new RuleResolver(this.dialect, this.policy);
    this.rules = RulesFacade(this.ruleResolver);
  }

  public install(databases: Databases): void {
    this.databases = databases;
  }

  static create(dialect: Dialect): Engine {
    if (!(dialect in DIALECT_RULES)) {
      throw new Error(`Unsupported dialect: ${dialect}`);
    }
    return new Engine(dialect);
  }

  // TODO
  // hasDatabase(name: string): boolean {
  //   // Check whether this.databases contains the named database.
  //   return this.databases.getByName(name) ? true : false;
  // }

  // createDatabase(name: string): void {
  //   if (this.hasDatabase(name)) {
  //     throw new Error(`Database "${name}" already exists.`);
  //   }

  //   this.databases = this.databases.create({ name });
  // }

  ensureDatabase(name: string): Database {
    let database = this.databases.getByName(name);

    if (!database) {
      this.databases = this.databases.create({ name });
      database = this.databases.requireByName(name);
    }

    return database;
  }

  updatePolicy(update: Partial<EnginePolicy>) {
    this.ruleResolver.updatePolicy(update);
  }

  //  <input batch>
  private inputBatch?: InputBatch;

  public input(): InputBatch {
    if (!this.inputBatch) {
      this.inputBatch = this.createInputBatch();
    }
    return this.inputBatch;
  }

  private createInputBatch(): InputBatch {
    switch (this.dialect) {
      case Dialect.Postgres:
        return new PostgresInputBatch(this.executeStatement.bind(this));

      case Dialect.SQLServer:
        return new SqlServerInputBatch(this.executeStatement.bind(this));

      case Dialect.MySQL:
        return new MySqlInputBatch(this.executeStatement.bind(this));

      default:
        throw new Error(
          `InputBatch for Dialect: ${this.dialect} not supported`,
        );
    }
  }

  private bindAndExecute(
    tx: Transaction,
    stmt: Statement,
    options?: StatementExecutionOptions,
  ): QueryResult | void {
    const ctx = new ExecutionContext(
      tx,
      this.rules,
      this.currentDb,
      options?.sources,
    );

    const analyzer = new SemanticAnalyzer(ctx);

    tx.addStatement(stmt);

    const result = analyzer.bindStatement(stmt);

    if (result.kind === "actions") {
      tx.addActions(result.actions);
      return;
    }

    return {
      columns: result.plan.columns,
      rows: [...result.plan.root.execute()],
    };
  }

  executeStatement(
    stmt: Statement,
    options?: StatementExecutionOptions,
  ): QueryResult | void {
    if (stmt.kind === "begin") {
      this.beginTx();
      return;
    }
    if (stmt.kind === "commit") {
      this.commitTx();
      return;
    }

    if (stmt.kind === "use_database") {
      this.setCurrentDatabase(stmt.dbName);
      return;
    }

    const tx = this.getTx();

    if (!tx) {
      return this.tryExecuteAutoCommit(stmt, options);
    }

    return this.bindAndExecute(tx, stmt, options);
  }

  tryExecuteAutoCommit(
    stmt: Statement,
    options?: StatementExecutionOptions,
  ): QueryResult | void {
    if (!this.rules.transaction.autoCommit) {
      throw new Error("Auto-commit disabled");
    }

    this.beginTx();

    try {
      const tx = this.requireTx();

      const result = this.bindAndExecute(tx, stmt, options);

      this.commitTx();

      return result;
    } catch (err) {
      this._currentTransaction = undefined;
      throw err;
    }
  }

  execute(): QueryResult[] {
    if (!this.inputBatch) return [];

    const results = this.inputBatch.execute();
    this.inputBatch = undefined;

    return results;
  }
  //  <input batch>

  //  <current database>
  public setCurrentDatabase(dbName: string): void {
    this.currentDb = dbName;
  }
  //  </current database>

  //  <transaction>
  private latestTxId = 0;
  private nextTxId(): number {
    return ++this.latestTxId;
  }

  private txHistory = new Map<number, Statement[]>();

  private _currentTransaction?: Transaction;
  getTx(): Transaction | undefined {
    return this._currentTransaction;
  }
  requireTx(): Transaction {
    const tx = this.getTx();
    if (!tx) throw new Error(`No Transaction`);
    return tx;
  }

  beginTx(): void {
    if (this._currentTransaction) {
      throw new Error("Transaction already in progress");
    }

    this._currentTransaction = new Transaction(this.nextTxId(), this.databases);
  }

  commitTx(): void {
    const tx = this._currentTransaction;
    if (!tx) {
      throw new Error("No active transaction to commit");
    }

    this.databases = tx.databases;

    if (this.rules.transaction.trackStatementHistory) {
      this.txHistory.set(tx.id, [...tx.stmts]);
    }

    this._currentTransaction = undefined;
  }

  rollbackTx(): void {
    this._currentTransaction = undefined;
  }
  //  </transaction>
}
