import { describe, expect, it } from "vitest";
import { segmentBurmese } from "./burmese";

describe("segmentBurmese", () => {
  const words = new Set(["ကောင်း", "ကောင်းသော", "အမှု", "သော"]);
  it("가장 긴 낱말부터 맞추고, 이으면 원래 글과 같다", () => {
    const text = "ကောင်းသောအမှု။ (abc) ဗ";
    const pieces = segmentBurmese(text, words, 9);
    expect(pieces.map((p) => p.text).join("")).toBe(text);
    expect(pieces.filter((p) => p.word).map((p) => p.text)).toEqual([
      "ကောင်းသော",
      "အမှု",
    ]);
  });
});
