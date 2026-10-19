import type { Statement } from "../../statements/index.js";

export interface ImportInstructionSpec {
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
  readonly statements: readonly Statement[];
}

export class ImportInstruction {
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
  readonly statements: readonly Statement[];

  public constructor(spec: ImportInstructionSpec) {
    this.name = spec.name;
    this.description = spec.description;
    this.category = spec.category;
    this.statements = Object.freeze([...spec.statements]);

    this.validate();
  }

  protected validate(): void {
    if (!this.name.trim()) {
      throw new Error("ImportInstruction requires a name.");
    }

    if (this.statements.length === 0) {
      throw new Error("ImportInstruction requires at least one statement.");
    }
  }
}
