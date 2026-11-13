import { type Predicate } from "../evaluation/predicate/Predicate.js";
import { type ColumnId } from "./Column.js";
import { type ColumnValue } from "../types/ColumnValue.js";
import { ColumnBoundImmutable } from "./ColumnBoundImmutable.js";
import { type RowView } from "./RowView.js";
import type { SqlType } from "../types/SqlType.js";

export type IndexSpec = {
  name: string;
  columns: string[];
  unique?: boolean;
  nullsDistinct?: boolean;
  predicate?: Predicate;
};

export type IndexId = number & { readonly __brand: "IndexId" };

export class Index extends ColumnBoundImmutable {
  public readonly name: string;
  public readonly columns: ColumnId[];
  public readonly columnIndexes: number[];
  public readonly unique: boolean;
  public readonly nullsDistinct: boolean;
  public readonly predicate?: Predicate;
  public readonly internal: boolean;

  public readonly id: IndexId;
  public readonly map: Map<string, number[]> = new Map();

  protected constructor(spec: {
    name: string;
    columns: ColumnId[];
    columnIndexes: number[];
    unique?: boolean;
    nullsDistinct?: boolean;
    internal?: boolean;
    predicate?: Predicate;
    id: IndexId;
  }) {
    super();

    this.name = spec.name;
    this.columns = spec.columns;
    this.columnIndexes = spec.columnIndexes;
    this.unique = spec.unique ?? false;
    this.nullsDistinct = spec.nullsDistinct ?? true;
    this.predicate = spec.predicate;

    this.internal = spec.internal ?? false;

    this.id = spec.id;

    this.validate();
    this.seal();
  }

  validate() {
    super.validateColumns();
  }

  public static create(spec: {
    id: IndexId;
    name: string;
    columns: ColumnId[];
    columnIndexes: number[];
    unique?: boolean;
    nullsDistinct?: boolean;
    predicate?: Predicate;
    internal?: boolean;
  }): Index {
    return new this(spec);
  }

  public build(rows: Iterable<RowView>): Index {
    const map = new Map<string, number[]>();

    for (const row of rows) {
      if (!this.matches(row)) continue;

      const projection = this.projectValues(row.values);

      const key = this.getKeyFromRow(row);

      const existing = map.get(key) ?? [];

      if (
        this.unique &&
        existing.length > 0 &&
        (!this.nullsDistinct || !projection.includes(null))
      ) {
        throw new IndexUniquenessError({
          rowView: row,
          columns: this.columns,
          projection: projection,
          key,
          nullsDistinct: this.nullsDistinct,
          message: `Unique Index contains duplicate values`,
        });
      }

      map.set(key, [...existing, row.index]);
    }

    return this.with({
      map,
    } as Partial<this>);
  }

  public rename(newName: string): Index {
    return this.with({
      name: newName,
    } as Partial<this>);
  }

  public publish(): this {
    return this.with({
      internal: false,
    } as Partial<this>);
  }

  private matches(row: RowView): boolean {
    return this.predicate ? this.predicate.evaluate(row) : true;
  }

  public assertColumnUnreferenced(id: ColumnId): void {
    if (this.referencesColumn(id)) {
      throw new Error(`Column id: ${id} referenced`);
    }
  }

  private assertUniqueFromRow(row: RowView): void {
    const projectedValues = this.projectValues(row.values);

    if (projectedValues.includes(null) && this.nullsDistinct == true) return;

    const key = this.getKeyFromProjection(projectedValues);

    if (this.map.has(key)) {
      throw new Error(`UNIQUE violation ${row.values}`);
    }
  }

  public tryUpdateColumnIndexes(
    columnIdToIndexMap: Map<ColumnId, number>,
  ): Index {
    const updatedColumnIndexes = [...this.columnIndexes];

    for (let i = 0; i < this.columns.length; i++) {
      updatedColumnIndexes[i] = columnIdToIndexMap.get(this.columns[i])!;
    }

    return this.with({
      columnIndexes: updatedColumnIndexes,
    } as Partial<this>);
  }

  private getKeyFromProjection(projection: readonly ColumnValue[]): string {
    return JSON.stringify(projection);
  }

  private getKeyFromRow(row: RowView): string {
    return this.getKeyFromProjection(this.projectValues(row.values));
  }

  public projectValues(values: readonly ColumnValue[]): ColumnValue[] {
    return this.columnIndexes.map((i) => values[i]);
  }

  public hasProjectedValues(projection: readonly ColumnValue[]): boolean {
    return this.map.has(this.getKeyFromProjection(projection));
  }

  public hasRow(values: readonly ColumnValue[]): boolean {
    return this.map.has(this.getKeyFromProjection(this.projectValues(values)));
  }

  public getRowNumsFromProjection(
    projection: readonly ColumnValue[],
  ): number[] | undefined {
    return this.map.get(this.getKeyFromProjection(projection));
  }

  static projectRow(
    values: readonly ColumnValue[],
    columnPositions: readonly number[],
  ): readonly ColumnValue[] {
    return columnPositions.map((i) => values[i]);
  }
}

export function requiresIndexRebuild(
  oldType: SqlType,
  newType: SqlType,
): boolean {
  if (oldType !== newType) {
    return true; // for now, alway rebuild on type change
  }
  return false;
}

export interface IndexUniquenessErrorSpec {
  readonly rowView: RowView;
  readonly columns: readonly ColumnId[];
  readonly projection: readonly ColumnValue[];
  readonly key: string;
  readonly nullsDistinct: boolean;
  message: string;
}

export class IndexUniquenessError extends Error {
  readonly rowView: RowView;
  readonly columns: readonly ColumnId[];
  readonly projection: readonly ColumnValue[];
  readonly key: string;
  readonly nullsDistinct: boolean;

  constructor(spec: IndexUniquenessErrorSpec) {
    super(spec.message);

    this.rowView = spec.rowView;
    this.columns = spec.columns;
    this.projection = spec.projection;
    this.key = spec.key;
    this.nullsDistinct = spec.nullsDistinct;
  }
}
