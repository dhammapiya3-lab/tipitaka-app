/**
 * 책갈피 내보내기·가져오기 파일 — 다른 기기·브라우저로 책갈피와 메모를 옮길 때 쓴다.
 */
import { z } from "zod";
import type { Bookmark } from "@/store/bookmarks";

const bookmarkSchema: z.ZodType<Bookmark> = z.object({
  suttaId: z.string().min(1),
  key: z.string().min(1),
  suttaTitle: z.string(),
  snippet: z.string(),
  savedAt: z.string(),
  memo: z.string().optional(),
});

const fileSchema = z.object({
  app: z.literal("tipitaka-reader"),
  version: z.literal(1),
  exportedAt: z.string(),
  items: z.array(bookmarkSchema),
});

/** 내보낼 파일 내용 (JSON 글자) */
export function makeBookmarkFile(items: Bookmark[], now = new Date()): string {
  return JSON.stringify(
    { app: "tipitaka-reader", version: 1, exportedAt: now.toISOString(), items },
    null,
    2,
  );
}

/** 가져온 파일을 읽는다. 이 앱이 내보낸 파일이 아니면 이유를 돌려준다. */
export function parseBookmarkFile(text: string): { items: Bookmark[] } | { error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { error: "JSON 파일이 아닙니다." };
  }
  const result = fileSchema.safeParse(json);
  return result.success
    ? { items: result.data.items }
    : { error: "이 앱에서 내보낸 책갈피 파일이 아닙니다." };
}

/** 내보낼 파일 이름: 초기불교경전-책갈피-2026-11-04.json */
export function bookmarkFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `초기불교경전-책갈피-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}
