/**
 * 미얀마어 낱말 사전 두 가지 → 사이트 조각  (pnpm build:mywikt)
 *
 * content/mywiktionary.json — 미얀마어 위키낱말사전 (scripts/import-mywiktionary.py, CC BY-SA 4.0)
 * content/mep.json          — 우 호크 세인 『미얀마어-영어-빠알리어 사전』 (scripts/import-mep.py, Pn Daza 스님 MEP Dictionary 앱 자료)
 *   → public/data/mywikt/words.json  두 사전의 낱말 목록 (미얀마어 글 속 낱말 경계 — 가장 긴 낱말부터 맞춘다)
 *   → public/data/mywikt/h<n>.json   낱말 → { w?: [[품사, 미얀마어 뜻풀이, 용례, 영어 뜻], …], m?: [[표제어, 영어 뜻, 빠알리어 뜻, 쪽], …] }
 *   → public/data/mywikt/info.json   두 자료의 날짜
 * MEP 표제어 "ကင်းသည်, ကင်းသော (၁)" 은 쉼표로 나눈 꼴마다, 괄호 속 번호·메모와 빈칸을 뺀 열쇠로 찾게 한다 (글은 그대로).
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { MYWIKT_SHARDS, mywiktHash } from "../src/lib/burmese";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public/data/mywikt");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const BURMESE = /^[က-႟‌‍]+$/u;

const sense = z.tuple([z.string(), z.string(), z.string(), z.string()]);
const raw = z
  .record(z.string(), z.union([z.string(), z.array(sense)]))
  .parse(JSON.parse(readFileSync(path.join(ROOT, "content/mywiktionary.json"), "utf8")));
const wiktDate = z.string().regex(DATE).parse(raw._date);

const mep = z
  .object({
    _date: z.string().regex(DATE),
    rows: z.array(z.tuple([z.string(), z.string(), z.string(), z.number().int()])),
  })
  .parse(JSON.parse(readFileSync(path.join(ROOT, "content/mep.json"), "utf8")));

type Entry = {
  w?: z.infer<typeof sense>[];
  m?: [string, string, string, number][];
};
const shards = Array.from({ length: MYWIKT_SHARDS }, () => ({}) as Record<string, Entry>);
const entry = (word: string) => (shards[mywiktHash(word)]![word] ??= {});

for (const [word, senses] of Object.entries(raw)) {
  if (word === "_date" || typeof senses === "string") continue;
  if (!BURMESE.test(word)) continue; // 미얀마 글자로만 된 표제어
  entry(word).w = senses;
}

let mepKeys = 0;
for (const row of mep.rows) {
  const keys = new Set(
    row[0]
      .split(/[,၊]/)
      .map((form) => form.replace(/\([^)]*\)/g, "").replace(/\s+/g, ""))
      .filter((k) => k.length > 0 && BURMESE.test(k)),
  );
  for (const k of keys) {
    (entry(k).m ??= []).push(row);
    mepKeys++;
  }
}

const words = shards.flatMap((s) => Object.keys(s)).sort();
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
shards.forEach((s, n) => writeFileSync(path.join(OUT, `h${n}.json`), JSON.stringify(s)));
writeFileSync(path.join(OUT, "words.json"), JSON.stringify(words));
writeFileSync(
  path.join(OUT, "info.json"),
  JSON.stringify({ wiktionary: wiktDate, mep: mep._date, words: words.length }),
);
console.log(
  `미얀마어 낱말 사전: 낱말 ${words.length.toLocaleString()}개 (위키낱말사전 ${wiktDate}, MEP 항목 ${mep.rows.length.toLocaleString()}개 → 열쇠 ${mepKeys.toLocaleString()}개) · 조각 ${MYWIKT_SHARDS}개`,
);
