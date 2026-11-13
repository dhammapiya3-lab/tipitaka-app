/**
 * 따로 받은 사전을 조각 사전으로 — DPD 누리집(docs.dpdict.net/other_dicts)에서 배포하는 사전들.
 *
 *   PEU_DIR=압축을 푼 폴더 pnpm build:peu                       Pali English Ultimate (StarDict: peu.ifo · .idx · .dict.dz · .syn.dz)
 *   CONE_TAB=cone.txt pnpm build:peu -- cone                       Margaret Cone, A Dictionary of Pāli (MDict 를 pyglossary 로 Tabfile 로 바꾼 것)
 *       (pyglossary cone-mdict.mdx cone.txt --read-format=OctopusMdict --write-format=Tabfile)
 *
 * - 『빠알리-미얀마 아비단(Pāḷi Myanmar Abhidhān, 23권)』의 영어 번역본 (사람 번역 약 80%, 나머지 기계 번역).
 *   Bodhirasa 가 StarDict 로 만든 것 (2024). 출처: https://pm12e.pali.tools/ · Tipitaka Pali Projector
 * - 다른 사전처럼 "정리된 표제어 → 뜻풀이 목록" 조각으로 나눈다. 호스팅 파일 수 한도(2만 개) 때문에 조각을 크게(약 600KB) 잡는다.
 * - public/data/dict/index.json 에 이 사전과 조각 나눔(split.peu)을 더한다 (사전 전체를 다시 만들지 않아도 된다).
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { dictionaryIndexSchema } from "../src/lib/schemas";
import { normalizeWord, shardOf, shardPrefix } from "../src/lib/pali";

const DIR = process.env.PEU_DIR ?? path.join(process.cwd(), "content", "peu");
const OUT = path.join(process.cwd(), "public/data/dict");
const SHARD_LIMIT = 600_000;

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
};
/** HTML 뜻풀이를 줄바꿈 있는 글자로 (다른 사전과 같은 규칙) */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|li|ul)>/gi, "\n")
    .replace(/<\/?[a-z][a-z0-9]*(\s[^>]*)?>/gi, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const MODE = process.argv.slice(2).includes("cone") ? "cone" : "peu";
const entries = new Map<string, string[]>();
const add = (word: string, text: string) => {
  const key = normalizeWord(word);
  if (!key || !text) return;
  const list = entries.get(key) ?? [];
  if (!list.includes(text)) list.push(text);
  entries.set(key, list);
};
let info: Record<string, string> = {};
if (MODE === "cone") readCone();
else readPeu();

/** Margaret Cone — Tabfile 한 줄: "1abala|abala<탭>HTML(\n 은 글자 \ n)" */
function readCone() {
  const file = process.env.CONE_TAB ?? path.join(process.cwd(), "content", "cone", "cone.txt");
  let n = 0;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line || line.startsWith("##")) continue;
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const heads = line.slice(0, tab).split("|");
    let html = line.slice(tab + 1).replace(/\\n/g, "\n").replace(/\\t/g, " ");
    // 뜻풀이 부분만 (머리말·스타일 빼고), 위 첨자 동음이의 번호는 ¹ 처럼
    const body = html.match(/<div id="gd3definition"[\s\S]*?(?=<\/body>|$)/)?.[0] ?? html;
    html = body
      .replace(/<span class="lemsuper">(\d+)<\/span>/g, "$1 ")
      .replace(/<span class="super">(\d+)<\/span>/g, "$1")
      .replace(/<span class="subscript">(\d+)<\/span>/g, ".$1")
      .replace(/<div id="crossrefs">[\s\S]*$/, "");
    const text = htmlToText(html).replace(/\n\s*\n/g, "\n");
    // 표제어: 번호 뗀 낱말들 (1abala → abala, √abb → abb)
    for (const h of heads) add(h.replace(/^\d+/, "").replace(/^√/, ""), text);
    n++;
  }
  info = { website: "https://gandhari.org/dop", date: "" };
  console.log(`Cone: 항목 ${n.toLocaleString()}개`);
}

