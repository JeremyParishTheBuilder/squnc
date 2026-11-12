import { Immutable } from "../infrastructure/Immutable.js";
import { type IndexId } from "./Index.js";

export class PrimaryKey extends Immutable {
  public readonly name: string;
  public readonly index: IndexId;

  protected constructor(spec: { name: string; index: IndexId }) {
    super();

    this.name = spec.name;
    this.index = spec.index;

    this.validate();
    this.seal();
  }
  validate(): void {}

  public static create(spec: { name: string; index: IndexId }): PrimaryKey {
    return new this(spec);
  }

  public rename(newName: string): PrimaryKey {
    return this.with({
      name: newName,
    } as Partial<this>);
  }

  public static defaultIndexName(name: string): string {
    return name.concat("_PKIDX");
  }
}
