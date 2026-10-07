import { type FsObject } from "../../mapping/discovery/nodejs/FsObject.js";
import { type Expression } from "./Expression.js";

export class BasenameExpression implements Expression<FsObject, string> {
  evaluate(obj: FsObject): string {
    return obj.basename;
  }
}
