/**
 * 이미 만든 뜻풀이 사전 조각(앞글자로 나눈 것)을 해시로 고르게 다시 나눈다 — 호스팅 파일 수 한도(2만 개) 때문.
 *
 *   pnpm rehash:dict mm 160      (사전 id, 조각 수)
 *
 * 화면(lib/content.ts 의 fetchPlain)은 index.json 의 split.<id> 가 "#조각수" 이면 해시 조각(h<n>.json)을 읽는다.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dictionaryIndexSchema } from "../src/lib/schemas";

const [id, countArg] = process.argv.slice(2);
const count = Number(countArg);
if (!id || !count) {
  console.error("사용법: pnpm rehash:dict <사전 id> <조각 수>");
  process.exit(1);
}
const DICT = path.join(process.cwd(), "public/data/dict");
const dir = path.join(DICT, id);
const all: Record<string, unknown> = {};
for (const f of readdirSync(dir)) Object.assign(all, JSON.parse(readFileSync(path.join(dir, f), "utf8")) as object);
const hash = (word: string) => {
  let h = 0;
  for (const ch of word) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % count;
};
const shards: Record<string, unknown>[] = Array.from({ length: count }, () => ({}));
for (const [k, v] of Object.entries(all)) shards[hash(k)][k] = v;
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
shards.forEach((s, i) => writeFileSync(path.join(dir, `h${i}.json`), JSON.stringify(s)));
const indexPath = path.join(DICT, "index.json");
const index = JSON.parse(readFileSync(indexPath, "utf8")) as { split: Record<string, string[]> };
index.split[id] = [`#${count}`];
writeFileSync(indexPath, JSON.stringify(dictionaryIndexSchema.parse(index)));
console.log(`${id}: 낱말 ${Object.keys(all).length.toLocaleString()}개 → 해시 조각 ${count}개`);
