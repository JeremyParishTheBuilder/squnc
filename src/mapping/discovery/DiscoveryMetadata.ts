export interface DiscoveryMetadata {
  readonly source?: SourceMetadata;
  readonly position?: StructuralPosition;
  readonly processing?: ProcessingMetadata;
}

export interface SourceMetadata {
  readonly kind: "file" | "directory" | "memory" | "unknown";
  readonly basename?: string;
  readonly fullPath?: string;
}

export type StructuralPosition =
  | {
      readonly kind: "property";
      readonly key: string;
    }
  | {
      readonly kind: "element";
      readonly index: number;
    };

export interface ProcessingMetadata {
  readonly status: "success" | "failed";
  readonly operation?: "read" | "decode";
  readonly decoder?: string;
  readonly message?: string;
}
