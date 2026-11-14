import { describe, expect, it } from "vitest";
import { findSuttas, findSuttasByNumber, foldName } from "./sutta-number";

const suttas = [
  { id: "dn22", title: "대념처경", name: "Mahāsatipaṭṭhānasutta" },
  { id: "mn10", title: "Satipaṭṭhānasutta", name: "Satipaṭṭhānasutta" },
  { id: "sn56.11", title: "초전법륜경", name: "Dhammacakkappavattanasutta" },
  { id: "sn56.12", title: "여래 경", name: "Tathāgatasutta" },
  { id: "sn45.97-138", title: "강 반복", name: "Gaṅgāpeyyāla" },
  { id: "an1.1-10", title: "형색 품", name: "Rūpādivagga" },
  { id: "dhp1-20", title: "쌍 품", name: "Yamakavagga" },
  { id: "dhp179-196", title: "부처님 품", name: "Buddhavagga" },
  { id: "snp1.1", title: "뱀 경", name: "Uragasutta" },
  { id: "mil1", title: "밀 1", name: "Mil 1" },
  { id: "tha-ap1", title: "부처님 아빠다나", name: "Buddhaapadāna" },
];
const ids = (r: { id: string }[]) => r.map((s) => s.id);

describe("경 번호로 찾기", () => {
  it("여러 적는 법", () => {
    for (const q of [
      "dn22",
      "DN 22",
      "D 22",
      "디가 22",
      "디가 니까야 22",
      "장부 22",
    ])
      expect(ids(findSuttasByNumber(q, suttas))).toEqual(["dn22"]);
    for (const q of [
      "sn56.11",
      "SN 56.11",
      "S 56 11",
      "상윳따 56.11",
      "sn56.11:2.1",
    ])
      expect(ids(findSuttasByNumber(q, suttas))).toEqual(["sn56.11"]);
  });
  it("묶은 번호 안의 번호", () => {
    expect(ids(findSuttasByNumber("법구경 183", suttas))).toEqual([
      "dhp179-196",
    ]);
    expect(ids(findSuttasByNumber("담마파다 5", suttas))).toEqual(["dhp1-20"]);
    expect(ids(findSuttasByNumber("sn 45.100", suttas))).toEqual([
      "sn45.97-138",
    ]);
    expect(ids(findSuttasByNumber("AN 1.5", suttas))).toEqual(["an1.1-10"]);
  });
  it("앞 번호만 주면 그 아래 경들", () => {
    expect(ids(findSuttasByNumber("상윳따 56", suttas))).toEqual([
      "sn56.11",
      "sn56.12",
    ]);
  });
  it("경 번호가 아닌 말", () => {
    expect(findSuttasByNumber("마음챙김", suttas)).toEqual([]);
    expect(findSuttasByNumber("satipatthana", suttas)).toEqual([]);
  });
});

describe("책 이름·제목으로 찾기", () => {
  it("책 이름의 여러 표기", () => {
    for (const q of ["법구경", "담마빠다", "담마파다", "Dhammapada"])
      expect(ids(findSuttas(q, suttas)!.items)).toEqual([
        "dhp1-20",
        "dhp179-196",
      ]);
    for (const q of ["밀린다왕문경", "밀린다빤하", "밀린다팡하", "밀린다판하"])
      expect(ids(findSuttas(q, suttas)!.items)).toEqual(["mil1"]);
    for (const q of ["숫따니빠따", "숫타니파타", "경집"])
      expect(ids(findSuttas(q, suttas)!.items)).toEqual(["snp1.1"]);
  });
  it("경 제목", () => {
    expect(ids(findSuttas("대념처경", suttas)!.items)).toEqual(["dn22"]);
    expect(ids(findSuttas("satipatthana", suttas)!.items)).toEqual([
      "dn22",
      "mn10",
    ]);
    expect(
      ids(findSuttas("염처경", suttas, { mn10: ["염처경(念處經)"] })!.items),
    ).toEqual(["mn10"]);
    expect(ids(findSuttas("초전법륜", suttas)!.items)).toEqual(["sn56.11"]);
  });
  it("표기 접기", () => {
    expect(foldName("밀린다빤하")).toBe(foldName("밀린다팡하"));
    expect(foldName("숫따니빠따")).toBe(foldName("숫타니파타"));
  });
});
