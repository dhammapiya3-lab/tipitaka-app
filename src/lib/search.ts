/**
 * 경 본문 검색 — 단어 나누기와 조각 이름. 화면을 모르는 순수 함수.
 * 변환 스크립트(검색 색인 만들기)와 검색 화면이 같은 규칙을 써야 찾을 수 있다.
 *
 * 색인은 언어별(pli·ko·en)로 "단어 → { 경|판본 → 문장 번호들 }" 이고, 단어 앞글자별 조각 파일로 나눈다.
 * 검색은 앞부분 일치다: "마음챙김"으로 "마음챙김을"도, "satipatth"로 "satipaṭṭhāna"도 찾는다.
 */
import { foldPali } from "@/lib/pali";
import type { Language } from "@/types";

const WORD = /[\p{L}\p{N}]+/gu;

/** 검색용 단어로 나눈다. 빠알리·영어는 소문자 + 빠알리 기호를 뗀다(자판으로 친 글자와 같게). */
export function tokenize(text: string, language: Language): string[] {
  const words = text.normalize("NFC").toLowerCase().match(WORD) ?? [];
  const tokens = words.map((w) => (language === "ko" ? foldLatin(w) : foldPali(w)));
  return [...new Set(tokens.filter((t) => t.length > 0))];
}

/** 한국어 글 속의 로마자(빠알리 단어 등)도 기호를 떼어 같게 찾는다 */
function foldLatin(word: string): string {
  return /^[\p{Script=Latin}\d]+$/u.test(word) ? foldPali(word) : word;
}

/** 한글은 앞 한 글자, 로마자는 앞 두 글자로 조각을 나눈다 */
export function searchShardPrefix(token: string): string {
  const chars = [...token];
  return /\p{Script=Hangul}/u.test(chars[0] ?? "") ? chars[0] : chars.slice(0, 2).join("");
}

/** 조각 파일 이름 — 로마자·숫자는 그대로, 그 밖(한글)은 u+코드값 */
export function searchShardName(token: string): string {
  return (
    [...searchShardPrefix(token)]
      .map((ch) => (/[a-z0-9]/.test(ch) ? ch : `u${ch.codePointAt(0)?.toString(16)}`))
      .join("") || "_"
  );
}

/** 이 길이보다 짧으면 찾지 않는다 (한 글자 로마자는 조각이 너무 크다) */
export function minQueryLength(token: string): number {
  return /\p{Script=Hangul}/u.test(token) ? 1 : 2;
}

/** 색인 조각 하나: 단어 → { "경|판본" → 문장 번호들 } */
export type SearchShard = Record<string, Record<string, string[]>>;

/** 조각에서 앞부분이 맞는 단어들의 결과를 모은다: "경|판본" → 문장 번호 집합 */
export function matchPrefix(shard: SearchShard, query: string): Map<string, Set<string>> {
  const hits = new Map<string, Set<string>>();
  for (const [token, docs] of Object.entries(shard)) {
    if (!token.startsWith(query)) continue;
    for (const [doc, keys] of Object.entries(docs)) {
      const set = hits.get(doc) ?? new Set<string>();
      for (const key of keys) set.add(key);
      hits.set(doc, set);
    }
  }
  return hits;
}

/** 여러 단어로 찾을 때: 모든 단어가 같은 문장에 있는 것만 남긴다 */
export function intersectHits(all: Map<string, Set<string>>[]): Map<string, Set<string>> {
  if (all.length === 0) return new Map();
  const [first, ...rest] = all;
  const out = new Map<string, Set<string>>();
  for (const [doc, keys] of first) {
    const kept = [...keys].filter((k) => rest.every((m) => m.get(doc)?.has(k)));
    if (kept.length) out.set(doc, new Set(kept));
  }
  return out;
}

/** 결과 문장에서 찾은 단어를 표시하기 위해, 글자를 "맞음/안 맞음" 조각으로 나눈다 */
export function highlightParts(
  text: string,
  queryTokens: string[],
  language: Language,
): { text: string; hit: boolean }[] {
  const out: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(WORD)) {
    const start = m.index ?? 0;
    const token = tokenize(m[0], language)[0] ?? "";
    if (!queryTokens.some((q) => token.startsWith(q))) continue;
    if (start > last) out.push({ text: text.slice(last, start), hit: false });
    out.push({ text: m[0], hit: true });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out;
}
