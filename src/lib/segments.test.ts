import { describe, expect, it } from "vitest";
import {
  alignEditions,
  compareSegmentKeys,
  isHeadingKey,
  isTitleKey,
  noteMarks,
  parseInline,
  pickEditions,
  rowKind,
  splitNotes,
  unitOf,
  toggleEdition,
  toSuttaId,
} from "@/lib/segments";

describe("isTitleKey · isHeadingKey", () => {
  it("0번 줄은 경 이름, .0 으로 끝나면 단락 제목", () => {
    expect(isTitleKey("dn22:0.2")).toBe(true);
    expect(isHeadingKey("dn22:0.2")).toBe(false);
    expect(isHeadingKey("dn22:3.0")).toBe(true);
    expect(isHeadingKey("dn1:1.11.0")).toBe(true);
    expect(isHeadingKey("dn22:1.10")).toBe(false);
  });
});

describe("rowKind · unitOf", () => {
  it("경 이름 줄은 숨기고 단락 제목은 제목으로", () => {
    expect(rowKind("dn22:0.2", "dn22")).toBe("hidden");
    expect(rowKind("dn22:3.0", "dn22")).toBe("heading");
    expect(rowKind("dn22:1.2", "dn22")).toBe("text");
  });

  it("법구경: 품 이름은 숨기고 게송 일화 제목은 제목으로", () => {
    expect(unitOf("dhp5:1", "dhp1-20")).toBe("dhp5");
    expect(unitOf("dn22:1.1", "dn22")).toBeNull();
    expect(rowKind("dhp1:0.3", "dhp1-20")).toBe("hidden");
    expect(rowKind("dhp1:0.4", "dhp1-20")).toBe("heading");
    expect(rowKind("dhp1:1", "dhp1-20")).toBe("text");
  });
});

describe("pickEditions", () => {
  const ed = (id: string) => ({ id, language: id.slice(0, id.indexOf("-")) === "kor" ? "ko" : id.startsWith("pli") ? "pli" : "en" });
  const dn22 = ["pli-ms", "kor-a", "kor-b", "en-s"].map(ed);
  const dn1 = ["pli-ms", "en-s"].map(ed);
  const dhp = ["pli-ms", "pli-pts", "kor-m", "en-s"].map(ed);

  it("저장된 선택 중 이 경에 있는 판본을 available 순서로", () => {
    expect(pickEditions(dn22, ["kor-b", "pli-ms"])).toEqual(["pli-ms", "kor-b"]);
  });

  it("고른 번역이 이 경에 없으면 첫 번역을 더한다", () => {
    expect(pickEditions(dn1, ["pli-ms", "kor-a"])).toEqual(["pli-ms", "en-s"]);
  });

  it("두 번째 빠알리 판본(PTS)은 번역으로 치지 않는다", () => {
    expect(pickEditions(dhp, ["pli-ms", "kor-a"])).toEqual(["pli-ms", "kor-m"]);
  });
});

describe("toggleEdition", () => {
  const dn1 = ["pli-ms", "en-s"];

  it("이 경에 없는 판본 선택은 남겨 둔다", () => {
    expect(toggleEdition(dn1, ["pli-ms", "kor-a"], ["pli-ms", "en-s"], "pli-ms")).toEqual([
      "kor-a",
      "en-s",
    ]);
  });

  it("마지막 하나는 끌 수 없다", () => {
    expect(toggleEdition(dn1, ["en-s"], ["en-s"], "en-s")).toEqual(["en-s"]);
  });
});

describe("toSuttaId", () => {
  it("원래 앱 번호의 첫 점만 뺀다", () => {
    expect(toSuttaId("dn.22")).toBe("dn22");
    expect(toSuttaId("sn.1.1")).toBe("sn1.1");
    expect(toSuttaId("an.1.1-10")).toBe("an1.1-10");
  });
});

