import { Directory } from "../../mapping/discovery/nodejs/Directory.js";
import { type FsObject } from "../../mapping/discovery/nodejs/FsObject.js";
import { type Predicate } from "./Predicate.js";

export class IsDirectoryPredicate implements Predicate<FsObject> {
  evaluate(obj: FsObject): boolean {
    return obj instanceof Directory;
  }
}
