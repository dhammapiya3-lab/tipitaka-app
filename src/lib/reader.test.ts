import { describe, expect, it } from "vitest";
import { sentenceCopyText, wordsOf } from "@/lib/reader";
import type { Edition } from "@/types";

const edition = (id: string, language: Edition["language"], allowCopy = true): Edition => ({
  id,
  label: id,
  badge: id,
  language,
  translator: null,
  license: null,
  allowCopy,
});
const text = (t: string) => ({ key: "dn22:1.2", parts: [{ type: "text" as const, text: t }] });

describe("sentenceCopyText", () => {
  const row = {
    key: "dn22:1.2",
    cells: { pli: text("Ekāyano ayaṁ"), ko: text("이 길은 유일한 길"), no: text("복사 금지") },
  };

  it("원문, 번역(판본 이름), 주소 순서", () => {
    const { text: out } = sentenceCopyText(
      row,
      [edition("pli", "pli"), edition("ko", "ko")],
      "DN 22:1.2 대념처경",
      "https://x/sutta/dn22/#dn22:1.2",
    );
    expect(out).toBe(
      "DN 22:1.2 대념처경\nEkāyano ayaṁ\n이 길은 유일한 길  — ko\nhttps://x/sutta/dn22/#dn22:1.2",
    );
  });

  it("복사를 막은 판본은 빼고 알려 준다", () => {
    const { text: out, skipped } = sentenceCopyText(
      row,
      [edition("pli", "pli"), edition("no", "ko", false)],
      "h",
      "u",
    );
    expect(out).toBe("h\nEkāyano ayaṁ\nu");
    expect(skipped).toEqual(["no"]);
  });
});

describe("wordsOf", () => {
  it("각주 번호는 빼고 단어만", () => {
    expect(
      wordsOf([
        { type: "text", text: "Evaṁ me " },
        { type: "note", mark: "1" },
        { type: "bold", text: "sutaṁ—" },
      ]),
    ).toEqual(["Evaṁ", "me", "sutaṁ"]);
  });
});