function readPeu() {
const ifo = readFileSync(path.join(DIR, "peu.ifo"), "utf8");
info = Object.fromEntries(
  ifo
    .split("\n")
    .map((l) => l.split("="))
    .filter((p) => p.length >= 2)
    .map(([k, ...v]) => [k.trim(), v.join("=").trim()]),
);
const idx = readFileSync(path.join(DIR, "peu.idx"));
const dict = gunzipSync(readFileSync(path.join(DIR, "peu.dict.dz")));

// 표제어 (idx: 낱말\0 + 시작 4바이트 + 길이 4바이트)
const words: { word: string; text: string }[] = [];
for (let i = 0; i < idx.length; ) {
  const end = idx.indexOf(0, i);
  const word = idx.subarray(i, end).toString("utf8");
  const off = idx.readUInt32BE(end + 1);
  const size = idx.readUInt32BE(end + 5);
  words.push({ word, text: htmlToText(dict.subarray(off, off + size).toString("utf8")) });
  i = end + 9;
}
for (const w of words) add(w.word, w.text);
// 다른 표기 (syn: 낱말\0 + 표제어 번호 4바이트) — ṁ/ṃ/ŋ 표기 차이 등
try {
  const syn = gunzipSync(readFileSync(path.join(DIR, "peu.syn.dz")));
  for (let i = 0; i < syn.length; ) {
    const end = syn.indexOf(0, i);
    const word = syn.subarray(i, end).toString("utf8");
    const target = words[syn.readUInt32BE(end + 1)];
    if (target) add(word, target.text);
    i = end + 5;
  }
} catch {
  // 다른 표기 파일이 없으면 건너뛴다
}
console.log(`PEU: 표제어 ${words.length.toLocaleString()}개`);
}

// 조각 나누기 — 큰 사전(Cone)은 앞글자 대신 해시로 고르게 나눈다 (파일 수를 적게: 호스팅 한도 2만 개)
const HASHED = MODE === "cone" ? 256 : 128;
const hashShard = (word: string) => {
  let h = 0;
  for (const ch of word) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % HASHED;
};
const split = new Set<string>();
const sizeOf = (key: string) => key.length + JSON.stringify(entries.get(key)).length + 4;
function collectSplit(keys: string[], length: number) {
  const groups = new Map<string, string[]>();
  for (const key of keys) {
    const prefix = shardPrefix(key, length);
    groups.set(prefix, [...(groups.get(prefix) ?? []), key]);
  }
  for (const [prefix, group] of groups) {
    const size = group.reduce((sum, key) => sum + sizeOf(key), 0);
    const longer = group.filter((key) => [...key].length > length);
    if (size > SHARD_LIMIT && longer.length > 0) {
      split.add(prefix);
      collectSplit(longer, length + 1);
    }
  }
}
if (!HASHED) collectSplit([...entries.keys()], 2);
const shards = new Map<string, Record<string, string[]>>();
for (const [key, value] of entries) {
  const name = HASHED ? `h${hashShard(key)}` : shardOf(key, split);
  const shard = shards.get(name) ?? {};
  shard[key] = value;
  shards.set(name, shard);
}
rmSync(path.join(OUT, MODE), { recursive: true, force: true });
mkdirSync(path.join(OUT, MODE), { recursive: true });
for (const [name, shard] of shards) writeFileSync(path.join(OUT, MODE, `${name}.json`), JSON.stringify(shard));
console.log(`${MODE}: 정리된 낱말 ${entries.size.toLocaleString()}개 → 조각 ${shards.size}개`);

// 안내 파일에 더하기
const indexPath = path.join(OUT, "index.json");
const index = JSON.parse(readFileSync(indexPath, "utf8")) as Record<string, unknown> & {
  dictionaries: Record<string, unknown>[];
  split: Record<string, string[]>;
};
index.dictionaries = [
  ...index.dictionaries.filter((d) => d.id !== MODE),
  MODE === "cone"
    ? {
        id: "cone",
        label: "A Dictionary of Pāli (Cone)",
        license: null,
        source:
          "Margaret Cone, A Dictionary of Pāli, Parts I–III (a–bh) · © Pali Text Society 2001–2020 · PTS 가 gandhari.org 에서 무료로 공개 · 디지털판 DPD 배포본",
      }
    : {
        id: "peu",
        label: "Pali English Ultimate",
        license: null,
        source: `Pāḷi Myanmar Abhidhān 영어 번역 (사람 번역 약 80%, 나머지 기계 번역) · Bodhirasa 인코딩 · ${info.website ?? "https://pm12e.pali.tools/"} · ${String(info.date ?? "").slice(0, 10)}`,
      },
];
index.split[MODE] = HASHED ? [`#${HASHED}`] : [...split].sort();
writeFileSync(indexPath, JSON.stringify(dictionaryIndexSchema.parse(index)));
console.log(`index.json 에 ${MODE} 를 더했습니다`);
