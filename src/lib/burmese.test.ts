import { describe, expect, it } from "vitest";
import { makeBurmeseDict, makeBurmeseDictSorted, segmentBurmese } from "./burmese";

describe("segmentBurmese", () => {
  const dict = makeBurmeseDict(["ကောင်း", "ကောင်းသော", "အမှု", "သော"]);
  it("가장 긴 낱말부터 맞추고, 이으면 원래 글과 같다", () => {
    const text = "ကောင်းသောအမှု။ (abc) ဗ";
    const pieces = segmentBurmese(text, dict);
    expect(pieces.map((p) => p.text).join("")).toBe(text);
    expect(pieces.filter((p) => p.word).map((p) => p.text)).toEqual([
      "ကောင်းသော",
      "အမှု",
    ]);
  });
  it("정렬된 목록으로 만든 사전도 같게 찾는다", () => {
    const list = ["ကောင်း", "ကောင်းသော", "အမှု", "သော"].sort();
    const a = makeBurmeseDictSorted(list);
    for (const w of [...list, "မရှိ", "ကော"]) expect(a.has(w)).toBe(list.includes(w));
    expect(a.maxByFirst.get("က")).toBe(9);
  });
});
