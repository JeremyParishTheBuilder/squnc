import type { DiscoveryContext } from "../../mapping/discovery/DiscoveryContext.js";
import { File } from "../../mapping/discovery/nodejs/File.js";
import { type Predicate } from "./Predicate.js";

export class IsFilePredicate implements Predicate<DiscoveryContext> {
  evaluate(context: DiscoveryContext): boolean {
    return context.current instanceof File;
  }
}