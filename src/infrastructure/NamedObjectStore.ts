import { Immutable } from "./Immutable.js";
import { PersistentMap } from "./PersistentMap.js";
import { normalizeIdentifier } from "../utils/normalizeIdentifier.js";

export interface NamedObject<ID extends number> {
  id: ID;
  name: string;
}

export class NamedObjectStore<
  T extends NamedObject<ID> & Immutable,
  ID extends number,
> extends Immutable {
  public readonly byId: PersistentMap<ID, T>;
  protected readonly byName: PersistentMap<string, ID>;

  constructor(spec?: { byId: PersistentMap<ID, T> }) {
    super();

    this.byId = spec?.byId ?? new PersistentMap();
    this.byName = this.rebuildNameIndex(this.byId);

    this.validate();
    this.seal();
  }

  protected validate() {}

  protected afterClone(instance: this): void {
    (instance as this & { byName: PersistentMap<string, ID> }).byName =
      this.rebuildNameIndex(instance.byId);
  }

  // -------------------------
  // Basic access
  // -------------------------

  public get(id: ID): T | undefined {
    return this.byId.get(id);
  }

  public require(id: ID): T {
    const value = this.byId.get(id);
    if (!value) {
      throw new Error(`Schema object with id "${id}" not found`);
    }
    return value;
  }

  public getByName(name: string): T | undefined {
    const id = this.byName.get(normalizeIdentifier(name));
    if (!id) return undefined;
    return this.byId.get(id);
  }

  public requireByName(name: string): T {
    const value = this.getByName(name);
    if (!value) {
      throw new Error(`Schema object with name "${name}" not found`);
    }
    return value;
  }

  public getIdByName(name: string): ID | undefined {
    return this.byName.get(normalizeIdentifier(name));
  }

  public requireIdByName(name: string): ID {
    const id = this.getIdByName(name);
    if (!id) {
      throw new Error(`Schema object name "${name}" not found`);
    }
    return id;
  }

  // -------------------------
  // Insert / update
  // -------------------------

  public add(obj: T): NamedObjectStore<T, ID> {
    const norm = normalizeIdentifier(obj.name);

    if (this.byName.has(norm)) {
      throw new Error(`Name already exists: "${obj.name}"`);
    }

    return this.with({
      byId: this.byId.add(obj.id, obj),
    } as Partial<this>);
  }

  public update(obj: T): NamedObjectStore<T, ID> {
    if (!this.byId.has(obj.id)) {
      throw new Error(`Cannot update missing id "${obj.id}"`);
    }

    const existing = this.byId.require(obj.id);
    if (obj === existing) return this;

    const oldNorm = normalizeIdentifier(existing.name);
    const newNorm = normalizeIdentifier(obj.name);

    if (oldNorm !== newNorm) {
      if (this.byName.has(newNorm)) {
        throw new Error(`Name already exists: "${obj.name}"`);
      }
    }

    return this.with({
      byId: this.byId.update(obj.id, obj),
    } as Partial<this>);
  }

  public updateMany(objects: T[]): NamedObjectStore<T, ID> {
    if (objects.length === 0) {
      return this;
    }

    const updatesById = new Map<ID, T>();
    const destinationNames = new Set<string>();

    // Validate IDs and destination names.
    for (const obj of objects) {
      if (!this.byId.has(obj.id)) {
        throw new Error(`Cannot update missing id "${obj.id}"`);
      }

      if (updatesById.has(obj.id)) {
        throw new Error(`Duplicate update for id "${obj.id}"`);
      }

      updatesById.set(obj.id, obj);

      const normalizedName = normalizeIdentifier(obj.name);

      if (destinationNames.has(normalizedName)) {
        throw new Error(`Name already exists: "${obj.name}"`);
      }

      destinationNames.add(normalizedName);
    }

    // Validate collisions against objects outside the update set.
    for (const obj of objects) {
      const normalizedName = normalizeIdentifier(obj.name);

      if (this.byName.has(normalizedName)) {
        const existingId = this.byName.require(normalizedName);

        if (!updatesById.has(existingId)) {
          throw new Error(`Name already exists: "${obj.name}"`);
        }
      }
    }

    // Apply all updates to a local immutable collection.
    let updatedById = this.byId;

    for (const obj of objects) {
      const existing = this.byId.require(obj.id);

      if (obj !== existing) {
        updatedById = updatedById.update(obj.id, obj);
      }
    }

    return this.with({
      byId: updatedById,
    } as Partial<this>);
  }

  public remove(id: ID): NamedObjectStore<T, ID> {
    const obj = this.byId.get(id);
    if (!obj) return this;

    return this.with({
      byId: this.byId.remove(id),
    } as Partial<this>);
  }

  // -------------------------
  // Utilities
  // -------------------------

  public has(id: ID): boolean {
    return this.byId.has(id);
  }

  public hasName(name: string): boolean {
    return this.byName.has(normalizeIdentifier(name));
  }

  public assertNameUnused(name: string): void {
    const id = this.getIdByName(name);

    if (id !== undefined) {
      throw new Error(`Name "${name}" is already used by Id: ${id}`);
    }
  }

  public values(): Iterable<T> {
    return this.byId.values();
  }

  public entries(): Iterable<[ID, T]> {
    return this.byId.entries();
  }

  public some(fn: (value: T, key: ID) => boolean): boolean {
    return this.byId.some(fn);
  }

  public mapValues(fn: (value: T, id: ID) => T): NamedObjectStore<T, ID> {
    const newById = this.byId.mapValues(fn);

    if (newById === this.byId) return this;

    return new NamedObjectStore<T, ID>({
      byId: newById,
    });
  }

  private rebuildNameIndex(
    byId: PersistentMap<ID, T>,
  ): PersistentMap<string, ID> {
    let acc = new PersistentMap<string, ID>();

    for (const [id, value] of byId.entries()) {
      acc = acc.add(normalizeIdentifier(value.name), id);
    }

    return acc;
  }

  public ids(): Iterable<ID> {
    return this.byId.map.keys();
  }

  public size(): number {
    return this.byId.map.size;
  }
}
