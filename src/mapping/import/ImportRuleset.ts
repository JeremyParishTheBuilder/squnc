import { Immutable } from "../../infrastructure/Immutable.js";
import { ImportInstruction, type ImportInstructionSpec } from "./ImportInstruction.js";

export interface ImportRulesetSpec {
  readonly name: string;
  readonly description?: string;
  readonly instructions?: ImportInstruction[];
}

export class ImportRuleset extends Immutable {
  readonly name: string;
  readonly description?: string;
  readonly instructions: readonly ImportInstruction[];

  private constructor(spec: ImportRulesetSpec) {
    super();

    this.name = spec.name;
    this.description = spec.description;
    this.instructions = Object.freeze(spec.instructions ?? []);

    this.seal();
  }

  static create(
    spec: Omit<ImportRulesetSpec, "instructions">,
  ): ImportRuleset {
    return new ImportRuleset(spec);
  }

  withInstruction(
    instruction: ImportInstruction | ImportInstructionSpec,
  ): ImportRuleset {
    const importInstruction =
      instruction instanceof ImportInstruction
        ? instruction
        : new ImportInstruction(instruction);

    return this.with({
      instructions: [
        ...this.instructions,
        importInstruction,
      ] as readonly ImportInstruction[],
    } as Partial<this>);
  }

  getInstruction(name: string): ImportInstruction | undefined {
    return this.instructions.find(
      (instruction) => instruction.name === name,
    );
  }

  requireInstruction(name: string): ImportInstruction {
    const instruction = this.getInstruction(name);

    if (!instruction) {
      throw new Error(`Import instruction "${name}" does not exist.`);
    }

    return instruction;
  }

  protected validate(): void {
    if (!this.name.trim()) {
      throw new Error("ImportRuleset requires a name.");
    }
  }
}