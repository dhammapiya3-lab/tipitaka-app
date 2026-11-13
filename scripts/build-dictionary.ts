/**
 * 사전 원본(SQLite) → 조각 사전 (public/data/dict/).
 *   DPD: 공식 배포본 dpd.db, PTS·미얀마: epitaka.db, K-PTS 한국어: 원래 앱의 dictionary.sqlite
 *   (위치는 scripts/paths.ts — 기본은 앱 폴더 안 content/)
 * 원래 앱처럼 사전 파일 전체를 브라우저에 받게 하지 않고, 단어가 든 작은 조각만 받게 나눈다.
 *
 * 사용법: pnpm build:dictionary   (위치를 바꾸려면 DPD_DB=… EPITAKA_DB=… pnpm build:dictionary)
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { dictionaryIndexSchema } from "../src/lib/schemas";
import { foldPali, normalizeWord, shardOf, shardPrefix } from "../src/lib/pali";
import { DPD_DB, EPITAKA_DB, KPTS_DB } from "./paths";
import type { DictionaryIndex, DpdEntry, PlainDictionaryId } from "../src/types";

const OUT = path.join(process.cwd(), "public/data/dict");
/** 두 글자 조각이 이보다 크면 세 글자로 나눈다 */
const SHARD_LIMIT = 150_000;
const DPD_SHARD_SIZE = 100;
/** epitaka.db 의 dictionary.book_id */
const EPITAKA_BOOKS = { pts: 5, mm: 1 } as const;

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** 사전 글에서 <b>·<i> 만 남기고 다른 태그는 뺀다(화면에서 parseInline 으로 그림). */
function keepEmphasis(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(?!\/?(b|i)>)\/?[a-z][a-z0-9]*(\s[^>]*)?>/gi, "")
    .trim();
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
};

/** PTS·미얀마 사전의 HTML 을 줄바꿈 있는 글자로 바꾼다. */
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

/**
 * 앞 length 글자로 묶어 보고, 너무 큰 묶음은 split 에 적은 뒤 한 글자 더 늘려 다시 나눈다.
 * (화면의 shardOf 가 같은 split 으로 같은 조각을 찾는다)
 */
function collectSplit(keys: string[], length: number, sizeOf: (key: string) => number, split: Set<string>) {
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
      collectSplit(longer, length + 1, sizeOf, split);
    }
  }
}

