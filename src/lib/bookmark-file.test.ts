import { describe, expect, it } from "vitest";
import { bookmarkFileName, makeBookmarkFile, parseBookmarkFile } from "@/lib/bookmark-file";

const item = {
  suttaId: "dn22",
  key: "dn22:1.2",
  suttaTitle: "대념처경",
  snippet: "이 길은",
  savedAt: "2026-11-04T00:00:00.000Z",
  memo: "메모",
};

describe("책갈피 파일", () => {
  it("내보낸 파일을 다시 읽으면 그대로", () => {
    expect(parseBookmarkFile(makeBookmarkFile([item]))).toEqual({ items: [item] });
  });

  it("다른 파일은 이유와 함께 거절", () => {
    expect(parseBookmarkFile("not json")).toEqual({ error: "JSON 파일이 아닙니다." });
    expect(parseBookmarkFile('{"items":[]}')).toEqual({
      error: "이 앱에서 내보낸 책갈피 파일이 아닙니다.",
    });
  });

  it("파일 이름에 날짜", () => {
    expect(bookmarkFileName(new Date(2026, 10, 4))).toBe("초기불교경전-책갈피-2026-11-04.json");
  });
});
