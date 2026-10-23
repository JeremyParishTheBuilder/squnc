import type { DiscoveryContext } from "../../mapping/discovery/DiscoveryContext.js";
import { Directory } from "../../mapping/discovery/nodejs/Directory.js";
import { type FsObject } from "../../mapping/discovery/nodejs/FsObject.js";
import { type Predicate } from "./Predicate.js";

export class ContainsPredicate implements Predicate<DiscoveryContext> {
  constructor(private predicate: Predicate<DiscoveryContext>) {}

  evaluate(context: DiscoveryContext): boolean {
    if (!(context.current instanceof Directory)) {
      return false;
    }

    return (context.current.contents ?? []).some((child) =>
      this.predicate.evaluate(context.withCurrent(child))
    );
  }
}
