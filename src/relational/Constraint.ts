import { CONSTRAINT_KIND } from "./ConstraintKind.js";
import { type ReferentialAction } from "./ReferentialAction.js";
import { type PredicateNode } from "../ast/predicate/PredicateNode.js";
import type { PrimaryKey } from "./PrimaryKey.js";
import type { Unique } from "./Unique.js";
import type { ForeignKey } from "./ForeignKey.js";
import type { Check } from "./Check.js";

export type PrimaryKeySpec = {
  kind: CONSTRAINT_KIND.primaryKey;
  name: string;
  columns?: string[];
  using?: string;
};

export type UniqueSpec = {
  kind: CONSTRAINT_KIND.unique;
  name: string;
  columns?: string[];
  using?: string;
};

export type ForeignKeySpec = {
  kind: CONSTRAINT_KIND.foreignKey;
  name: string;
  columns: string[];
  parentTable: string;
  parentColumns: string[];
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
};

export type CheckSpec = {
  kind: CONSTRAINT_KIND.check;
  name: string;
  predicate: PredicateNode;
};

export type ConstraintSpec =
  PrimaryKeySpec | UniqueSpec | ForeignKeySpec | CheckSpec;

export type DropConstraintSpec =
  { name: string } | { kind: CONSTRAINT_KIND.primaryKey };

export type TableConstraint = PrimaryKey | Unique | ForeignKey | Check;
