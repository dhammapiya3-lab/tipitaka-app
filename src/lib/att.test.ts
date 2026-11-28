import { describe, expect, it } from "vitest";
import { attKey } from "@/lib/att";

describe("attKey", () => {
  it("~ti 앞에서 바뀐 끝 모양을 맞춘다", () => {
    expect(attKey("evaṃ")).toBe(attKey("eva"));
    expect(attKey("hotī")).toBe(attKey("hoti"));
    expect(attKey("“Aniccā”")).toBe(attKey("anicca"));
    expect(attKey("satipatthana")).toBe(attKey("satipaṭṭhāna"));
  });
});
