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

export class MySqlInputBatch extends InputBatch {
  constructor(
    executeStatement: (stmt: Statement) => void,
    isInner: boolean = false,
  ) {
    super(executeStatement, isInner);
  }

  createInputBatch(): this {
    return new MySqlInputBatch(this.executeStatement) as this;
  }

  protected createInnerInputBatch(): this {
    return new MySqlInputBatch(this.executeStatement, true) as this;
  }

  begin() {
    return super.begin();
  }

  commit() {
    return super.commit();
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

  as(input: string | InputBatch) {
    return super.as(input);
  }

  alterTable(table: string) {
    return super.alterTable(table);
  }

  add(columnList: InlineColumnSpec[]) {
    return super.addColumn(columnList);
  }

  dropColumn(columnNames: string[]) {
    return super.dropColumn(columnNames);
  }

  renameColumn(from: string, to: string) {
    return super.renameColumn(from, to);
  }

  alterColumn(columnList: InlineColumnSpec[]) {
    return super.alterColumn(columnList);
  }

  addConstraint(name: string) {
    return super.addConstraint(name);
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

  update(table: string) {
    return super.update(table);
  }

  set(data: Record<string, UpdateInput>) {
    return super.set(data);
  }

  deleteFrom(table: string) {
    return super.deleteFrom(table);
  }

  returning(cols: string[]) {
    return super.returning(cols);
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

  on(predicate: PredicateNode) {
    return super.on(predicate);
  }

  where(predicate: PredicateNode) {
    return super.where(predicate);
  }

  unionAll(query: InputBatch) {
    return super.unionAll(query);
  }
}
