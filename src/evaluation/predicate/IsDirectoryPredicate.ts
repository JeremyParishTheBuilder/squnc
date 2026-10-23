import type { DiscoveryContext } from "../../mapping/discovery/DiscoveryContext.js";
import { Directory } from "../../mapping/discovery/nodejs/Directory.js";
import { type Predicate } from "./Predicate.js";

export class IsDirectoryPredicate implements Predicate<DiscoveryContext> {
  evaluate(context: DiscoveryContext): boolean {
    return context.current instanceof Directory;
  }
}
