/**
 * 브라우저에서 자료를 받는 유일한 진입점.
 *   경 본문·각주: public/data/suttas/ (`pnpm build:content`) — 고른 판본만 받는다.
 *   조각 사전: public/data/dict/ (`pnpm build:dictionary`) — 찾는 단어가 든 조각만 받는다.
 *   검색 색인: public/data/search/ (`pnpm build:content`) — 찾는 단어가 든 조각만 받는다.
 */
import { z } from "zod";
import { cleanLemma, foldPali, normalizeWord, shardOf } from "@/lib/pali";
import { unseal } from "@/lib/seal";
import {
  intersectHits,
  matchPrefix,
  minQueryLength,
  searchShardName,
  tokenize,
} from "@/lib/search";
import {
  dictionaryIndexSchema,
  dpdFamilyShardSchema,
  dpdFreqLayoutSchema,
  dpdFreqShardSchema,
  dpdShardSchema,
  dpdTemplatesSchema,
  foldShardSchema,
  inflectionShardSchema,
  lookupShardSchema,
  plainShardSchema,
  searchShardSchema,
  editionInfoSchema,
  suttaCommentarySchema,
  suttaNissayaSchema,
  suttaNotesSchema,
  sealedSuttaTextSchema,
  extrasSchema,
  suttaIndexSchema,
  suttaTextSchema,
  topicsSchema,
} from "@/lib/schemas";
import type {
  DictionaryId,
  DictionaryIndex,
  DpdEntry,
  DpdFamily,
  DpdFamilyKind,
  DpdFreqRow,
  DpdFrequency,
  DpdTemplate,
  Language,
  PlainDictionaryId,
  PlainEntry,
  AnalysisKind,
  CommentaryLayer,
  EditionInfo,
  SuttaCommentary,
  SuttaExtras,
  SuttaIndexEntry,
  SuttaNissaya,
  SuttaNotes,
  SuttaText,
} from "@/types";

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`자료를 받지 못했습니다 (${res.status})`);
  return res.json();
}

// ── 경 본문 ─────────────────────────────────────────────────
const SUTTA_BASE = "/data/suttas";

const suttaUrl = (suttaId: string, editionId: string, suffix: string) =>
  `${SUTTA_BASE}/${encodeURIComponent(suttaId)}/${encodeURIComponent(editionId)}${suffix}`;

// ── VRI 본문·주석 묶음 (public/data/vri/t-<n>.json · c-<n>.json) ───────────
const VRI_EDITION_ID = "pli-vri";
const vriShardCache = new Map<string, Promise<Record<string, unknown>>>();

function vriShard(
  kind: "t" | "c",
  n: number,
): Promise<Record<string, unknown>> {
  return shardJson(`/data/vri/${kind}-${n}.json`);
}

/** 묶음 파일 하나 — 한 번만 받는다 (VRI · PTS) */
function shardJson(url: string): Promise<Record<string, unknown>> {
  let promise = vriShardCache.get(url);
  if (!promise) {
    promise = getJson(url).then((data) =>
      z.record(z.string(), z.unknown()).parse(data),
    );
    vriShardCache.set(url, promise);
    promise.catch(() => vriShardCache.delete(url));
  }
  return promise;
}

const vriTextBodySchema = z.object({
  s: z.array(z.unknown()),
  p: z.array(z.tuple([z.string(), z.string(), z.string()])).default([]),
  /** 다음 문장 내용까지 함께 들어 있을 수 있는 문장 번호 */
  u: z.array(z.string()).default([]),
  /** 책 첫머리 줄 */
  h: z.array(z.string()).default([]),
  /** 경 문단 → VRI 문단·게송 번호 */
  n: z.record(z.string(), z.string()).default({}),
});

/** 책 쪽 번호: [문장 번호, 판(P·M·T·V), 권.쪽] — 쪽이 바뀌는 문장마다 */
export async function fetchPageMarks(
  suttaId: string,
): Promise<[string, string, string][]> {
  const entry = (await fetchSuttaIndex()).find((s) => s.id === suttaId);
  if (!entry?.vri) return [];
  const shard = await vriShard("t", entry.vri.t);
  return vriTextBodySchema.parse(shard[suttaId]).p;
}

