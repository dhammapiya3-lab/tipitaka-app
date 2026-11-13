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
  SuttaCommentary,
  EditionInfo,
  SuttaExtras,
  SuttaIndexEntry,
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

export const inlinePartSchema: z.ZodType<InlinePart> = z.discriminatedUnion(
  "type",
  [
    z.object({ type: z.literal("text"), text: z.string() }),
    z.object({ type: z.literal("bold"), text: z.string() }),
    z.object({ type: z.literal("em"), text: z.string() }),
    z.object({ type: z.literal("note"), mark: z.string().min(1) }),
  ],
);

export const segmentSchema: z.ZodType<Segment> = z.object({
  key: z.string().regex(/^[a-z]+(?:-[a-z]+)*[\d.\-]*:[\d.\-]+$/),
  parts: z.array(inlinePartSchema),
  unsure: z.boolean().optional(),
});

export const suttaTextSchema: z.ZodType<SuttaText> = z.object({
  suttaId: z.string().min(1),
  editionId: z.string().min(1),
  segments: z.array(segmentSchema),
  preface: z.array(z.string()).optional(),
  notes: z.lazy(() => z.array(footnoteSchema)).optional(),
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
  commentary: z.array(z.enum(["attha", "tika"])).optional(),
});

export const suttaNissayaSchema: z.ZodType<SuttaNissaya> = z.object({
  suttaId: z.string().min(1),
  editionId: z.string().min(1),
  entries: z.record(z.string(), z.string()),
});

export const suttaIndexSchema: z.ZodType<SuttaIndexEntry[]> = z.array(
  z.object({
    id: z.string().min(1),
    sourceId: z.string().min(1),
    name: z.string(),
    nameKo: z.string().nullable(),
    editions: z.array(z.string()),
    noteEditions: z.array(z.string()),
    nissaya: z.array(z.string()),
    grammar: z.array(z.string()),
    commentary: z.array(z.enum(["attha", "tika"])).optional(),
    vri: z.object({ t: z.number(), c: z.number().nullable() }).optional(),
    nikaya: z.string().min(1),
    trail: z.object({
      nikayaName: z.string().min(1),
      groups: z.array(
        z.object({ id: z.string().min(1), label: z.string().min(1) }),
      ),
      groupPages: z.boolean(),
    }),
  }),
);

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
  description: z.string().nullable(),
  introduction: z.string().nullable(),
  nodes: z.array(catalogNodeSchema),
});

export const catalogSchema: z.ZodType<Catalog> = z.object({
  nikayas: z.array(nikayaSchema),
});

// ── 사전 ────────────────────────────────────────────────────
export const dictionaryIdSchema = z.enum([
  "dpd",
  "kpts",
  "pts",
  "mm",
  "peu",
  "cone",
]);

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
    /** Pali English Ultimate — 따로 만든다 (scripts/build-peu.ts). 없으면 빈 목록 */
    peu: z.array(z.string()).default([]),
    /** Margaret Cone — 따로 만든다 (scripts/build-peu.ts cone) */
    cone: z.array(z.string()).default([]),
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
  stem: z.string().optional(),
  pattern: z.string().optional(),
  fam: z
    .object({
      root: z.string().optional(),
      word: z.string().optional(),
      compound: z.array(z.string()).optional(),
      idiom: z.array(z.string()).optional(),
      set: z.array(z.string()).optional(),
    })
    .optional(),
});

export const dpdFamilyShardSchema = z.record(
  z.string(),
  z.object({
    head: z.string().optional(),
    words: z.array(z.tuple([z.number(), z.string(), z.string(), z.string()])),
  }),
);
export const dpdFreqShardSchema = z.record(
  z.string(),
  z.object({
    c: z.array(z.number()),
    b: z.array(z.number()).optional(),
    s: z.array(z.number()).optional(),
    m: z.array(z.number()).optional(),
    h: z.string(),
  }),
);
export const dpdFreqLayoutSchema = z.array(
  z.object({
    group: z.string().optional(),
    groupSpan: z.number().optional(),
    label: z.string().optional(),
    cells: z.array(
      z.union([
        z.object({
          src: z.enum(["c", "b", "s", "m"]),
          i: z.number(),
          rs: z.number(),
        }),
        z.object({ gap: z.literal(true) }),
        z.object({ void: z.literal(true) }),
      ]),
    ),
  }),
);

export const dpdTemplatesSchema = z.record(
  z.string(),
  z.object({ like: z.string(), rows: z.array(z.array(z.array(z.string()))) }),
);

/** 조각 파일들 */
export const lookupShardSchema = z.record(
  z.string(),
  z.array(z.number().int()),
);
export const dpdShardSchema = z.record(z.string(), dpdEntrySchema);
export const inflectionShardSchema = z.record(z.string(), z.string());
export const plainShardSchema = z.record(z.string(), z.array(z.string()));
/** 검색 색인 조각: 단어 → { "경|판본" → 문장 번호들 } */
export const searchShardSchema = z.record(
  z.string(),
  z.record(z.string(), z.array(z.string())),
);
/** 빠알리 기호를 뗀 글자 → 실제 형태들 */
export const foldShardSchema = z.record(z.string(), z.array(z.string()));

const extraItemSchema = z.object({
  title: z.string().min(1),
  note: z.string().nullish(),
  suttaId: z
    .string()
    .regex(/^[a-z]+[\d.\-]*$/)
    .nullish(),
  url: z.url().nullish(),
  by: z.string().nullish(),
});

/** 경 번호 → 참고 경전 · 해설 법문 · 기타 자료 (content/extras.json, public/data/extras.json) */
export const extrasSchema: z.ZodType<Record<string, SuttaExtras>> = z.record(
  z.string(),
  z.object({
    refs: z.array(extraItemSchema).optional(),
    talks: z.array(extraItemSchema).optional(),
    others: z.array(extraItemSchema).optional(),
  }),
);

export const suttaCommentarySchema: z.ZodType<SuttaCommentary> = z.object({
  suttaId: z.string().min(1),
  layer: z.enum(["attha", "tika"]),
  book: z.string().min(1),
  bookName: z.string().min(1),
  title: z.string().nullable(),
  nameKo: z.string().nullable(),
  editions: z.array(editionSchema),
  books: z.array(z.object({ id: z.string(), name: z.string() })),
  before: z.array(
    z.object({
      para: z.number(),
      vripara: z.string().nullable(),
      title: z.string().nullable().optional(),
      lines: z.array(z.array(inlinePartSchema)),
    }),
  ),
  after: z
    .array(
      z.object({
        para: z.number(),
        vripara: z.string().nullable(),
        title: z.string().nullable().optional(),
        lines: z.array(z.array(inlinePartSchema)),
      }),
    )
    .default([]),
  links: z.array(
    z.object({
      key: z.string(),
      word: z.string(),
      para: z.number(),
      line: z.number(),
    }),
  ),
  paras: z.array(
    z.object({
      para: z.number(),
      book: z.string().optional(),
      vripara: z.string().nullable(),
      refs: z.array(z.string()),
      lines: z.array(z.array(inlinePartSchema)),
      lineRefs: z.array(z.array(z.string())),
      tr: z.record(z.string(), z.array(z.array(inlinePartSchema).nullable())),
    }),
  ),
});

export const editionInfoSchema: z.ZodType<EditionInfo> = z.object({
  editionId: z.string().min(1),
  groups: z.array(
    z.object({
      kind: z.enum(["text", "nissaya", "grammar"]),
      sections: z.array(
        z.object({
          title: z.string(),
          paragraphs: z.array(z.array(inlinePartSchema)),
        }),
      ),
    }),
  ),
});
