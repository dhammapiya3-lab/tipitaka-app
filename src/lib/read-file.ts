/**
 * 읽음 기록 내보내기·가져오기 파일 — 다른 기기·브라우저로 "다 읽은 경" 기록을 옮길 때 쓴다.
 */
import { z } from "zod";
import type { ReadRecord } from "@/store/read";

const fileSchema = z.object({
  app: z.literal("tipitaka-reader"),
  kind: z.literal("read"),
  version: z.literal(1),
  exportedAt: z.string(),
  items: z.record(z.string().min(1), z.string()),
});

/** 내보낼 파일 내용 (JSON 글자) */
export function makeReadFile(items: ReadRecord, now = new Date()): string {
  return JSON.stringify(
    {
      app: "tipitaka-reader",
      kind: "read",
      version: 1,
      exportedAt: now.toISOString(),
      items,
    },
    null,
    2,
  );
}

/** 가져온 파일을 읽는다. 이 앱이 내보낸 읽음 기록 파일이 아니면 이유를 돌려준다. */
export function parseReadFile(
  text: string,
): { items: ReadRecord } | { error: string } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { error: "JSON 파일이 아닙니다." };
  }
  const result = fileSchema.safeParse(json);
  return result.success
    ? { items: result.data.items }
    : { error: "이 앱에서 내보낸 읽음 기록 파일이 아닙니다." };
}

/** 내보낼 파일 이름: 초기불교경전-읽음기록-2026-11-22.json */
export function readFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `초기불교경전-읽음기록-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}
