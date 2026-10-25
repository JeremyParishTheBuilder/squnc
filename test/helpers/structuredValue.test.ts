import { describe, expect, it } from "vitest";
import { isStructuredContainer, isStructuredValue } from "../../src/mapping/value/StructuredValue.ts";

describe("Helpers::StructuredValues", () => {
  it("isStructuredValue accepts plain nested objects", () => {
    expect(
      isStructuredValue({
        name: "Bob",
        versions: [1, 2, 3],
        metadata: {
          active: true,
        },
      }),
    ).toBe(true);
  });

  it("isStructuredContainer accepts plain nested objects", () => {
    expect(
      isStructuredContainer({
        name: "Bob",
        versions: [1, 2, 3],
        metadata: {
          active: true,
        },
      }),
    ).toBe(true);
  });
});