import type { SqlType } from "../../types/SqlType.js";
import type { PropertyResolver } from "./PropertyResolver.js";

export class StructuredObjectScope implements PropertyResolver {
  constructor(
    public readonly shape: StructuredObjectShape,
  ) {}

  public resolveProperty(reference: string): void {
    if (this.shape.properties[reference] === undefined) {
      throw new Error(`Unknown property: ${reference}`);
    }
  }
}

export type StructuredPropertyType =
  | { readonly kind: "scalar"; readonly sqlType: SqlType }
  | { readonly kind: "object" }
  | { readonly kind: "array" }
  | { readonly kind: "map" }
  | { readonly kind: "structured-value" };

export interface StructuredPropertyShape {
  readonly valueType: StructuredPropertyType;
  readonly nullable: boolean;
}

export interface StructuredObjectShape {
  readonly properties: Readonly<
    Record<string, StructuredPropertyShape>
  >;
}
