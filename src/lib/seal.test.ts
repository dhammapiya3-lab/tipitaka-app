import { describe, expect, it } from "vitest";
import { seal, unseal } from "@/lib/seal";

describe("seal · unseal", () => {
  const segments = [{ key: "dhp1:1", parts: [{ type: "text", text: "마음이 모든 것의 앞에 간다" }] }];

  it("감싼 글은 원래 글자가 보이지 않고, 풀면 그대로 돌아온다", () => {
    const sealed = seal(segments, "dhp1-20", "kor-beophyun");
    expect(sealed).not.toContain("마음");
    expect(unseal(sealed, "dhp1-20", "kor-beophyun")).toEqual(segments);
  });

  it("경이나 판본이 다르면 같은 글도 다르게 감싼다", () => {
    expect(seal(segments, "dhp1-20", "kor-beophyun")).not.toBe(seal(segments, "dhp21-32", "kor-beophyun"));
  });
});