async function vriEntry(suttaId: string) {
  const entry = (await fetchSuttaIndex()).find((s) => s.id === suttaId);
  if (!entry?.vri) throw new Error("VRI 자료가 없습니다");
  return entry.vri;
}

export async function fetchSuttaText(
  suttaId: string,
  editionId: string,
): Promise<SuttaText> {
  if (editionId === VRI_EDITION_ID) {
    const { t } = await vriEntry(suttaId);
    const shard = await vriShard("t", t);
    const body = vriTextBodySchema.parse(shard[suttaId]);
    const text = suttaTextSchema.parse({
      suttaId,
      editionId,
      segments: body.s,
      ...(body.h.length ? { preface: body.h } : {}),
      ...(Object.keys(body.n).length ? { vriNumbers: body.n } : {}),
    });
    const unsure = new Set(body.u);
    return unsure.size
      ? {
          ...text,
          segments: text.segments.map((s) =>
            unsure.has(s.key) ? { ...s, unsure: true } : s,
          ),
        }
      : text;
  }
  // 경이 아주 많은 판본(PTS)은 묶음 파일에 들어 있다
  const shardNo = await editionShardNo(suttaId, editionId);
  if (shardNo !== undefined) {
    const shard = await shardJson(`/data/shards/${editionId}-${shardNo}.json`);
    return suttaTextSchema.parse(shard[suttaId]);
  }
  const data = await getJson(suttaUrl(suttaId, editionId, ".json"));
  // 복사를 막아 둔 번역은 감싸 둔 글을 풀어서 같은 검사를 한다
  const sealed = sealedSuttaTextSchema.safeParse(data);
  if (sealed.success) {
    const { sealed: body, ...ids } = sealed.data;
    return suttaTextSchema.parse({
      ...ids,
      segments: unseal(body, ids.suttaId, ids.editionId),
    });
  }
  return suttaTextSchema.parse(data);
}

async function editionShardNo(
  suttaId: string,
  editionId: string,
): Promise<number | undefined> {
  const entry = (await fetchSuttaIndex()).find((s) => s.id === suttaId);
  return entry?.shards?.[editionId];
}

export async function fetchSuttaNotes(
  suttaId: string,
  editionId: string,
): Promise<SuttaNotes> {
  if ((await editionShardNo(suttaId, editionId)) !== undefined) {
    const text = await fetchSuttaText(suttaId, editionId);
    return { suttaId, editionId, notes: text.notes ?? [] };
  }
  // 각주가 본문 파일 안에 함께 든 판본(수자또 스님 — 빌라라 각주)이 있다
  const text = suttaTextSchema.safeParse(
    await getJson(suttaUrl(suttaId, editionId, ".json")),
  );
  if (text.success && text.data.notes)
    return { suttaId, editionId, notes: text.data.notes };
  return suttaNotesSchema.parse(
    await getJson(suttaUrl(suttaId, editionId, ".notes.json")),
  );
}

let suttaIndexPromise: Promise<SuttaIndexEntry[]> | null = null;

/** 경 읽기 화면용 목록 — 한 번만 받는다 */

export type Topics = z.infer<typeof topicsSchema>;
let topicsPromise: Promise<Topics> | null = null;
/** ATI 주제 — 경마다 주제, 주제마다 이름 (한 번만 받는다) */
export function fetchTopics(): Promise<Topics> {
  if (!topicsPromise) {
    topicsPromise = getJson("/data/topics.json").then((d) =>
      topicsSchema.parse(d),
    );
    topicsPromise.catch(() => {
      topicsPromise = null;
    });
  }
  return topicsPromise;
}

export function fetchSuttaIndex(): Promise<SuttaIndexEntry[]> {
  if (!suttaIndexPromise) {
    suttaIndexPromise = getJson("/data/sutta-index.json").then((data) =>
      suttaIndexSchema.parse(data),
    );
    suttaIndexPromise.catch(() => {
      suttaIndexPromise = null;
    });
  }
  return suttaIndexPromise;
}

