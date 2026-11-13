import { InputBatch } from "./InputBatch.js";
import { type InlineColumnSpec } from "../relational/Column.js";
import { type ConstraintSpec } from "../relational/Constraint.js";
import { type Statement } from "../statements/Statement.js";
import { type PredicateNode } from "../ast/predicate/PredicateNode.js";
import type { UpdateInput } from "../types/UpdateInput.js";
import type { InsertValuesInput } from "../types/InsertSource.js";
import type { QueryProjection } from "../ast/query/QueryProjection.js";
import type { TabularExpressionInput } from "../statements/dql/TabularExpressionReferencer.js";
import type { TableReferenceNode } from "../ast/tabular/TableReferenceNode.js";
import type { PublicInputBatch } from "./PublicInputBatch.js";
import type { ColumnValue } from "../types/ColumnValue.js";
import type { SqlType } from "../types/SqlType.js";
import type { IndexSpec } from "../relational/Index.js";
import type { IndexColumnArg } from "../statements/ddl/CreateIndexBuilder.js";

export class SqlServerInputBatch
  extends InputBatch
  implements PublicInputBatch
{
  constructor(
    executeStatement: (stmt: Statement) => void,
    isInner: boolean = false,
  ) {
    super(executeStatement, isInner);
  }

  createInputBatch(): this {
    return new SqlServerInputBatch(this.executeStatement) as this;
  }

  protected createInnerInputBatch(): this {
    return new SqlServerInputBatch(this.executeStatement, true) as this;
  }

  begin() {
    return super.begin();
  }

  commit() {
    return super.commit();
  }

  rollback() {
    return super.rollback();
  }

  useDatabase(dbName: string) {
    return super.useDatabase(dbName);
  }

  createDatabase(dbName: string) {
    return super.createDatabase(dbName);
  }

  createTable(
    table: string,
    columnList?: InlineColumnSpec[],
    constraintList?: ConstraintSpec[],
  ) {
    return super.createTable(table, columnList, constraintList);
  }

  as(input: string) {
    return super.as(input);
  }

  alterTable(table: string) {
    return super.alterTable(table);
  }

  addColumn(columnOrList: InlineColumnSpec | InlineColumnSpec[]) {
    return super.addColumn(columnOrList);
  }
  add = this.addColumn;

  dropColumn(nameOrNames: string | string[]) {
    return super.dropColumn(nameOrNames);
  }

  renameColumn(name: string) {
    return super.renameColumn(name);
  }

  to(name: string) {
    return super.to(name);
  }

  alterColumn(name: string) {
    return super.alterColumn(name);
  }

  setType(type: SqlType) {
    return super.setType(type);
  }

  setDefault(value: ColumnValue) {
    return super.setDefault(value);
  }

  dropDefault() {
    return super.dropDefault();
  }

  setNotNull() {
    return super.setNotNull();
  }

  dropNotNull() {
    return super.dropNotNull();
  }

  addConstraint(name: string) {
    return super.addConstraint(name);
  }

  dropConstraint(nameOrNames: string | string[]) {
    return super.dropConstraint(nameOrNames);
  }

  createIndex(name: string) {
    return super.createIndex(name);
  }

  createUniqueIndex(name: string) {
    return super.createUniqueIndex(name);
  }

  addIndex(spec: IndexSpec) {
    return super.addIndex(spec);
  }

  dropIndex(name: string) {
    return super.dropIndex(name);
  }

  renameIndex(name: string) {
    return super.renameIndex(name);
  }

  renameConstraint(name: string) {
    return super.renameConstraint(name);
  }

  dropPrimaryKey() {
    return super.dropPrimaryKey();
  }

  primaryKey(columns: string[]) {
    return super.primaryKey(columns);
  }

  unique(columns: string[]) {
    return super.unique(columns);
  }

  check(predicate: PredicateNode) {
    return super.check(predicate);
  }

  insertInto(table: string | TableReferenceNode, columns: string[] = []) {
    return super.insertInto(table, columns);
  }

  values(data: InsertValuesInput[][]) {
    return super.values(data);
  }

  defaultValues() {
    return super.defaultValues();
  }

  update(table: string) {
    return super.update(table);
  }

  set(data: Record<string, UpdateInput>) {
    return super.set(data);
  }

  deleteFrom(table: string) {
    return super.deleteFrom(table);
  }

  output(cols: string[]) {
    return super.returning(cols, "OUTPUT");
  }

  select(projectionOrQuery: QueryProjection | InputBatch) {
    return super.select(projectionOrQuery);
  }

  from(input: TabularExpressionInput | InputBatch) {
    return super.from(input);
  }

  join = this.innerJoin;
  innerJoin(input: TabularExpressionInput | InputBatch) {
    return super.innerJoin(input);
  }

  on(arg1: string | PredicateNode, arg2?: IndexColumnArg[]) {
    return super.on(arg1, arg2);
  }

  where(predicate: PredicateNode) {
    return super.where(predicate);
  }

  unionAll(query: InputBatch) {
    return super.unionAll(query);
  }
}
