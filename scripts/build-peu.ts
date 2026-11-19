/**
 * 따로 받은 사전을 조각 사전으로 — DPD 누리집(docs.dpdict.net/other_dicts)에서 배포하는 사전들.
 *
 *   PEU_DIR=압축을 푼 폴더 pnpm build:peu                       Pali English Ultimate (StarDict: peu.ifo · .idx · .dict.dz · .syn.dz)
 *   CONE_TAB=cone.txt pnpm build:peu -- cone                       Margaret Cone, A Dictionary of Pāli (MDict 를 pyglossary 로 Tabfile 로 바꾼 것)
 *   pnpm build:peu -- sibd / sisu                                  빠알리-싱할라 사전 (Path Nirvana Foundation, https://github.com/pnfo/pali-sinhala-dictionary)
 *       sibd = Buddhadatta (buddhadatta_dict.json) · sisu = Sumangala (sumangala_dict.json) — content/pali-sinhala/ 에 받아 둔 것
 *       (pyglossary cone-mdict.mdx cone.txt --read-format=OctopusMdict --write-format=Tabfile)
 *
 * - 『빠알리-미얀마 아비단(Pāḷi Myanmar Abhidhān)』의 영어 번역 요약본 (사람 번역 약 80%, 나머지 기계 번역).
 *   이름: Pali English Ultimate(PEU) → Pali English Abhidhan(PEA). Tipitaka Pali Reader(TPR)를 위해 만든 사전.
 *   이용 조건(Bhante Subhuti 답장, 2026-11): 오픈 소스, 자유롭게 사용 가능, 출처를 밝힐 것. 원본은 27권이 넘는 책이고 이 사전은 그것을 크게 줄인 것.
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

const ARGS = process.argv.slice(2);
const MODE = ARGS.includes("cone") ? "cone" : ARGS.includes("sibd") ? "sibd" : ARGS.includes("sisu") ? "sisu" : "peu";
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
else if (MODE === "sibd" || MODE === "sisu") readSinhala(MODE);
else if (process.env.PEU_DUMP) readPeuDump(process.env.PEU_DUMP);
else readPeu();

/**
 * pm12e 사이트가 내주는 전체 자료(https://pm12e.pali.tools/dump) — "var pm12e = {'낱말':'뜻', …};" 꼴.
 * 코드로 실행하지 않고 글자 그대로 읽는다 (작은따옴표·큰따옴표 문자열, \ 탈출 문자).
 * DPD 가 같은 자료로 StarDict 를 만들 때처럼 ṁ 은 ṃ 으로 바꾼다.
 */