let extrasPromise: Promise<Record<string, SuttaExtras>> | null = null;

/** 경 읽기 오른쪽 칸의 참고 경전 · 해설 법문 · 기타 자료 — 한 번만 받는다 */
export function fetchExtras(): Promise<Record<string, SuttaExtras>> {
  if (!extrasPromise) {
    extrasPromise = getJson("/data/extras.json").then((data) =>
      extrasSchema.parse(data),
    );
    extrasPromise.catch(() => {
      extrasPromise = null;
    });
  }
  return extrasPromise;
}

const analysisCache = new Map<string, Promise<SuttaNissaya>>();

/** 대역(.nissaya.json)·문법분석(.grammar.json) — 처음 열 때만 받고 페이지 안에서 기억한다 */
export function fetchSuttaAnalysis(
  kind: AnalysisKind,
  suttaId: string,
  editionId: string,
): Promise<SuttaNissaya> {
  const url = suttaUrl(suttaId, editionId, `.${kind}.json`);
  let promise = analysisCache.get(url);
  if (!promise) {
    promise = getJson(url).then((data) => suttaNissayaSchema.parse(data));
    analysisCache.set(url, promise);
    promise.catch(() => analysisCache.delete(url));
  }
  return promise;
}

/** 주석서·복주석서 — 경의 VRI 주석 묶음에서 꺼낸다 */
export async function fetchCommentary(
  suttaId: string,
  layer: CommentaryLayer,
): Promise<SuttaCommentary> {
  const { c } = await vriEntry(suttaId);
  if (c === null) throw new Error("주석 자료가 없습니다");
  const shard = await vriShard("c", c);
  const both = shard[suttaId] as Record<string, unknown> | undefined;
  return suttaCommentarySchema.parse(both?.[layer]);
}

const editionInfoCache = new Map<string, Promise<EditionInfo | null>>();

/** 판본 정보 창의 소개 글 — 없으면 null */
export function fetchEditionInfo(
  editionId: string,
): Promise<EditionInfo | null> {
  let promise = editionInfoCache.get(editionId);
  if (!promise) {
    promise = fetch(
      `/data/edition-info/${encodeURIComponent(editionId)}.json`,
    ).then(async (res) => {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`자료를 받지 못했습니다 (${res.status})`);
      return editionInfoSchema.parse(await res.json());
    });
    editionInfoCache.set(editionId, promise);
    promise.catch(() => editionInfoCache.delete(editionId));
  }
  return promise;
}

// ── 조각 사전 ───────────────────────────────────────────────
const DICT_BASE = "/data/dict";
// 같은 조각을 두 번 받지 않는다. 실패한 요청은 지워 다시 시도할 수 있게 한다.
const dictCache = new Map<string, Promise<unknown>>();

/** 조각 하나를 받는다. 조각 파일이 없으면(그 앞글자로 시작하는 단어가 없음) 빈 객체. */
function getShard<T extends z.ZodType>(
  url: string,
  schema: T,
): Promise<z.infer<T>> {
  let promise = dictCache.get(url);
  if (!promise) {
    promise = fetch(url).then(async (res) => {
      if (res.status === 404) return {};
      if (!res.ok) throw new Error(`사전을 받지 못했습니다 (${res.status})`);
      return res.json();
    });
    dictCache.set(url, promise);
    promise.catch(() => dictCache.delete(url));
  }
  return promise.then((data) => schema.parse(data));
}

let indexPromise: Promise<DictionaryIndex> | null = null;

export function fetchDictionaryIndex(): Promise<DictionaryIndex> {
  if (!indexPromise) {
    indexPromise = getJson(`${DICT_BASE}/index.json`)
      .then((data) => dictionaryIndexSchema.parse(data))
      .catch((e: unknown) => {
        indexPromise = null;
        throw e;
      });
  }
  return indexPromise;
}