describe("compareSegmentKeys", () => {
  it("숫자 크기대로 정렬한다 (1.9 < 1.10)", () => {
    const keys = ["dn22:1.10", "dn22:1.9", "dn22:0.2", "dn22:1.1.1", "dn22:1.1"];
    expect([...keys].sort(compareSegmentKeys)).toEqual([
      "dn22:0.2",
      "dn22:1.1",
      "dn22:1.1.1",
      "dn22:1.9",
      "dn22:1.10",
    ]);
  });

  it("법구경 게송 번호(콜론 앞)도 숫자 크기대로", () => {
    expect(["dhp10:1", "dhp2:2", "dhp2:1"].sort(compareSegmentKeys)).toEqual([
      "dhp2:1",
      "dhp2:2",
      "dhp10:1",
    ]);
  });
});

describe("parseInline", () => {
  it("끝 공백을 지우고 글자만 남긴다", () => {
    expect(parseInline("Dīgha Nikāya 22 ")).toEqual([
      { type: "text", text: "Dīgha Nikāya 22" },
    ]);
  });

  it("깨진 닫는 표시(<\\b>)도 굵게를 끝낸다", () => {
    expect(parseInline("앞 <b>굵게<\x08> 뒤")).toEqual([
      { type: "text", text: "앞 " },
      { type: "bold", text: "굵게" },
      { type: "text", text: " 뒤" },
    ]);
  });

  it("각주 번호를 각주 표시로 바꾼다", () => {
    expect(parseInline("마음챙김**42)** 확립")).toEqual([
      { type: "text", text: "마음챙김" },
      { type: "note", mark: "42" },
      { type: "text", text: " 확립" },
    ]);
    expect(noteMarks(parseInline("가**1)**나**1-2)**"))).toEqual(["1", "1-2"]);
  });

  it("모르는 꺾쇠 글자는 그대로 둔다", () => {
    expect(parseInline("<자료실>에서 <script>")).toEqual([
      { type: "text", text: "<자료실>에서 <script>" },
    ]);
  });

  it("기울임 표시를 바꾼다", () => {
    expect(parseInline("the <em>jhānas</em>")).toEqual([
      { type: "text", text: "the " },
      { type: "em", text: "jhānas" },
    ]);
  });
});

describe("splitNotes", () => {
  it("한 칸에 붙은 각주 여러 개를 나눈다", () => {
    expect(splitNotes("**42)**  첫째 설명 **43)** 둘째")).toEqual({
      notes: [
        { mark: "42", text: "첫째 설명" },
        { mark: "43", text: "둘째" },
      ],
      leftover: "",
    });
  });

  it("괄호 없는 번호(**17**)도 각주 번호로 읽는다", () => {
    expect(splitNotes("**16** 앞 설명 **17** 불행한 상태").notes).toEqual([
      { mark: "16", text: "앞 설명" },
      { mark: "17", text: "불행한 상태" },
    ]);
  });

  it("번호 없이 시작하는 글자는 leftover 로 돌려준다", () => {
    expect(splitNotes("번호 없음 **1)** 설명").leftover).toBe("번호 없음");
  });
});

describe("alignEditions", () => {
  const seg = (key: string, text: string) => ({
    key,
    parts: [{ type: "text" as const, text }],
  });

  it("판본에 없는 문장은 그 칸만 비운다", () => {
    const rows = alignEditions({
      pli: [seg("dn22:1.1", "a"), seg("dn22:1.2", "b")],
      ko: [seg("dn22:1.1", "가")],
    });
    expect(rows.map((r) => r.key)).toEqual(["dn22:1.1", "dn22:1.2"]);
    expect(Object.keys(rows[1].cells)).toEqual(["pli"]);
  });

  it("번호 순서대로 줄을 세운다", () => {
    const rows = alignEditions({
      ko: [seg("dn22:1.10", "x")],
      pli: [seg("dn22:1.9", "y")],
    });
    expect(rows.map((r) => r.key)).toEqual(["dn22:1.9", "dn22:1.10"]);
  });
});