function readPeuDump(file: string) {
  const src = readFileSync(file, "utf8");
  let i = src.indexOf("{") + 1;
  if (i <= 0) throw new Error("PEU_DUMP: '{' 가 없습니다");
  const skip = () => {
    while (i < src.length && /[\s,]/.test(src[i])) i++;
  };
  const readString = (): string => {
    const q = src[i];
    if (q !== "'" && q !== '"') throw new Error(`PEU_DUMP: ${i} 번째 글자에 문자열이 없습니다`);
    let out = "";
    for (i++; i < src.length; i++) {
      const c = src[i];
      if (c === q) {
        i++;
        return out;
      }
      if (c === "\\") {
        const n = src[++i];
        if (n === "n") out += "\n";
        else if (n === "t") out += " ";
        else if (n === "r") out += "";
        else if (n === "u") {
          out += String.fromCharCode(parseInt(src.slice(i + 1, i + 5), 16));
          i += 4;
        } else out += n;
      } else if (!/[\u0000-\u001f\u007f-\u009f]/.test(c)) out += c; // 제어 문자(탭·줄바꿈 등)는 뺀다 (DPD 판과 같게)
    }
    throw new Error("PEU_DUMP: 문자열이 닫히지 않았습니다");
  };
  // 같은 표제어가 두 번 나오면 뒤의 것 (자바스크립트가 이 파일을 읽을 때와 같게 — pm12e 사이트가 보여 주는 것)
  const raw = new Map<string, string>();
  for (;;) {
    skip();
    if (src[i] === "}" || i >= src.length) break;
    const word = readString().replace(/ṁ/g, "ṃ");
    skip();
    if (src[i] !== ":") throw new Error(`PEU_DUMP: ${i} 번째에 ':' 가 없습니다`);
    i++;
    skip();
    raw.set(word, readString().replace(/ṁ/g, "ṃ"));
  }
  // StarDict 사전 순서(영문자 대소문자 무시 → 바이트)로 — 같은 낱말로 합쳐지는 뜻풀이의 순서가 DPD 판과 같도록
  const asciiLower = (w: string) => Buffer.from(w.replace(/[A-Z]/g, (c) => c.toLowerCase()), "utf8");
  const order = [...raw.keys()].sort(
    (a, b) => Buffer.compare(asciiLower(a), asciiLower(b)) || Buffer.compare(Buffer.from(a), Buffer.from(b)),
  );
  const variants: [string, string][] = [];
  for (const word of order) {
    const html = raw.get(word)!;
    const text = htmlToText(html);
    add(word, text);
    // StarDict 판의 다른 표기(ŋ)와 같게 — 정리(normalizeWord)하면 ṃ 이 빠진 꼴이 된다. 표제어를 다 넣은 뒤에 넣는다.
    if (word.includes("ṃ")) variants.push([word.replace(/ṃ/g, "ŋ"), text]);
  }
  for (const [w, t] of variants) add(w, t);
  const n = raw.size;
  const date = process.env.PEU_DATE ?? new Date().toISOString().slice(0, 10);
  info = { website: "https://pm12e.pali.tools/", date };
  console.log(`PEU(pm12e 자료): 표제어 ${n.toLocaleString()}개 · 받은 날 ${date}`);
}

/** 싱할라 글자 → 로마자 빠알리 (표제어 열쇠용 — 뜻풀이는 싱할라 글 그대로) */
function sinhalaToRoman(text: string): string {
  const SI_VOWEL: Record<string, string> = { "අ": "a", "ආ": "ā", "ඉ": "i", "ඊ": "ī", "උ": "u", "ඌ": "ū", "එ": "e", "ඒ": "e", "ඔ": "o", "ඕ": "o" };
  const SI_SIGN: Record<string, string> = { "ා": "ā", "ි": "i", "ී": "ī", "ු": "u", "ූ": "ū", "ෙ": "e", "ේ": "e", "ො": "o", "ෝ": "o", "ෛ": "ai" };
  const SI_CONS: Record<string, string> = {
    "ක": "k", "ඛ": "kh", "ග": "g", "ඝ": "gh", "ඞ": "ṅ", "ච": "c", "ඡ": "ch", "ජ": "j", "ඣ": "jh", "ඤ": "ñ",
    "ට": "ṭ", "ඨ": "ṭh", "ඩ": "ḍ", "ඪ": "ḍh", "ණ": "ṇ", "ත": "t", "ථ": "th", "ද": "d", "ධ": "dh", "න": "n",
    "ප": "p", "ඵ": "ph", "බ": "b", "භ": "bh", "ම": "m", "ය": "y", "ර": "r", "ල": "l", "ව": "v", "ස": "s",
    "හ": "h", "ළ": "ḷ", "ශ": "ś", "ෂ": "ṣ", "ඟ": "ṅg", "ඬ": "ṇḍ", "ඹ": "mb",
  };
  let out = "";
  const chars = [...text.replace(/[\u200C\u200D]/g, "")];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    const cons = SI_CONS[c];
    if (cons !== undefined) {
      const next = chars[i + 1];
      if (next === "්") {
        out += cons;
        i++;
      } else if (next && SI_SIGN[next] !== undefined) {
        out += cons + SI_SIGN[next];
        i++;
      } else out += cons + "a";
    } else if (SI_VOWEL[c] !== undefined) out += SI_VOWEL[c];
    else if (c === "ං") out += "ṃ";
    else out += c;
  }
  return out;
}

