import { z } from "zod";
import type {
  Catalog,
  CatalogNode,
  CatalogSutta,
  DictionaryIndex,
  DpdEntry,
  Edition,
  Footnote,
  InlinePart,
  Nikaya,
  Segment,
  SuttaNissaya,
  SuttaNotes,
  SuttaText,
} from "@/types";

export const languageSchema = z.enum(["pli", "ko", "en"]);

export const editionSchema: z.ZodType<Edition> = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  badge: z.string().min(1),
  language: languageSchema,
  translator: z.string().nullable(),
  license: z.string().nullable(),
  allowCopy: z.boolean(),
});

export const editionsSchema = z.array(editionSchema);

export const inlinePartSchema: z.ZodType<InlinePart> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("bold"), text: z.string() }),
  z.object({ type: z.literal("em"), text: z.string() }),
  z.object({ type: z.literal("note"), mark: z.string().min(1) }),
]);

export const segmentSchema: z.ZodType<Segment> = z.object({
  key: z.string().regex(/^[a-z]+[\d.\-]*:[\d.\-]+$/),
  parts: z.array(inlinePartSchema),
});

export const suttaTextSchema: z.ZodType<SuttaText> = z.object({
  suttaId: z.string().min(1),
  editionId: z.string().min(1),
  segments: z.array(segmentSchema),
});

/** 복사를 막아 둔 번역의 본문 파일 — segments 를 lib/seal 로 감싼 것 */
export const sealedSuttaTextSchema = z.object({
  suttaId: z.string().min(1),
  editionId: z.string().min(1),
  sealed: z.string().min(1),
});

export const footnoteSchema: z.ZodType<Footnote> = z.object({
  mark: z.string().min(1),
  key: z.string().min(1),
  parts: z.array(inlinePartSchema),
});

export const suttaNotesSchema: z.ZodType<SuttaNotes> = z.object({
  suttaId: z.string().min(1),
  editionId: z.string().min(1),
  notes: z.array(footnoteSchema),
});

export const catalogSuttaSchema: z.ZodType<CatalogSutta> = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  name: z.string(),
  nameKo: z.string().nullable(),
  editions: z.array(z.string()),
  noteEditions: z.array(z.string()),
  nissaya: z.array(z.string()),
  grammar: z.array(z.string()),
});

export const suttaNissayaSchema: z.ZodType<SuttaNissaya> = z.object({
  suttaId: z.string().min(1),
  editionId: z.string().min(1),
  entries: z.record(z.string(), z.string()),
});

export const catalogNodeSchema: z.ZodType<CatalogNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    name: z.string().nullable(),
    nameKo: z.string().nullable(),
    description: z.string().nullable(),
    range: z.string().nullable(),
    children: z.array(catalogNodeSchema),
    suttas: z.array(catalogSuttaSchema),
  }),
);

export const nikayaSchema: z.ZodType<Nikaya> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  nameKo: z.string().min(1),
  nodes: z.array(catalogNodeSchema),
});

export const catalogSchema: z.ZodType<Catalog> = z.object({
  nikayas: z.array(nikayaSchema),
});

// ── 사전 ────────────────────────────────────────────────────
export const dictionaryIdSchema = z.enum(["dpd", "kpts", "pts", "mm"]);

export const dictionaryIndexSchema: z.ZodType<DictionaryIndex> = z.object({
  version: z.string(),
  dictionaries: z.array(
    z.object({
      id: dictionaryIdSchema,
      label: z.string(),
      license: z.string().nullable(),
      source: z.string(),
    }),
  ),
  split: z.object({
    lookup: z.array(z.string()),
    fold: z.array(z.string()),
    kpts: z.array(z.string()),
    pts: z.array(z.string()),
    mm: z.array(z.string()),
  }),
  dpdShardSize: z.number().int().positive(),
});

export const dpdEntrySchema: z.ZodType<DpdEntry> = z.object({
  id: z.number().int(),
  lemma: z.string(),
  pos: z.string(),
  grammar: z.string(),
  meaning1: z.string(),
  meaning2: z.string(),
  meaningLit: z.string(),
  constructionSummary: z.string(),
  construction: z.string(),
  root: z.string(),
  base: z.string(),
  compound: z.string(),
  derivative: z.string(),
  antonym: z.string(),
  synonym: z.string(),
  variant: z.string(),
  commentary: z.string(),
  notes: z.string(),
  sanskrit: z.string(),
  examples: z.array(z.object({ text: z.string(), source: z.string() })),
  hasInflections: z.boolean(),
});

/** 조각 파일들 */
export const lookupShardSchema = z.record(z.string(), z.array(z.number().int()));
export const dpdShardSchema = z.record(z.string(), dpdEntrySchema);
export const inflectionShardSchema = z.record(z.string(), z.string());
export const plainShardSchema = z.record(z.string(), z.array(z.string()));
/** 검색 색인 조각: 단어 → { "경|판본" → 문장 번호들 } */
export const searchShardSchema = z.record(z.string(), z.record(z.string(), z.array(z.string())));
/** 빠알리 기호를 뗀 글자 → 실제 형태들 */
export const foldShardSchema = z.record(z.string(), z.array(z.string()));
