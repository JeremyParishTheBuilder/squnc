import { AndPredicate } from "../../../evaluation/predicate/AndPredicate.js";
import { ContainsPredicate } from "../../../evaluation/predicate/ContainsPredicate.js";
import { IsDirectoryPredicate } from "../../../evaluation/predicate/IsDirectoryPredicate.js";
import { IsFilePredicate } from "../../../evaluation/predicate/IsFilePredicate.js";
import { IsNotNullPredicate } from "../../../evaluation/predicate/IsNotNull.js";
import { IsNullPredicate } from "../../../evaluation/predicate/IsNull.js";
import { NotPredicate } from "../../../evaluation/predicate/NotPredicate.js";
import { OrPredicate } from "../../../evaluation/predicate/OrPredicate.js";
import { XorPredicate } from "../../../evaluation/predicate/XorPredicate.js";
import type { DiscoveryContext } from "../../discovery/DiscoveryContext.js";
import { type ExpressionBuilder } from "../expression/ExpressionBuilder.js";
import { PredicateBuilder } from "./PredicateBuilder.js";

export function every<TContext>(...predicates: PredicateBuilder<TContext>[]) {
  return new PredicateBuilder(
    new AndPredicate(predicates.map((p) => p.predicate)),
  );
}

export function some<TContext>(...predicates: PredicateBuilder<TContext>[]) {
  return new PredicateBuilder(
    new OrPredicate(predicates.map((p) => p.predicate)),
  );
}

export function not<TContext>(predicate: PredicateBuilder<TContext>) {
  return new PredicateBuilder(new NotPredicate(predicate.predicate));
}

export function xor<TContext>(
  left: PredicateBuilder<TContext>,
  right: PredicateBuilder<TContext>,
) {
  return new PredicateBuilder(new XorPredicate(left, right));
}

export function isDirectory() {
  return new PredicateBuilder<DiscoveryContext>(new IsDirectoryPredicate());
}

export function isFile() {
  return new PredicateBuilder<DiscoveryContext>(new IsFilePredicate());
}

export function contains(predicate: PredicateBuilder<DiscoveryContext>) {
  return new PredicateBuilder<DiscoveryContext>(
    new ContainsPredicate(predicate.predicate),
  );
}

export function isNull<TContext>(inner: ExpressionBuilder<TContext>) {
  return new PredicateBuilder<TContext>(new IsNullPredicate(inner));
}

export function isNotNull<TContext>(inner: ExpressionBuilder<TContext>) {
  return new PredicateBuilder<TContext>(new IsNotNullPredicate(inner));
}
