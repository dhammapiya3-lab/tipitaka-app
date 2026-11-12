import { describe, expect, it } from "vitest";
import {
  highlightParts,
  intersectHits,
  matchPrefix,
  searchShardName,
  tokenize,
  type SearchShard,
} from "@/lib/search";

describe("tokenize", () => {
  it("빠알리는 기호를 떼고 소문자로", () => {
    expect(tokenize("Ekāyano ayaṁ, bhikkhave, maggo", "pli")).toEqual([
      "ekayano",
      "ayam",
      "bhikkhave",
      "maggo",
    ]);
  });

  it("한국어는 띄어쓰기 단위, 문장부호는 뗀다", () => {
    expect(tokenize("비구들이여, 이 길은 유일한 길이니", "ko")).toEqual([
      "비구들이여",
      "이",
      "길은",
      "유일한",
      "길이니",
    ]);
  });

  it("한국어 글 속 빠알리 단어도 기호 없이", () => {
    expect(tokenize("희열[喜, pīti]", "ko")).toEqual(["희열", "喜", "piti"]);
  });
});

describe("searchShardName", () => {
  it("한글은 앞 한 글자 코드값, 로마자는 앞 두 글자", () => {
    expect(searchShardName("마음챙김")).toBe("ub9c8");
    expect(searchShardName("satipatthana")).toBe("sa");
  });
});

describe("matchPrefix · intersectHits", () => {
  const shard: SearchShard = {
    마음: { "dn22|kor-a": ["dn22:1.1"] },
    마음챙김을: { "dn22|kor-a": ["dn22:1.2", "dn22:2.1"] },
    말: { "dn22|kor-a": ["dn22:9.9"] },
  };

  it("앞부분이 맞는 단어를 모두 모은다 (조사가 붙어도)", () => {
    const hits = matchPrefix(shard, "마음챙김");
    expect([...(hits.get("dn22|kor-a") ?? [])]).toEqual(["dn22:1.2", "dn22:2.1"]);
  });

  it("여러 단어는 같은 문장에 다 있는 것만", () => {
    const a = new Map([["d|e", new Set(["k1", "k2"])]]);
    const b = new Map([["d|e", new Set(["k2", "k3"])]]);
    expect([...(intersectHits([a, b]).get("d|e") ?? [])]).toEqual(["k2"]);
  });
});

describe("highlightParts", () => {
  it("앞부분이 맞는 단어만 표시한다", () => {
    expect(highlightParts("이 길은 마음챙김을 위한 길", ["마음챙김"], "ko")).toEqual([
      { text: "이 길은 ", hit: false },
      { text: "마음챙김을", hit: true },
      { text: " 위한 길", hit: false },
    ]);
  });

  it("빠알리는 기호 없이 친 글자로도", () => {
    expect(highlightParts("ekāyano ayaṁ", ["ekay"], "pli").filter((p) => p.hit)).toEqual([
      { text: "ekāyano", hit: true },
    ]);
  });
});
