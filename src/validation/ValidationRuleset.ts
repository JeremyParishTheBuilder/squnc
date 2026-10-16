import { Immutable } from "../infrastructure/Immutable.js";
import { ValidationRule, ValidationRuleSpec } from "./ValidationRule.js";

export interface ValidationRulesetSpec {
  readonly name: string;
  readonly description?: string;
  readonly rules?: ValidationRule[];
}

export class ValidationRuleset extends Immutable {
  readonly name: string;
  readonly description?: string;
  readonly rules: readonly ValidationRule[];

  private constructor(spec: ValidationRulesetSpec) {
    super();

    this.name = spec.name;
    this.description = spec.description;
    this.rules = Object.freeze(spec.rules ?? []);

    this.seal();
  }

  static create(spec: Omit<ValidationRulesetSpec, "rules">): ValidationRuleset {
    return new ValidationRuleset(spec);
  }

  withRule(rule: ValidationRule | ValidationRuleSpec): ValidationRuleset {
    const validationRule =
      rule instanceof ValidationRule ? rule : new ValidationRule(rule);

    return this.with({
      rules: [...this.rules, validationRule] as readonly ValidationRule[],
    } as Partial<this>);
  }

  getRule(name: string): ValidationRule | undefined {
    return this.rules.find((rule) => rule.name === name);
  }

  requireRule(name: string): ValidationRule {
    const rule = this.getRule(name);

    if (!rule) {
      throw new Error(`Validation rule "${name}" does not exist.`);
    }

    return rule;
  }

  protected validate(): void {
    if (!this.name.trim()) {
      throw new Error("ValidationRuleset requires a name.");
    }
  }
}
