import { File } from "../../mapping/discovery/nodejs/File.js";
import { type FsObject } from "../../mapping/discovery/nodejs/FsObject.js";
import { type Predicate } from "./Predicate.js";

export class IsFilePredicate implements Predicate<FsObject> {
  evaluate(obj: FsObject): boolean {
    return obj instanceof File;
  }
}
