import { describe, expect, it } from "vitest";
import { makeReadFile, parseReadFile, readFileName } from "@/lib/read-file";
import { makeBookmarkFile } from "@/lib/bookmark-file";

const items = {
  dn1: "2026-11-22T00:00:00.000Z",
  "sn56.11": "2026-11-21T00:00:00.000Z",
};

describe("읽음 기록 파일", () => {
  it("내보낸 파일을 다시 읽으면 그대로", () => {
    expect(parseReadFile(makeReadFile(items))).toEqual({ items });
  });

  it("다른 파일은 이유와 함께 거절 (책갈피 파일도)", () => {
    expect(parseReadFile("not json")).toEqual({
      error: "JSON 파일이 아닙니다.",
    });
    expect(parseReadFile(makeBookmarkFile([]))).toEqual({
      error: "이 앱에서 내보낸 읽음 기록 파일이 아닙니다.",
    });
  });

  it("파일 이름에 날짜", () => {
    expect(readFileName(new Date(2026, 10, 22))).toBe(
      "초기불교경전-읽음기록-2026-11-22.json",
    );
  });
});