async function fetchDpdEntries(
  index: DictionaryIndex,
  ids: number[],
): Promise<DpdEntry[]> {
  const shards = [
    ...new Set(ids.map((id) => Math.floor(id / index.dpdShardSize))),
  ];
  const loaded = await Promise.all(
    shards.map((n) => getShard(`${DICT_BASE}/dpd/${n}.json`, dpdShardSchema)),
  );
  const byId = new Map<number, DpdEntry>();
  for (const shard of loaded)
    for (const entry of Object.values(shard)) byId.set(entry.id, entry);
  return ids.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
}

/** 해시로 나눈 사전 조각 번호 — scripts/build-peu.ts 와 같은 계산 */
function hashShard(word: string, count: number): number {
  let h = 0;
  for (const ch of word) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % count;
}

async function fetchPlain(
  index: DictionaryIndex,
  dict: PlainDictionaryId,
  candidates: string[],
): Promise<PlainEntry[]> {
  const split = new Set(index.split[dict]);
  // "#256" 처럼 적혀 있으면 앞글자 대신 해시로 나눈 조각 (큰 사전 — 호스팅 파일 수 한도 때문)
  const hashed = index.split[dict]?.[0]?.startsWith("#")
    ? Number(index.split[dict][0].slice(1))
    : 0;
  const found = await Promise.all(
    candidates.map(async (headword) => {
      const shard = await getShard(
        `${DICT_BASE}/${dict}/${hashed ? `h${hashShard(headword, hashed)}` : shardOf(headword, split)}.json`,
        plainShardSchema,
      );
      const definitions = shard[headword];
      return definitions ? [{ headword, definitions }] : [];
    }),
  );
  return found.flat();
}

export interface WordLookup extends Record<PlainDictionaryId, PlainEntry[]> {
  query: string;
  /** 실제로 찾은 형태. 빠알리 자판 없이 쳤으면 기호를 되살린 형태(satipatthana → satipaṭṭhāna) */
  normalized: string;
  /** 자판 글자로 찾았을 때 그 글자에 해당하는 다른 형태들 (고를 수 있게 보여 준다) */
  alternatives: string[];
  dpd: DpdEntry[];
  /** 낱말 나누기(Splitter) — 연음으로 붙은 낱말을 나누는 방법들 (좋은 차례, 없으면 빈 목록) */
  split: SplitWays;
}

/** 나누는 방법들. byDpd: DPD Splitter 결과면 true, 이 사이트 프로그램이 나눈 것이면 false */
export interface SplitWays {
  ways: string[][];
  byDpd: boolean;
}

/** 낱말 나누기 조각 — scripts/build-splitter.ts 의 shardNo 와 같은 계산 */
const SPLITTER_SHARDS = 128;
async function fetchSplit(word: string): Promise<SplitWays> {
  let h = 0;
  for (const ch of word) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  try {
    const shard = await getShard(
      `${DICT_BASE}/splitter/${h % SPLITTER_SHARDS}.json`,
      z.record(z.string(), z.string()),
    );
    const raw = shard[word];
    if (!raw) return { ways: [], byDpd: false };
    // "앞 + 뒤|다른 + 나눔", 맨 앞 * 는 이 사이트 프로그램이 나눈 것
    const byDpd = !raw.startsWith("*");
    return {
      ways: raw
        .replace(/^\*/, "")
        .split("|")
        .map((w) => w.split(" + ")),
      byDpd,
    };
  } catch {
    return { ways: [], byDpd: false };
  }
}

/** 나눈 조각 하나의 분석 — DPD 표제어(뜻)와 이 조각이 그 표제어의 어떤 어형인지(어미 문법) */
export interface PartAnalysis {
  part: string;
  entries: { entry: DpdEntry; grammar: string[] }[];
}

