import { Directory } from "../../mapping/discovery/nodejs/Directory.js";
import { type DiscoveryContext } from "../../mapping/discovery/DiscoveryContext.js";
import { type Expression } from "./Expression.js";

export class DirectoryNameExpression implements Expression<
  DiscoveryContext,
  string
> {
  evaluate(context: DiscoveryContext): string {
    const current = context.current;

    if (!(current instanceof Directory)) {
      throw new Error("Expected Directory.");
    }

    return current.basename;
  }
}
