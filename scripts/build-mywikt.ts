/**
 * 미얀마어 위키낱말사전 → 사이트 조각  (pnpm build:mywikt)
 *
 * content/mywiktionary.json (scripts/import-mywiktionary.py 가 덤프에서 뽑은 것)
 *   → public/data/mywikt/words.json  낱말 목록 (미얀마어 글 속 낱말 경계를 찾을 때 — 가장 긴 낱말부터 맞춘다)
 *   → public/data/mywikt/h<n>.json   낱말 → [[품사, 미얀마어 뜻풀이, 용례, 영어 뜻], …] (해시로 나눈 조각)
 *   → public/data/mywikt/info.json   덤프 날짜
 * 사전 글: CC BY-SA 4.0 (Wikimedia, my.wiktionary.org)
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { MYWIKT_SHARDS, mywiktHash } from "../src/lib/burmese";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public/data/mywikt");
const sense = z.tuple([z.string(), z.string(), z.string(), z.string()]);
const raw = z
  .record(z.string(), z.union([z.string(), z.array(sense)]))
  .parse(JSON.parse(readFileSync(path.join(ROOT, "content/mywiktionary.json"), "utf8")));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(raw._date);

const shards = Array.from({ length: MYWIKT_SHARDS }, () => ({}) as Record<string, z.infer<typeof sense>[]>);
const words: string[] = [];
for (const [word, senses] of Object.entries(raw)) {
  if (word === "_date" || typeof senses === "string") continue;
  // 미얀마 글자로만 된 표제어 (낱말 경계 찾기에 쓴다)
  if (!/^[က-႟‌‍]+$/u.test(word)) continue;
  words.push(word);
  shards[mywiktHash(word)]![word] = senses;
}
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
shards.forEach((s, n) => writeFileSync(path.join(OUT, `h${n}.json`), JSON.stringify(s)));
writeFileSync(path.join(OUT, "words.json"), JSON.stringify(words.sort()));
writeFileSync(path.join(OUT, "info.json"), JSON.stringify({ date, words: words.length }));
console.log(`미얀마어 위키낱말사전: 낱말 ${words.length.toLocaleString()}개 · 조각 ${MYWIKT_SHARDS}개 · 덤프 ${date}`);
