/**
 * 경 읽기 화면의 문장 다루기 — 복사할 글 만들기, 키보드로 고를 단어 목록. 화면을 모르는 순수 함수.
 */
import { splitWords } from "@/lib/pali";
import { plainText, type AlignedRow } from "@/lib/segments";
import type { Edition, InlinePart } from "@/types";

/**
 * "원문 + 번역 함께 복사"할 글.
 * 보이는 판본 순서대로 한 줄씩, 복사를 막은 판본(법현 스님)은 빼고 이름을 skipped 로 돌려준다.
 */
export function sentenceCopyText(
  row: AlignedRow,
  shown: Edition[],
  heading: string,
  url: string,
): { text: string; skipped: string[] } {
  const lines: string[] = [heading];
  const skipped: string[] = [];
  for (const edition of shown) {
    const segment = row.cells[edition.id];
    if (!segment) continue;
    if (!edition.allowCopy) {
      skipped.push(edition.label);
      continue;
    }
    const text = plainText(segment.parts);
    if (!text) continue;
    lines.push(edition.language === "pli" ? text : `${text}  — ${edition.label}`);
  }
  lines.push(url);
  return { text: lines.join("\n"), skipped };
}

/** 키보드로 고를 수 있는 단어들 (문장 안 순서대로) */
export function wordsOf(parts: InlinePart[]): string[] {
  return parts.flatMap((p) =>
    p.type === "note" ? [] : splitWords(p.text).flatMap((w) => (w.word ? [w.text] : [])),
  );
}