/** 빠알리-싱할라 사전 — [싱할라 표제어, HTML 뜻풀이(, 쪽)] 목록 */
function readSinhala(mode: "sibd" | "sisu") {
  const dir = process.env.SINHALA_DIR ?? path.join(process.cwd(), "content", "pali-sinhala");
  const file = mode === "sibd" ? "buddhadatta_dict.json" : "sumangala_dict.json";
  const rows = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as unknown;
  if (!Array.isArray(rows)) throw new Error(`${file}: 목록이 아닙니다`);
  let n = 0;
  for (const row of rows) {
    if (!Array.isArray(row) || typeof row[0] !== "string" || typeof row[1] !== "string")
      throw new Error(`${file}: 꼴이 다른 항목 ${JSON.stringify(row).slice(0, 80)}`);
    const [head, html, page] = row as [string, string, number | undefined];
    // 뜻풀이 앞에 원래 싱할라 표제어(와 쪽)를 그대로 붙여 둔다 — 로마자 열쇠만으로는 원문 표기를 알 수 없으니
    const text = `${head}${typeof page === "number" ? ` (${page}쪽)` : ""}\n${htmlToText(html)}`;
    // 표제어 "A, B" · "A (B)" · "A = B" → 꼴마다 열쇠
    for (const form of head.split(/[,=]/)) {
      const bare = form.replace(/\([^)]*\)/g, "").trim();
      if (bare) add(sinhalaToRoman(bare), text);
    }
    n++;
  }
  const v = JSON.parse(readFileSync(path.join(dir, "version.json"), "utf8")) as { date?: string; commit?: string };
  info = { website: "https://github.com/pnfo/pali-sinhala-dictionary", date: v.date ?? "", commit: v.commit ?? "" };
  console.log(`${mode}: 항목 ${n.toLocaleString()}개 · ${info.date}`);
}

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
const HASHED = MODE === "cone" ? 256 : MODE === "peu" ? 128 : 32;
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
  MODE === "sibd" || MODE === "sisu"
    ? {
        id: MODE,
        label: MODE === "sibd" ? "Pāḷi–Sinhala (Buddhadatta)" : "Pāḷi–Sinhala (Sumaṅgala)",
        license: "Path Nirvana Foundation 사용 허락 (2026-11) — 저장소의 최신 자료를 쓰도록",
        source: `${MODE === "sibd" ? "Buddhadatta 빠알리-싱할라 사전 (buddhadatta_dict.json)" : "Sumaṅgala 빠알리-싱할라 사전 (sumangala_dict.json)"} · Path Nirvana Foundation · ${info.website} · ${info.date} (${String(info.commit).slice(0, 7)})`,
      }
    : MODE === "cone"
    ? {
        id: "cone",
        label: "A Dictionary of Pāli (Cone)",
        license: null,
        source:
          "Margaret Cone, A Dictionary of Pāli, Parts I–III (a–bh) · © Pali Text Society 2001–2020 · PTS 가 gandhari.org 에서 무료로 공개 · 디지털판 DPD 배포본",
      }
    : {
        id: "peu",
        label: "Pali English Abhidhan (PEA)",
        license: "오픈 소스 — 출처를 밝히면 자유롭게 사용 (Bhante Subhuti, 2026-11)",
        source: `Pāḷi Myanmar Abhidhān 영어 번역 (사람 번역 약 80%, 나머지 기계 번역) · Bodhirasa 인코딩 · ${info.website ?? "https://pm12e.pali.tools/"} · ${String(info.date ?? "").slice(0, 10)}`,
      },
];
index.split[MODE] = HASHED ? [`#${HASHED}`] : [...split].sort();
writeFileSync(indexPath, JSON.stringify(dictionaryIndexSchema.parse(index)));
console.log(`index.json 에 ${MODE} 를 더했습니다`);