/** 정리된 단어 → 값 묶음을 조각으로 나누고, 더 잘게 나눈 앞부분 목록을 돌려준다. */
function writeShards<T>(dir: string, entries: Map<string, T>): string[] {
  const sizes = new Map([...entries].map(([key, value]) => [key, key.length + JSON.stringify(value).length + 4]));
  const split = new Set<string>();
  collectSplit([...entries.keys()], 2, (key) => sizes.get(key) ?? 0, split);

  const shards = new Map<string, Record<string, T>>();
  for (const [key, value] of entries) {
    const name = shardOf(key, split);
    const shard = shards.get(name) ?? {};
    shard[key] = value;
    shards.set(name, shard);
  }
  mkdirSync(path.join(OUT, dir), { recursive: true });
  for (const [name, shard] of shards) {
    writeFileSync(path.join(OUT, dir, `${name}.json`), JSON.stringify(shard));
  }
  console.log(`  ${dir}: ${entries.size.toLocaleString()}개 → 조각 ${shards.size}개`);
  return [...split].sort();
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// ── DPD ─────────────────────────────────────────────────────
console.log("DPD 변환 중…");
const dpd = new DatabaseSync(DPD_DB, { readOnly: true });
const dpdVersion = str(
  (dpd.prepare("SELECT value FROM db_info WHERE key = 'dpd_release_version'").get() ?? {}).value,
);

const lookup = new Map<string, number[]>();
for (const row of dpd.prepare("SELECT lookup_key, headwords FROM lookup").iterate()) {
  const ids: unknown = JSON.parse(str(row.headwords) || "[]");
  if (!Array.isArray(ids) || ids.length === 0) continue;
  const key = normalizeWord(str(row.lookup_key));
  if (!key) continue;
  const merged = new Set([...(lookup.get(key) ?? []), ...ids.filter((n) => typeof n === "number")]);
  lookup.set(key, [...merged]);
}
const lookupSplit = writeShards("lookup", lookup);

const roots = new Map<string, { group: string; meaning: string }>();
for (const r of dpd.prepare("SELECT root, root_group, root_meaning FROM dpd_roots").iterate()) {
  roots.set(str(r.root), { group: str(r.root_group), meaning: str(r.root_meaning) });
}

/** 원래 앱의 요약 줄 [ ] 부분과 같은 규칙 */
function constructionSummary(h: Record<string, unknown>): string {
  if (!str(h.meaning_1) && !["pass1", "pass2"].includes(str(h.origin))) {
    return str(h.root_key) ? str(h.family_root).replace(/ /g, " + ") : str(h.family_word);
  }
  return str(h.construction)
    .split("\n")[0]
    .replace(/<\/?b>/g, "")
    .replace(/> .[^ ]*? /g, "")
    .replace(/ > .[^ ]*?$/g, "")
    .replace(/[()]/g, "")
    .replace(/^\[.*\] \+| \[.*\] \+| \+ \[.*\]$/g, "");
}

const dpdShards = new Map<number, Record<string, DpdEntry>>();
const inflectionShards = new Map<number, Record<string, string>>();
let headwordCount = 0;
for (const h of dpd.prepare("SELECT * FROM dpd_headwords").iterate()) {
  const id = Number(h.id);
  const grammar = [str(h.grammar), str(h.neg), str(h.verb), str(h.trans)].filter(Boolean).join(", ");
  const root = roots.get(str(h.root_key).replace(/ \d.*$/, ""));
  const compoundType = str(h.compound_type);
  const entry: DpdEntry = {
    id,
    lemma: str(h.lemma_1),
    pos: str(h.pos),
    grammar: grammar + (str(h.plus_case) ? ` (${str(h.plus_case)})` : ""),
    meaning1: keepEmphasis(str(h.meaning_1)),
    meaning2: keepEmphasis(str(h.meaning_2)),
    meaningLit: keepEmphasis(str(h.meaning_lit)),
    constructionSummary: constructionSummary(h),
    construction: keepEmphasis(str(h.construction)),
    root: root
      ? `${str(h.root_key).replace(/ \d.*$/, "")} ${root.group} ${str(h.root_sign)} (${root.meaning})`
      : "",
    base: str(h.root_base),
    compound:
      compoundType && !compoundType.includes("?")
        ? `${compoundType} (${keepEmphasis(str(h.compound_construction))})`
        : "",
    derivative: str(h.derivative) ? `${str(h.derivative)} (${str(h.suffix)})` : "",
    antonym: str(h.antonym),
    synonym: str(h.synonym),
    variant: str(h.variant),
    commentary: str(h.commentary) === "-" ? "" : keepEmphasis(str(h.commentary)),
    notes: keepEmphasis(str(h.notes)),
    sanskrit: str(h.sanskrit),
    examples: [1, 2].flatMap((n) => {
      const text = keepEmphasis(str(h[`example_${n}`]));
      return text
        ? [{ text, source: `${str(h[`source_${n}`])} ${str(h[`sutta_${n}`])}`.trim() }]
        : [];
    }),
    hasInflections: str(h.inflections).length > 0,
  };
  const shard = Math.floor(id / DPD_SHARD_SIZE);
  const entries = dpdShards.get(shard) ?? {};
  entries[id] = entry;
  dpdShards.set(shard, entries);
  if (entry.hasInflections) {
    const inflections = inflectionShards.get(shard) ?? {};
    inflections[id] = str(h.inflections);
    inflectionShards.set(shard, inflections);
  }
  headwordCount++;
}
for (const [dir, shards] of [
  ["dpd", dpdShards],
  ["dpd-inflections", inflectionShards],
] as const) {
  mkdirSync(path.join(OUT, dir), { recursive: true });
  for (const [n, data] of shards) writeFileSync(path.join(OUT, dir, `${n}.json`), JSON.stringify(data));
  console.log(`  ${dir}: 조각 ${shards.size}개`);
}
console.log(`  DPD 표제어 ${headwordCount.toLocaleString()}개 (${dpdVersion})`);
dpd.close();

/** 표제어·뜻풀이 행들을 "정리된 표제어 → 뜻풀이 목록"으로 모은다 */
/** 빠알리 자판 없이 찾기용: 사전에 나오는 모든 표제어·변화형 */
const allForms = new Set<string>();

function collectPlain(rows: Iterable<Record<string, unknown>>): Map<string, string[]> {
  const entries = new Map<string, string[]>();
  for (const row of rows) {
    const key = normalizeWord(str(row.word));
    const text = htmlToText(str(row.definition));
    if (!key || !text) continue;
    entries.set(key, [...(entries.get(key) ?? []), text]);
    allForms.add(key);
  }
  return entries;
}

// ── PTS · 미얀마 (epitaka.db) ────────────────────────────────
console.log("PTS·미얀마 사전 변환 중…");
const epitaka = new DatabaseSync(EPITAKA_DB, { readOnly: true });
const plainSplit: Record<PlainDictionaryId, string[]> = { kpts: [], pts: [], mm: [], peu: [] };
for (const [dict, bookId] of Object.entries(EPITAKA_BOOKS) as ["pts" | "mm", number][]) {
  plainSplit[dict] = writeShards(
    dict,
    collectPlain(
      epitaka
        .prepare("SELECT word, definition FROM dictionary WHERE book_id = ? ORDER BY rowid")
        .iterate(bookId),
    ),
  );
}
epitaka.close();

// ── K-PTS 빠알리–한국어 (원래 앱의 dictionary.sqlite) ────────────
console.log("K-PTS 한국어 사전 변환 중…");
const kpts = new DatabaseSync(KPTS_DB, { readOnly: true });
plainSplit.kpts = writeShards(
  "kpts",
  collectPlain(
    kpts
      .prepare("SELECT headword_normalized AS word, definition_html AS definition FROM entries ORDER BY id")
      .iterate(),
  ),
);
kpts.close();

// ── 빠알리 자판 없이 찾기 (ā→a, ṭ→t …) ────────────────────────
// 기호를 뗀 글자 → 실제 표제어·변화형 목록. 원래 글자로 못 찾을 때만 쓴다.
console.log("자판 글자 색인 만드는 중…");
for (const key of lookup.keys()) allForms.add(key);
const folded = new Map<string, string[]>();
for (const form of allForms) {
  const key = foldPali(form);
  if (key) folded.set(key, [...(folded.get(key) ?? []), form]);
}
const foldSplit = writeShards("fold", folded);

// ── 안내 파일 ────────────────────────────────────────────────
const index: DictionaryIndex = {
  version: dpdVersion,
  dictionaries: [
    {
      id: "dpd",
      label: "Digital Pāḷi Dictionary",
      license: "CC BY-NC-SA 4.0",
      source: `Bodhirasa Bhikkhu, ${dpdVersion}, https://www.dpdict.net/`,
    },
    {
      id: "kpts",
      label: "K-PTS 빠알리–한국어 사전",
      license: null,
      source: "K-PTSdic. 한글빠알리사전 · 원문 표기: 선운사대학원용 초역, 박경숙 (원래 앱의 dictionary.sqlite)",
    },
    { id: "pts", label: "PTS Pali–English 사전", license: null, source: "epitaka.db (PTS Pali-English Dictionary)" },
    { id: "mm", label: "Tipiṭaka Pāḷi–Myanmar 사전", license: null, source: "epitaka.db (တိပိဋက ပါဠိ-မြန်မာ အဘိဓာန်)" },
  ],
  split: { lookup: lookupSplit, fold: foldSplit, ...plainSplit },
  dpdShardSize: DPD_SHARD_SIZE,
};
writeFileSync(path.join(OUT, "index.json"), JSON.stringify(dictionaryIndexSchema.parse(index)));
console.log("사전 변환 완료");
