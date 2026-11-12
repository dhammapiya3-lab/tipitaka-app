import { describe, expect, it } from "vitest";
import {
  cleanLemma,
  foldPali,
  normalizeWord,
  shardOf,
  slugLetters,
  splitWords,
} from "@/lib/pali";

describe("normalizeWord", () => {
  it("ṁ 를 ṃ 로, 대문자·문장부호를 정리한다", () => {
    expect(normalizeWord("Evaṁ")).toBe("evaṃ");
    expect(normalizeWord("sutaṁ—")).toBe("sutaṃ");
    expect(normalizeWord("‘Bhikkhavo’ti.")).toBe("bhikkhavoti");
  });
});

describe("foldPali", () => {
  it("빠알리 글자를 자판 글자로", () => {
    expect(foldPali("Satipaṭṭhāna")).toBe("satipatthana");
    expect(foldPali("saṁvaro")).toBe("samvaro");
    expect(foldPali("ñāṇa")).toBe("nana");
    expect(foldPali("satipatthana")).toBe("satipatthana");
  });
});

describe("splitWords", () => {
  it("단어와 사이 글자를 번갈아 나눈다", () => {
    expect(splitWords("Evaṁ me sutaṁ—")).toEqual([
      { text: "Evaṁ", word: true },
      { text: " ", word: false },
      { text: "me", word: true },
      { text: " ", word: false },
      { text: "sutaṁ", word: true },
      { text: "—", word: false },
    ]);
  });
});

describe("shardOf", () => {
  it("앞 두 글자, 나눈 앞부분이면 한 글자씩 늘린다", () => {
    expect(shardOf("dhamma", new Set())).toBe("dh");
    expect(shardOf("saṃsāra", new Set(["sa"]))).toBe("sam_");
    expect(shardOf("paṭipadā", new Set(["pa", "paṭ"]))).toBe("pat_i");
    expect(shardOf("ā", new Set())).toBe("a_");
  });

  it("나눈 앞부분보다 짧은 단어는 단어 전체가 조각 이름", () => {
    expect(shardOf("pa", new Set(["pa"]))).toBe("pa");
  });

  it("빠알리 글자 이름이 서로 겹치지 않는다", () => {
    const letters = [..."aāiīuūmṃnṅñṇtṭdḍlḷj"];
    const slugs = letters.map((l) => slugLetters(l + "a"));
    expect(new Set(slugs).size).toBe(letters.length);
  });
});

describe("cleanLemma", () => {
  it("DPD 표제어 번호를 뗀다", () => {
    expect(cleanLemma("dhamma 1.01")).toBe("dhamma");
    expect(cleanLemma("sati")).toBe("sati");
  });
});
