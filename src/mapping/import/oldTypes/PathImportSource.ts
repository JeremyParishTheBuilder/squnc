import { pathToPascalCase } from "../../../utils/format.js";
import type { ImportContext } from "../ImportContext.js";
import type { ImportSource } from "./ImportSource.js";
import { PropertyPath } from "./PropertyPath.js";

export class PathImportSource implements ImportSource {
  public readonly propertyPath: PropertyPath;

  constructor(public readonly path: string) {
    this.propertyPath = PropertyPath.parse(path);
  }

  navigate(context: ImportContext): ImportContext[] {
    return [context.withSource(this.propertyPath.resolve(context.source))];
  }

  consumedKeys(): readonly string[] {
    return this.propertyPath.parts.length > 0
      ? [this.propertyPath.parts[0]]
      : [];
  }

  columnNamespace(): string | undefined {
    return pathToPascalCase(this.propertyPath.parts);
  }
}