/** DPR Analysis 처럼 조각마다 짧은 뜻과 어미 문법을 찾는다 (DPD 찾아보기 · 어형 변화표로) */
export async function analyzeParts(parts: string[]): Promise<PartAnalysis[]> {
  const index = await fetchDictionaryIndex();
  const templates = await fetchDpdTemplates().catch(
    () => ({}) as Record<string, DpdTemplate>,
  );
  return Promise.all(
    parts.map(async (part) => {
      const p = normalizeWord(part);
      const entries = await fetchDpdEntries(index, await lookupIds(index, p));
      const found = entries.map((entry) => {
        const grammar: string[] = [];
        const t = entry.pattern ? templates[entry.pattern] : undefined;
        if (t && entry.stem !== undefined) {
          for (const row of t.rows.slice(1)) {
            for (let c = 1; c < row.length; c += 2) {
              if (
                (row[c] ?? []).some(
                  (ending) => normalizeWord(`${entry.stem}${ending}`) === p,
                )
              ) {
                grammar.push((row[c + 1] ?? []).join(" "));
              }
            }
          }
        }
        return { entry, grammar };
      });
      // 이 조각이 바로 그 표제어의 어형인 것(어미 문법이 맞는 것·불변화사)만 — 없으면 찾은 것 앞의 몇 개
      const exact = found.filter(
        ({ entry, grammar }) =>
          grammar.length > 0 || normalizeWord(cleanLemma(entry.lemma)) === p,
      );
      return { part, entries: (exact.length ? exact : found).slice(0, 4) };
    }),
  );
}

const PLAIN_DICTIONARIES: PlainDictionaryId[] = [
  "kpts",
  "cone",
  "pts",
  "peu",
  "mm",
];

async function lookupIds(
  index: DictionaryIndex,
  form: string,
): Promise<number[]> {
  const shard = await getShard(
    `${DICT_BASE}/lookup/${shardOf(form, new Set(index.split.lookup))}.json`,
    lookupShardSchema,
  );
  return shard[form] ?? [];
}

/**
 * 원래 글자로 못 찾으면 빠알리 기호를 뗀 글자로 다시 찾는다.
 * 같은 자판 글자에 여러 형태가 있으면(kama → kāma, kamā …) DPD 에 있는 것을 먼저 고른다.
 */
async function resolveForm(index: DictionaryIndex, normalized: string) {
  const ids = await lookupIds(index, normalized);
  if (ids.length > 0) return { form: normalized, ids, alternatives: [] };
  const key = foldPali(normalized);
  const shard = await getShard(
    `${DICT_BASE}/fold/${shardOf(key, new Set(index.split.fold))}.json`,
    foldShardSchema,
  );
  const forms = (shard[key] ?? []).filter((f) => f !== normalized);
  if (forms.length === 0) return { form: normalized, ids, alternatives: [] };
  const withIds = await Promise.all(
    forms.map(async (f) => ({ f, ids: await lookupIds(index, f) })),
  );
  const best = withIds.find((x) => x.ids.length > 0) ?? withIds[0];
  return {
    form: best.f,
    ids: best.ids,
    alternatives: forms.filter((f) => f !== best.f),
  };
}

/**
 * 단어 하나를 찾는다.
 * 1) DPD 의 "변화형 → 표제어" 표로 표제어를 찾고 (못 찾으면 빠알리 기호 없이 다시)
 * 2) 그 표제어의 기본형(번호 뗀 lemma)과 단어 자체로 K-PTS·PTS·미얀마 사전을 찾는다.
 */
export async function lookupWord(
  query: string,
  dicts: DictionaryId[],
): Promise<WordLookup> {
  const typed = normalizeWord(query);
  const empty: WordLookup = {
    query,
    normalized: typed,
    alternatives: [],
    dpd: [],
    split: { ways: [], byDpd: false },
    kpts: [],
    pts: [],
    mm: [],
    peu: [],
    cone: [],
  };
  if (!typed) return empty;

  const index = await fetchDictionaryIndex();
  const [{ form: normalized, ids, alternatives }, split] = await Promise.all([
    resolveForm(index, typed),
    fetchSplit(typed),
  ]);
  const dpd = await fetchDpdEntries(index, ids);
  const candidates = [
    ...new Set([
      normalized,
      ...dpd.map((e) => normalizeWord(cleanLemma(e.lemma))),
    ]),
  ].filter(Boolean);

  const plain = await Promise.all(
    PLAIN_DICTIONARIES.map((id) =>
      dicts.includes(id) ? fetchPlain(index, id, candidates) : [],
    ),
  );
  return {
    ...empty,
    normalized,
    alternatives,
    split,
    dpd: dicts.includes("dpd") ? dpd : [],
    ...Object.fromEntries(PLAIN_DICTIONARIES.map((id, i) => [id, plain[i]])),
  };
}

