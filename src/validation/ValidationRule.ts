import type { ConstraintStatement } from "../statements/Statement.js";

export interface ValidationRuleSpec {
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
  readonly statements: readonly ConstraintStatement[];
}

export class ValidationRule {
  readonly name: string;
  readonly description?: string;
  readonly category?: string;
  readonly statements: readonly ConstraintStatement[];

  public constructor(spec: ValidationRuleSpec) {
    this.name = spec.name;
    this.description = spec.description;
    this.category = spec.category;
    this.statements = Object.freeze([...spec.statements]);

    this.validate();
  }

  protected validate(): void {
    if (!this.name.trim()) {
      throw new Error("ValidationRule requires a name.");
    }

    if (this.statements.length === 0) {
      throw new Error("ValidationRule requires at least one statement.");
    }
  }
}
