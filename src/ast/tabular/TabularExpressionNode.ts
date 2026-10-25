export type TabularExpressionKind = "table" | "query" | "join" | "discovery";

export interface TabularExpressionProjection {
  readonly kind: "tabularProjection";
  readonly source: TabularExpressionNode;
  readonly alias?: string;
}

export abstract class TabularExpressionNode {
  abstract readonly kind: TabularExpressionKind;

  as(alias: string): TabularExpressionProjection {
    return {
      kind: "tabularProjection",
      source: this,
      alias,
    };
  }
}