/** DPD 가족 조각 — scripts/build-dpd-extras.ts 의 familyShard 와 같은 계산 */
const DPD_FAMILY_SHARDS = 8;
function dpdFamilyShard(key: string): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % DPD_FAMILY_SHARDS;
}

/** DPD 가족(어근·낱말·합성어·숙어·같은 묶음) — 단추를 누를 때만 받는다 */
export async function fetchDpdFamily(
  kind: DpdFamilyKind,
  key: string,
): Promise<DpdFamily | null> {
  const shard = await getShard(
    `${DICT_BASE}/dpd-family/${kind}-${dpdFamilyShard(key)}.json`,
    dpdFamilyShardSchema,
  );
  return shard[key] ?? null;
}

/** DPD 빈도 (판본·책별 출현 횟수) */
export async function fetchDpdFrequency(
  id: number,
): Promise<DpdFrequency | null> {
  const shard = await getShard(
    `${DICT_BASE}/dpd-freq/${Math.floor(id / 1000)}.json`,
    dpdFreqShardSchema,
  );
  return shard[String(id)] ?? null;
}

let freqLayoutPromise: Promise<DpdFreqRow[]> | null = null;
/** DPD 빈도표 모양 — 한 번만 받는다 */
export function fetchDpdFreqLayout(): Promise<DpdFreqRow[]> {
  if (!freqLayoutPromise) {
    freqLayoutPromise = getJson(`${DICT_BASE}/dpd-freq-layout.json`).then((d) =>
      dpdFreqLayoutSchema.parse(d),
    );
    freqLayoutPromise.catch(() => {
      freqLayoutPromise = null;
    });
  }
  return freqLayoutPromise;
}

/** DPD 표제어의 어형 변화 목록 (펼칠 때만 받는다) */
let templatesPromise: Promise<Record<string, DpdTemplate>> | null = null;

/** DPD 어형 변화표 틀 — 한 번만 받는다 */
export function fetchDpdTemplates(): Promise<Record<string, DpdTemplate>> {
  if (!templatesPromise) {
    templatesPromise = getJson(`${DICT_BASE}/dpd-templates.json`).then((d) =>
      dpdTemplatesSchema.parse(d),
    );
    templatesPromise.catch(() => {
      templatesPromise = null;
    });
  }
  return templatesPromise;
}

export async function fetchInflections(id: number): Promise<string[]> {
  const index = await fetchDictionaryIndex();
  const shard = await getShard(
    `${DICT_BASE}/dpd-inflections/${Math.floor(id / index.dpdShardSize)}.json`,
    inflectionShardSchema,
  );
  return (shard[id] ?? "").split(",").filter(Boolean);
}

// ── 경 본문 검색 ────────────────────────────────────────────
const SEARCH_BASE = "/data/search";

/** 찾은 문장: "경|판본" → 문장 번호 집합 */
export type SearchHits = Map<string, Set<string>>;

/**
 * 경 본문에서 찾는다. 언어마다 색인이 따로 있고, 단어는 앞부분 일치,
 * 여러 단어는 같은 문장에 모두 있어야 한다. 너무 짧은 단어는 뺀다.
 */
export async function searchText(
  query: string,
  languages: Language[],
): Promise<SearchHits> {
  const all: SearchHits = new Map();
  for (const language of languages) {
    const tokens = tokenize(query, language).filter(
      (t) => [...t].length >= minQueryLength(t),
    );
    if (tokens.length === 0) continue;
    const perToken = await Promise.all(
      tokens.map(async (token) => {
        const shard = await getShard(
          `${SEARCH_BASE}/${language}/${encodeURIComponent(searchShardName(token))}.json`,
          searchShardSchema,
        );
        return matchPrefix(shard, token);
      }),
    );
    for (const [doc, keys] of intersectHits(perToken)) all.set(doc, keys);
  }
  return all;
}
