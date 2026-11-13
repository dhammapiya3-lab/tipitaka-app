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
} from "@/lib/schemas";
import type {
  DictionaryId,
  DictionaryIndex,
  DpdEntry,
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

function vriShard(kind: "t" | "c", n: number): Promise<Record<string, unknown>> {
  const url = `/data/vri/${kind}-${n}.json`;
  let promise = vriShardCache.get(url);
  if (!promise) {
    promise = getJson(url).then((data) => {
      if (typeof data !== "object" || data === null) throw new Error("VRI 자료 형식이 맞지 않습니다");
      return data as Record<string, unknown>;
    });
    vriShardCache.set(url, promise);
    promise.catch(() => vriShardCache.delete(url));
  }
  return promise;
}

const vriTextBodySchema = z.object({
  s: z.array(z.unknown()),
  p: z.array(z.tuple([z.string(), z.string(), z.string()])).default([]),
});

/** 책 쪽 번호: [문장 번호, 판(P·M·T·V), 권.쪽] — 쪽이 바뀌는 문장마다 */
export async function fetchPageMarks(suttaId: string): Promise<[string, string, string][]> {
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

export async function fetchSuttaText(suttaId: string, editionId: string): Promise<SuttaText> {
  if (editionId === VRI_EDITION_ID) {
    const { t } = await vriEntry(suttaId);
    const shard = await vriShard("t", t);
    const body = vriTextBodySchema.parse(shard[suttaId]);
    return suttaTextSchema.parse({ suttaId, editionId, segments: body.s });
  }
  const data = await getJson(suttaUrl(suttaId, editionId, ".json"));
  // 복사를 막아 둔 번역은 감싸 둔 글을 풀어서 같은 검사를 한다
  const sealed = sealedSuttaTextSchema.safeParse(data);
  if (sealed.success) {
    const { sealed: body, ...ids } = sealed.data;
    return suttaTextSchema.parse({ ...ids, segments: unseal(body, ids.suttaId, ids.editionId) });
  }
  return suttaTextSchema.parse(data);
}

export async function fetchSuttaNotes(suttaId: string, editionId: string): Promise<SuttaNotes> {
  return suttaNotesSchema.parse(await getJson(suttaUrl(suttaId, editionId, ".notes.json")));
}

let suttaIndexPromise: Promise<SuttaIndexEntry[]> | null = null;

/** 경 읽기 화면용 목록 — 한 번만 받는다 */
export function fetchSuttaIndex(): Promise<SuttaIndexEntry[]> {
  if (!suttaIndexPromise) {
    suttaIndexPromise = getJson("/data/sutta-index.json").then((data) => suttaIndexSchema.parse(data));
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
    extrasPromise = getJson("/data/extras.json").then((data) => extrasSchema.parse(data));
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
export async function fetchCommentary(suttaId: string, layer: CommentaryLayer): Promise<SuttaCommentary> {
  const { c } = await vriEntry(suttaId);
  if (c === null) throw new Error("주석 자료가 없습니다");
  const shard = await vriShard("c", c);
  const both = shard[suttaId] as Record<string, unknown> | undefined;
  return suttaCommentarySchema.parse(both?.[layer]);
}

const editionInfoCache = new Map<string, Promise<EditionInfo | null>>();

/** 판본 정보 창의 소개 글 — 없으면 null */
export function fetchEditionInfo(editionId: string): Promise<EditionInfo | null> {
  let promise = editionInfoCache.get(editionId);
  if (!promise) {
    promise = fetch(`/data/edition-info/${encodeURIComponent(editionId)}.json`).then(async (res) => {
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
function getShard<T extends z.ZodType>(url: string, schema: T): Promise<z.infer<T>> {
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

async function fetchDpdEntries(index: DictionaryIndex, ids: number[]): Promise<DpdEntry[]> {
  const shards = [...new Set(ids.map((id) => Math.floor(id / index.dpdShardSize)))];
  const loaded = await Promise.all(
    shards.map((n) => getShard(`${DICT_BASE}/dpd/${n}.json`, dpdShardSchema)),
  );
  const byId = new Map<number, DpdEntry>();
  for (const shard of loaded) for (const entry of Object.values(shard)) byId.set(entry.id, entry);
  return ids.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
}

async function fetchPlain(
  index: DictionaryIndex,
  dict: PlainDictionaryId,
  candidates: string[],
): Promise<PlainEntry[]> {
  const split = new Set(index.split[dict]);
  const found = await Promise.all(
    candidates.map(async (headword) => {
      const shard = await getShard(
        `${DICT_BASE}/${dict}/${shardOf(headword, split)}.json`,
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
}

const PLAIN_DICTIONARIES: PlainDictionaryId[] = ["kpts", "pts", "mm"];

async function lookupIds(index: DictionaryIndex, form: string): Promise<number[]> {
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
  const withIds = await Promise.all(forms.map(async (f) => ({ f, ids: await lookupIds(index, f) })));
  const best = withIds.find((x) => x.ids.length > 0) ?? withIds[0];
  return { form: best.f, ids: best.ids, alternatives: forms.filter((f) => f !== best.f) };
}

/**
 * 단어 하나를 찾는다.
 * 1) DPD 의 "변화형 → 표제어" 표로 표제어를 찾고 (못 찾으면 빠알리 기호 없이 다시)
 * 2) 그 표제어의 기본형(번호 뗀 lemma)과 단어 자체로 K-PTS·PTS·미얀마 사전을 찾는다.
 */
export async function lookupWord(query: string, dicts: DictionaryId[]): Promise<WordLookup> {
  const typed = normalizeWord(query);
  const empty: WordLookup = {
    query,
    normalized: typed,
    alternatives: [],
    dpd: [],
    kpts: [],
    pts: [],
    mm: [],
  };
  if (!typed) return empty;

  const index = await fetchDictionaryIndex();
  const { form: normalized, ids, alternatives } = await resolveForm(index, typed);
  const dpd = await fetchDpdEntries(index, ids);
  const candidates = [
    ...new Set([normalized, ...dpd.map((e) => normalizeWord(cleanLemma(e.lemma)))]),
  ].filter(Boolean);

  const plain = await Promise.all(
    PLAIN_DICTIONARIES.map((id) => (dicts.includes(id) ? fetchPlain(index, id, candidates) : [])),
  );
  return {
    ...empty,
    normalized,
    alternatives,
    dpd: dicts.includes("dpd") ? dpd : [],
    ...Object.fromEntries(PLAIN_DICTIONARIES.map((id, i) => [id, plain[i]])),
  };
}

/** DPD 표제어의 어형 변화 목록 (펼칠 때만 받는다) */
let templatesPromise: Promise<Record<string, DpdTemplate>> | null = null;

/** DPD 어형 변화표 틀 — 한 번만 받는다 */
export function fetchDpdTemplates(): Promise<Record<string, DpdTemplate>> {
  if (!templatesPromise) {
    templatesPromise = getJson(`${DICT_BASE}/dpd-templates.json`).then((d) => dpdTemplatesSchema.parse(d));
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
export async function searchText(query: string, languages: Language[]): Promise<SearchHits> {
  const all: SearchHits = new Map();
  for (const language of languages) {
    const tokens = tokenize(query, language).filter((t) => [...t].length >= minQueryLength(t));
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
