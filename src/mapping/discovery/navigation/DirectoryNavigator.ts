import { Directory } from "../nodejs/Directory.js";
import { type DiscoveryNavigator } from "./DiscoveryNavigator.js";
import type { DiscoveryValue } from "../../value/DiscoveryValue.js";
import { type FsObject } from "../nodejs/FsObject.js";
import type { DiscoveryIdentityPart } from "../DiscoveryIdentity.js";

export class DirectoryNavigator implements DiscoveryNavigator<
  Directory,
  FsObject
> {
  accepts(current: DiscoveryValue): current is Directory {
    return current instanceof Directory;
  }

  next(directory: Directory): readonly FsObject[] {
    return directory.contents ?? [];
  }

  identityParts(current: Directory, next: FsObject): readonly DiscoveryIdentityPart[] {
    return [next.basename];
  }
}
