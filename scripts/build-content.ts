/**
 * 1층 원본 → 3층 앱이 쓰는 파일.
 *   원본: 원래 앱의 자료를 사이트와 같은 폴더 구조로 모은 곳 (기본 content/theravada-app, scripts/paths.ts)
 *         edition-registry.json · sutta_pitaka/<니까야>/structure.json · editions.json · <판본 폴더>/<경>_<root|translation|comment>-<판본>.json
 *         쿳다까 니까야는 책마다 sutta_pitaka/khuddaka_nikaya/<책>/editions.json 이 따로 있다.
 *   결과: src/data/catalog.json · src/data/editions.json · public/data/suttas/<경>/<판본>.json (+ .notes.json)
 * 문장 번호·각주가 어긋나면 아무것도 쓰지 않고 어디가 틀렸는지 알려 준다.
 * 원래 사이트의 각주 파일 자체가 깨진 경우만 경고로 알리고 그 각주는 빼고 넘어간다.
 *
 * 사용법: pnpm build:content   (원본 위치를 바꾸려면 CONTENT_SOURCE=<폴더> pnpm build:content)
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  extrasSchema,
  catalogSchema,
  editionsSchema,
  editionInfoSchema,
  suttaCommentarySchema,
  suttaIndexSchema,
  suttaNissayaSchema,
  suttaNotesSchema,
  suttaTextSchema,
} from "../src/lib/schemas";
import { searchShardName, tokenize, type SearchShard } from "../src/lib/search";
import { noteMarks, paragraphOf, parseInline, plainText, rowKind, splitNotes, toSuttaId } from "../src/lib/segments";
import { INLINE_SUTTA_LIMIT } from "../src/lib/constants";
import { seal } from "../src/lib/seal";
import { SOURCE_ROOT } from "./paths";
import { suttaFilePath } from "./source-paths";
import type {
  Catalog,
  CatalogNode,
  CatalogSutta,
  Edition,
  EditionInfo,
  Footnote,
  Language,
  Segment,
  SuttaCommentary,
  SuttaNissaya,
  SuttaNotes,
  SuttaIndexEntry,
  SuttaText,
} from "../src/types";

const SOURCE = path.join(SOURCE_ROOT, "sutta_pitaka");
const NISSAYA_SOURCE = path.join(SOURCE_ROOT, "sutta_pitaka_nissaya");
const GRAMMAR_SOURCE = path.join(SOURCE_ROOT, "sutta_pitaka_paligrammar");
const ROOT = process.cwd();
const OUT_DATA = path.join(ROOT, "src/data");
const OUT_SUTTAS = path.join(ROOT, "public/data/suttas");
const OUT_SEARCH = path.join(ROOT, "public/data/search");
/** 빠알리 원문 판본. 번역 문장 번호는 모두 이 판본에 있어야 한다. */
const ROOT_EDITION = "pli-ms";
/** content/vri/<경>.json 의 주석서·복주석서 한 권 (scripts/import-vri.ts 가 쓰는 모양) */
const vriCommentarySchema = z.object({
  book: z.string(),
  bookName: z.string(),
  paras: z.array(
    z.object({
      para: z.number(),
      vripara: z.coerce.string().nullable(),
      refs: z.array(z.string()),
      lines: z.array(z.string()),
      lineRefs: z.array(z.array(z.string())),
    }),
  ),
  wordLinks: z.array(z.tuple([z.string(), z.string(), z.number(), z.number()])).default([]),
  /** 이 경 앞의, 어느 경에도 붙지 않은 주석(책·품 머리말, 이야기 등) */
  before: z
    .array(z.object({ para: z.number(), vripara: z.coerce.string().nullable(), lines: z.array(z.string()) }))
    .optional(),
});
/**
 * content/vri/<경>.ko.json — 주석서·복주석서 번역 (사람이 쓰는 파일).
 * translations: 번역자(판본) id → 이름·배지와 층별 "문단 번호 → 줄마다 번역"
 */
const vriKoLines = z.record(z.string(), z.array(z.string().nullable()));
const vriKoSchema = z.object({
  _설명: z.string().optional(),
  attha: z.object({ title: z.string().optional(), nameKo: z.string().optional() }).optional(),
  tika: z.object({ title: z.string().optional(), nameKo: z.string().optional() }).optional(),
  translations: z
    .record(
      z.string(),
      z.object({
        label: z.string().min(1),
        badge: z.string().min(1),
        attha: vriKoLines.default({}),
        tika: vriKoLines.default({}),
      }),
    )
    .default({}),
});

const NIKAYAS = [
  { id: "dn", folder: "digha_nikaya", name: "Dīgha Nikāya", nameKo: "디가 니까야" },
  { id: "mn", folder: "majjhima_nikaya", name: "Majjhima Nikāya", nameKo: "맛지마 니까야" },
  { id: "sn", folder: "samyutta_nikaya", name: "Saṁyutta Nikāya", nameKo: "상윳따 니까야" },
  { id: "an", folder: "anguttara_nikaya", name: "Aṅguttara Nikāya", nameKo: "앙굿따라 니까야" },
  { id: "kn", folder: "khuddaka_nikaya", name: "Khuddaka Nikāya", nameKo: "쿳다까 니까야" },
];

/** 쿳다까 니까야 책 → 폴더 (원래 앱과 같은 이름) */
const KN_BOOKS: Record<string, string> = {
  kp: "khuddakapatha", dhp: "dhammapada", ud: "udana", iti: "itivuttaka", snp: "suttanipata",
  vv: "vimanavatthu", pv: "petavatthu", thag: "theragatha", thig: "therigatha",
  "tha-ap": "thera-apadana", "thi-ap": "theri-apadana", bv: "buddhavamsa", cp: "cariyapitaka",
  ja: "jataka", mnd: "mahaniddesa", cnd: "culaniddesa", ps: "patisambhidamagga",
  ne: "nettippakaraṇa", pe: "petakopadesa", mil: "milindapanha",
};

/** 원래 앱 판본 정보의 언어 이름 → 앱의 언어 코드 */
const LANGUAGES: Record<string, Language> = { 빠알리어: "pli", 한국어: "ko", 영어: "en" };

// ── 원본 자료 형식 ────────────────────────────────────────────
interface RawNode {
  id: string;
  name?: string;
  nameKo?: string;
  description?: string;
  range?: string;
  children?: RawNode[];
  suttas?: { id: string; name: string; nameKo?: string }[];
}

const rawNodeSchema: z.ZodType<RawNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string().optional(),
    nameKo: z.string().optional(),
    description: z.string().optional(),
    range: z.string().optional(),
    children: z.array(rawNodeSchema).optional(),
    suttas: z
      .array(z.object({ id: z.string(), name: z.string(), nameKo: z.string().optional() }))
      .optional(),
  }),
);
const rawEditionEntrySchema = z.object({
  folder: z.string(),
  edition: z.string(),
  footnote: z.string().optional(),
});
/** editions.json 은 보통 목록이지만, 책 번호로 묶은 꼴({ "mil": [...] }, 밀린다빤하)도 있다 → 하나로 펼친다 */
const rawEditionListSchema = z
  .union([z.array(rawEditionEntrySchema), z.record(z.string(), z.array(rawEditionEntrySchema))])
  .transform((v) => (Array.isArray(v) ? v : Object.values(v).flat()));
const rawTextSchema = z.record(z.string(), z.string());
const registrySchema = z.record(
  z.string(),
  z.object({
    label: z.string(),
    badge: z.string().optional(),
    language: z.string(),
    allowCopy: z.boolean().optional(),
  }),
);
type EditionList = z.infer<typeof rawEditionListSchema>;

// ── 읽기 도우미 ──────────────────────────────────────────────
const errors: string[] = [];
const warnings: string[] = [];
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const orNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

/**
 * 경이 든 폴더와 판본 목록. 쿳다까 니까야는 책마다 따로 있다.
 * base 는 본문(sutta_pitaka) 또는 대역(sutta_pitaka_nissaya) 폴더.
 */
const editionLists = new Map<string, { dir: string; list: EditionList }>();
function editionsFor(nikaya: string, suttaId: string, base = SOURCE) {
  const book = nikaya === "khuddaka_nikaya" ? suttaId.match(/^([a-z-]+?)(?=\d|$)/)?.[1] : undefined;
  const dir = path.join(base, nikaya, ...(book && KN_BOOKS[book] ? [KN_BOOKS[book]] : []));
  let found = editionLists.get(dir);
  if (!found) {
    const file = path.join(dir, "editions.json");
    found = { dir, list: existsSync(file) ? rawEditionListSchema.parse(readJson(file)) : [] };
    editionLists.set(dir, found);
  }
  return found;
}

/** sub: 판본 폴더 안의 경 경로 (suttaFilePath — 예: sn1/sn1.1) */
function readText(dir: string, folder: string, sub: string, edition: string) {
  for (const kind of ["root", "translation"]) {
    const file = path.join(dir, folder, `${sub}_${kind}-${edition}.json`);
    if (existsSync(file)) return applyLineMap(edition, rawTextSchema.parse(readJson(file)));
  }
  return null;
}

/**
 * 줄 대응표(scripts/line-maps/<판본>.json): 게송을 다르게 나눈 판본(PTS 등)의 줄을
 * 마하상기띠본의 같은 글 줄 번호로 옮긴다. 원본 파일은 그대로 두고 사이트 자료에만 적용한다.
 */
const lineMaps = new Map<string, Record<string, string>>();
function applyLineMap(edition: string, raw: Record<string, string>): Record<string, string> {
  if (!lineMaps.has(edition)) {
    const file = path.join(process.cwd(), "scripts", "line-maps", `${edition}.json`);
    const map = existsSync(file) ? z.record(z.string(), z.string()).parse(readJson(file)) : {};
    delete map._설명;
    lineMaps.set(edition, map);
  }
  const map = lineMaps.get(edition) ?? {};
  if (!Object.keys(map).some((key) => key in raw)) return raw;
  return Object.fromEntries(Object.entries(raw).map(([key, text]) => [map[key] ?? key, text]));
}

function toSegments(raw: Record<string, string>): Segment[] {
  return Object.entries(raw)
    .map(([key, text]) => ({ key, parts: parseInline(text) }))
    .filter((s) => s.parts.length > 0);
}

// ── 변환 ────────────────────────────────────────────────────
const registry = registrySchema.parse(readJson(path.join(SOURCE_ROOT, "edition-registry.json")));
const editionById = new Map<string, Edition>(
  Object.entries(registry).map(([id, e]) => {
    const language = LANGUAGES[e.language];
    if (!language) errors.push(`${id}: 알 수 없는 언어 "${e.language}"`);
    return [
      id,
      {
        id,
        label: e.label,
        // 원래 앱의 badge 는 "김)" 처럼 닫는 괄호가 붙어 있어 뗀다. 없으면 이름 앞 두 글자.
        badge: (e.badge ?? "").replace(/\)\s*$/, "").trim() || e.label.slice(0, 2),
        language: language ?? "ko",
        translator: language === "pli" ? null : e.label,
        license: null,
        allowCopy: e.allowCopy ?? true,
      },
    ];
  }),
);
// VRI 6차 결집본 — 원래 앱에 없던 판본이라 판본 정보를 여기서 정한다 (출처는 정보 페이지)
const VRI_EDITION: Edition = {
  id: "pli-vri",
  label: "VRI 제6차 결집본",
  badge: "V",
  language: "pli",
  translator: null,
  license: "VRI Chaṭṭha Saṅgāyana Tipiṭaka — 비영리 무료, 출처 표시",
  allowCopy: true,
};
editionById.set(VRI_EDITION.id, VRI_EDITION);
const vriSchema = z.object({
  segments: z.record(z.string(), z.string()),
  attha: vriCommentarySchema.nullable(),
  tika: vriCommentarySchema.nullable(),
  tika2: vriCommentarySchema.nullable().optional(),
  unsure: z.array(z.string()).default([]),
});
const commentaryFiles: SuttaCommentary[] = [];
const vriTexts: SuttaText[] = [];
const vriUnsure = new Map<string, string[]>();
/** 주석 번역 판본 id — 판본 정보 창의 소개 글(translator_info)을 함께 옮긴다 */
const commentaryEditionIds = new Set<string>();
const usedEditions = new Set<string>();
const texts: SuttaText[] = [];
const notesFiles: SuttaNotes[] = [];
/** 대역·문법분석 파일 (같은 모양) */
const analysisFiles: (SuttaNissaya & { kind: "nissaya" | "grammar" })[] = [];

function buildSutta(
  nikaya: (typeof NIKAYAS)[number],
  raw: { id: string; name: string; nameKo?: string },
): CatalogSutta {
  const id = toSuttaId(raw.id);
  const { dir, list: editionList } = editionsFor(nikaya.folder, id);
  const sub = suttaFilePath(raw.id);
  const sutta: CatalogSutta = {
    id,
    sourceId: raw.id,
    name: raw.name,
    nameKo: orNull(raw.nameKo),
    editions: [],
    noteEditions: [],
    nissaya: [],
    grammar: [],
  };

  const rootEntry = editionList.find((e) => e.edition === ROOT_EDITION);
  const root = rootEntry ? readText(dir, rootEntry.folder, sub, ROOT_EDITION) : null;

  for (const entry of editionList) {
    const raw = entry.edition === ROOT_EDITION ? root : readText(dir, entry.folder, sub, entry.edition);
    if (!raw) continue;
    const where = `${id} ${entry.edition}`;
    if (!editionById.has(entry.edition)) errors.push(`${where}: edition-registry.json 에 판본 정보가 없습니다`);
    if (!root) {
      errors.push(`${where}: 빠알리 원문(${ROOT_EDITION}) 없이 번역만 있습니다`);
      continue;
    }
    // 번역에 원문에 없는 문장 번호가 있으면 오류. 다른 빠알리 판본(PTS 등)은 줄 나눔이 달라 경고만 한다.
    const extra = Object.keys(raw).filter((key) => !(key in root));
    if (extra.length) {
      const message = `${where}: 원문에 없는 문장 번호 ${extra.slice(0, 5).join(", ")}`;
      if (editionById.get(entry.edition)?.language === "pli") warnings.push(message);
      else errors.push(message);
    }

    const segments = toSegments(raw);
    texts.push({ suttaId: id, editionId: entry.edition, segments });
    sutta.editions.push(entry.edition);
    usedEditions.add(entry.edition);

    // 각주: 본문의 (문장, 각주 번호)와 각주 파일이 1:1 로 맞아야 한다.
    // 같은 번호의 각주가 두 문장에 붙기도 해서(dn22 71번) 번호만으로는 찾지 않는다.
    const marks = new Set(segments.flatMap((s) => noteMarks(s.parts).map((m) => `${s.key} ${m})`)));
    const noteFile = entry.footnote
      ? path.join(dir, entry.footnote, `${sub}_comment-${entry.edition}.json`)
      : null;
    if (!noteFile || !existsSync(noteFile)) {
      if (marks.size) errors.push(`${where}: 각주 번호 ${marks.size}개가 있는데 각주 파일이 없습니다`);
      continue;
    }
    let noteJson: unknown;
    try {
      noteJson = readJson(noteFile);
    } catch {
      // 원래 사이트의 파일 자체가 깨졌다(따옴표 누락 등). 이 판본의 각주 번호는 누를 수 없게 둔다.
      warnings.push(`${where}: 원래 사이트의 각주 파일 형식이 깨져 각주 ${marks.size}개를 뺐습니다 (${path.basename(noteFile)})`);
      continue;
    }
    const notes: Footnote[] = [];
    for (const [key, text] of Object.entries(rawTextSchema.parse(noteJson))) {
      const { notes: split, leftover } = splitNotes(text);
      // 각주 번호 앞의 따옴표 한 글자는 원본 입력 실수라 무시한다.
      if (split.length === 0) {
        warnings.push(`${where} ${key}: 각주 파일에 각주가 아닌 글이 있어 뺐습니다 "${leftover.slice(0, 20)}"`);
        continue;
      }
      if (leftover && !/^[\s‘’“”'"]*$/.test(leftover)) {
        errors.push(`${where} ${key}: 각주 번호 없이 시작하는 글자 "${leftover.slice(0, 20)}"`);
      }
      for (const note of split) {
        if (!marks.has(`${key} ${note.mark})`)) {
          errors.push(`${where} ${key}: 각주 ${note.mark}) 가 본문의 같은 문장에 없습니다`);
        }
        notes.push({ mark: note.mark, key, parts: parseInline(note.text) });
      }
    }
    const missing = [...marks].filter((m) => !notes.some((n) => `${n.key} ${n.mark})` === m));
    if (missing.length) errors.push(`${where}: 각주 내용이 없는 곳 ${missing.join(", ")}`);
    notesFiles.push({ suttaId: id, editionId: entry.edition, notes });
    sutta.noteEditions.push(entry.edition);
  }

  // VRI 6차 결집본 원문과 주석서·복주석서 (content/vri/<경>.json — `pnpm import:vri` 로 만든다)
  const vriFile = path.join(ROOT, "content", "vri", `${id}.json`);
  if (existsSync(vriFile) && root) {
    const vri = vriSchema.parse(readJson(vriFile));
    const where = `${id} VRI`;
    const extra = Object.keys(vri.segments).filter((key) => !(key in root));
    if (extra.length) errors.push(`${where}: 원문에 없는 문장 번호 ${extra.slice(0, 5).join(", ")}`);
    // VRI 본문·주석은 경마다 파일을 만들지 않고 묶음 파일(public/data/vri/)에 모은다 — 호스팅 파일 수 한도(2만 개)
    vriTexts.push({ suttaId: id, editionId: VRI_EDITION.id, segments: toSegments(vri.segments) });
    if (vri.unsure.length) vriUnsure.set(id, vri.unsure);
    const rootParas = new Set(Object.keys(root).map((key) => paragraphOf(key, id)));
    sutta.editions.push(VRI_EDITION.id);
    usedEditions.add(VRI_EDITION.id);
    // 복주석서가 두 종류면(디가 옛·새 복주석서) 한 층에 이어 붙이고, 문단마다 어느 책인지 적는다
    const tikaBoth = (() => {
      const [a, b] = [vri.tika, vri.tika2 ?? null];
      const tag = (c: NonNullable<typeof a>) => c.paras.map((p) => ({ ...p, book: c.book }));
      if (a && b) {
        // 두 복주석서를 경 문단 차례대로 섞는다 — 같은 경 문단의 옛·새 복주석서 풀이가 나란히 오게
        const order = new Map<string, number>();
        Object.keys(root).forEach((key) => {
          const p = paragraphOf(key, id);
          if (!order.has(p)) order.set(p, order.size);
        });
        const keyed = (list: ReturnType<typeof tag>, book: number) => {
          let at = -1;
          return list.map((p, i) => {
            const k = Math.min(...p.refs.map((r) => order.get(r) ?? Infinity));
            if (Number.isFinite(k)) at = k;
            return { p, k: at, book, i };
          });
        };
        const sorted = [...keyed(tag(a), 0), ...keyed(tag(b), 1)].sort(
          (x, y) => x.k - y.k || x.book - y.book || x.i - y.i,
        );
        // 낱말 연결은 문단 순번을 쓰므로 옛 복주석서 쪽 순번을 새 차례로 옮긴다
        const moved = new Map(sorted.flatMap((x, n) => (x.book === 0 ? [[x.i, n] as const] : [])));
        const wordLinks = a.wordLinks.map(([k, w, pi, li]) => [k, w, moved.get(pi) ?? pi, li] as typeof a.wordLinks[number]);
        // 앞 부분(머리말 등)도 두 책 것을 이어 붙인다
        const before = [...(a.before ?? []), ...(b.before ?? [])];
        return { ...a, paras: sorted.map((x) => x.p), books: [a, b], wordLinks, before };
      }
      if (b) return { ...b, paras: tag(b), books: [b] };
      if (a) return { ...a, paras: tag(a), books: [a] };
      return null;
    })();
    for (const layer of ["attha", "tika"] as const) {
      const c = layer === "tika" ? tikaBoth : vri.attha ? { ...vri.attha, books: [vri.attha] } : null;
      if (!c) continue;
      const koFile = path.join(ROOT, "content", "vri", `${id}.ko.json`);
      const ko = existsSync(koFile) ? vriKoSchema.parse(readJson(koFile)) : undefined;
      const translators = Object.entries(ko?.translations ?? {});
      for (const [tid, t] of translators) {
        if (!/^kor-[a-z0-9-]+$/.test(tid)) errors.push(`${id}.ko.json: 번역 판본 id "${tid}" 는 kor-영문소문자 형식이어야 합니다`);
        for (const para of Object.keys(t[layer])) {
          if (!c.paras.some((p) => String(p.para) === para)) errors.push(`${id}.ko.json ${tid} ${layer}: ${c.book} 에 문단 ${para} 이 없습니다`);
        }
      }
      const paras = c.paras.map((p) => {
        const bad = p.refs.filter((ref) => !rootParas.has(ref));
        if (bad.length) errors.push(`${where} ${c.book} ${p.para}: 경에 없는 문단 ${bad.join(", ")}`);
        const tr: Record<string, (ReturnType<typeof parseInline> | null)[]> = {};
        for (const [tid, t] of translators) {
          const koLines = t[layer][String(p.para)] ?? [];
          if (koLines.length > p.lines.length) {
            errors.push(`${id}.ko.json ${tid} ${layer} ${p.para}: 번역 줄(${koLines.length})이 원문 줄(${p.lines.length})보다 많습니다`);
          }
          if (koLines.some((line) => line?.trim())) {
            tr[tid] = p.lines.map((_, i) => (koLines[i]?.trim() ? parseInline(koLines[i]!) : null));
          }
        }
        return {
          para: p.para,
          ...("book" in p && typeof p.book === "string" && p.book !== c.book ? { book: p.book } : {}),
          vripara: p.vripara,
          refs: p.refs,
          lines: p.lines.map((line) => parseInline(line)),
          lineRefs: p.lineRefs,
          tr,
        };
      });
      const layerEditions: Edition[] = translators
        .filter(([, t]) => Object.keys(t[layer]).length > 0)
        .map(([tid, t]) => ({
          id: tid,
          label: t.label,
          badge: t.badge,
          language: "ko",
          translator: t.label,
          license: null,
          allowCopy: true,
        }));
      for (const e of layerEditions) commentaryEditionIds.add(e.id);
      commentaryFiles.push({
        suttaId: id,
        layer,
        book: c.book,
        bookName: c.bookName,
        title: ko?.[layer]?.title ?? null,
        nameKo: ko?.[layer]?.nameKo ?? null,
        editions: layerEditions,
        books: c.books.map((b) => ({ id: b.book, name: b.bookName })),
        before: (("before" in c ? c.before : undefined) ?? []).map((p) => ({
          para: p.para,
          vripara: p.vripara,
          lines: p.lines.map((line) => parseInline(line)),
        })),
        links: c.wordLinks
          .filter(([key]) => key in root)
          .map(([key, word, para, line]) => ({ key, word, para, line })),
        paras,
      });
      (sutta.commentary ??= []).push(layer);
    }
  }

  // 대역: <판본 폴더>/<경>_root-nissaya-<판본>.json, 문법분석: ..._root-paligrammar-<판본>.json
  // 빈 칸은 뺀다. 문장 번호는 원문에 있어야 한다.
  const analyses = [
    { kind: "nissaya", base: NISSAYA_SOURCE, file: "nissaya", label: "대역" },
    { kind: "grammar", base: GRAMMAR_SOURCE, file: "paligrammar", label: "문법분석" },
  ] as const;
  for (const a of analyses) {
    const found = editionsFor(nikaya.folder, id, a.base);
    for (const entry of found.list) {
      const file = path.join(found.dir, entry.folder, `${sub}_root-${a.file}-${entry.edition}.json`);
      if (!existsSync(file) || !root) continue;
      const where = `${id} ${a.label} ${entry.edition}`;
      if (!editionById.has(entry.edition)) errors.push(`${where}: edition-registry.json 에 판본 정보가 없습니다`);
      const entries = Object.fromEntries(
        Object.entries(rawTextSchema.parse(readJson(file))).filter(([, text]) => text.trim()),
      );
      const extra = Object.keys(entries).filter((key) => !(key in root));
      if (extra.length) errors.push(`${where}: 원문에 없는 문장 번호 ${extra.slice(0, 5).join(", ")}`);
      if (Object.keys(entries).length === 0) continue;
      analysisFiles.push({ kind: a.kind, suttaId: id, editionId: entry.edition, entries });
      sutta[a.kind].push(entry.edition);
      usedEditions.add(entry.edition);
    }
  }
  return sutta;
}

function buildNode(nikaya: (typeof NIKAYAS)[number], raw: RawNode): CatalogNode {
  return {
    id: raw.id,
    name: orNull(raw.name),
    nameKo: orNull(raw.nameKo),
    description: orNull(raw.description),
    range: orNull(raw.range),
    children: (raw.children ?? []).map((child) => buildNode(nikaya, child)),
    suttas: (raw.suttas ?? []).map((s) => buildSutta(nikaya, s)),
  };
}

const catalog: Catalog = {
  nikayas: NIKAYAS.map((nikaya) => {
    const nodes = z
      .array(rawNodeSchema)
      .parse(readJson(path.join(SOURCE, nikaya.folder, "structure.json")))
      .map((node) => buildNode(nikaya, node));
    // 니까야 소개(경전 목록의 한 줄 설명·ⓘ 단추의 소개 글) — 원래 앱의 intro.json
    const introPath = path.join(SOURCE, nikaya.folder, "intro.json");
    const intro = existsSync(introPath)
      ? z
          .object({ description: z.string().optional(), introduction: z.string().optional() })
          .parse(readJson(introPath))
      : {};
    return {
      id: nikaya.id,
      name: nikaya.name,
      nameKo: nikaya.nameKo,
      description: orNull(intro.description),
      introduction: orNull(intro.introduction),
      nodes,
    };
  }),
};

// 같은 주소가 두 번 나오면 경 하나가 다른 경을 가린다.
const allSuttas = catalog.nikayas.flatMap((n) => n.nodes.flatMap(function collect(node): CatalogSutta[] {
  return [...node.suttas, ...node.children.flatMap(collect)];
}));
const seen = new Set<string>();
for (const s of allSuttas) {
  if (seen.has(s.id)) errors.push(`${s.id}: 같은 경 번호가 목록에 두 번 있습니다`);
  seen.add(s.id);
}

if (errors.length) {
  console.error(`변환 실패 — 오류 ${errors.length}건. 아무 파일도 쓰지 않았습니다.`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// ── 쓰기 (쓰기 전에 앱이 읽을 형식인지 한 번 더 검사) ──────────────
// 판본 순서: 빠알리 → 한국어 → 영어, 같은 언어 안에서는 원래 판본 정보의 순서
const LANGUAGE_ORDER: Language[] = ["pli", "ko", "en"];
// VRI 6차 결집본은 빠알리 판본 중 맨 위 (마하상기띠본 · PTS 보다 먼저)
const editions: Edition[] = [VRI_EDITION, ...[...editionById.values()].filter((e) => e.id !== VRI_EDITION.id)]
  .filter((e) => usedEditions.has(e.id))
  .sort((a, b) => LANGUAGE_ORDER.indexOf(a.language) - LANGUAGE_ORDER.indexOf(b.language));
mkdirSync(OUT_DATA, { recursive: true });
writeFileSync(path.join(OUT_DATA, "catalog.json"), JSON.stringify(catalogSchema.parse(catalog)));
writeFileSync(path.join(OUT_DATA, "editions.json"), JSON.stringify(editionsSchema.parse(editions)));
// 경 읽기 화면용 목록 — 본문이 있는 경만, 목록 순서대로 (SuttaIndexEntry)
const suttaIndex = catalog.nikayas.flatMap((n) => {
  const entries: SuttaIndexEntry[] = [];
  const walk = (node: CatalogNode, groups: { id: string; label: string }[]) => {
    const here = [...groups, { id: node.id, label: node.nameKo ?? node.name ?? node.id }];
    for (const s of node.suttas) {
      if (s.editions.length > 0) {
        entries.push({ ...s, nikaya: n.id, trail: { nikayaName: n.nameKo, groups: here, groupPages: false } });
      }
    }
    node.children.forEach((child) => walk(child, here));
  };
  n.nodes.forEach((node) => walk(node, []));
  // 경이 많은 니까야는 목록을 묶음별 페이지로 나눈다 (src/lib/data.ts splitsIntoGroups 와 같은 기준)
  const total = n.nodes.flatMap(function collect(node): CatalogSutta[] {
    return [...node.suttas, ...node.children.flatMap(collect)];
  }).length;
  return entries.map((e) => ({ ...e, trail: { ...e.trail, groupPages: total > INLINE_SUTTA_LIMIT } }));
});
mkdirSync(path.dirname(OUT_SUTTAS), { recursive: true });
// 경 읽기 오른쪽 칸의 참고 경전 · 해설 법문 · 기타 자료 (content/extras.json — 이 저장소에서 직접 고치는 파일)
{
  const extrasPath = path.join(ROOT, "content/extras.json");
  const extras = existsSync(extrasPath) ? extrasSchema.parse(readJson(extrasPath)) : {};
  const known = new Set(suttaIndex.map((s) => s.id));
  for (const [id, kinds] of Object.entries(extras)) {
    if (!known.has(id)) errors.push(`content/extras.json: "${id}" 경이 목록에 없습니다`);
    for (const item of Object.values(kinds).flat()) {
      if (item?.suttaId && !known.has(item.suttaId)) {
        errors.push(`content/extras.json: ${id} 의 참고 경 "${item.suttaId}" 가 목록에 없습니다`);
      }
    }
  }
  if (errors.length) {
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  writeFileSync(path.join(path.dirname(OUT_SUTTAS), "extras.json"), JSON.stringify(extras));
}
// VRI 묶음 파일: 목록 차례대로 경을 모아 ~400KB 가 넘으면 다음 묶음. 본문(t-)과 주석(c-)은 따로.
const OUT_VRI = path.join(ROOT, "public/data/vri");
rmSync(OUT_VRI, { recursive: true, force: true });
mkdirSync(OUT_VRI, { recursive: true });
{
  const SHARD_BYTES = 400_000;
  const order = new Map(suttaIndex.map((s, i) => [s.id, i]));
  const byOrder = <T extends { suttaId: string }>(list: T[]) =>
    [...list].sort((a, b) => (order.get(a.suttaId) ?? 0) - (order.get(b.suttaId) ?? 0));
  const shardOf = new Map<string, { t?: number; c?: number }>();
  const writeShards = (kind: "t" | "c", items: { suttaId: string; body: unknown }[]) => {
    let shard: Record<string, unknown> = {};
    let bytes = 0;
    let n = 0;
    const flush = () => {
      if (Object.keys(shard).length === 0) return;
      writeFileSync(path.join(OUT_VRI, `${kind}-${n}.json`), JSON.stringify(shard));
      shard = {};
      bytes = 0;
      n++;
    };
    for (const { suttaId, body } of items) {
      const json = JSON.stringify(body);
      if (bytes > 0 && bytes + json.length > SHARD_BYTES) flush();
      shard[suttaId] = body;
      bytes += json.length;
      shardOf.set(suttaId, { ...shardOf.get(suttaId), [kind]: n });
    }
    flush();
    return n;
  };
  // 책 쪽 번호(PTS·미얀마·태국·VRI 인쇄본) — content/vri-pages.json (`pnpm import:pages`)
  const pagesFile = path.join(ROOT, "content", "vri-pages.json");
  const pages = existsSync(pagesFile)
    ? z.record(z.string(), z.array(z.tuple([z.string(), z.string(), z.string()]))).parse(readJson(pagesFile))
    : {};
  const tCount = writeShards(
    "t",
    byOrder(vriTexts).map((t) => ({
      suttaId: t.suttaId,
      body: {
        s: suttaTextSchema.parse(t).segments,
        p: pages[t.suttaId] ?? [],
        ...(vriUnsure.has(t.suttaId) ? { u: vriUnsure.get(t.suttaId) } : {}),
      },
    })),
  );
  const grouped = new Map<string, Partial<Record<"attha" | "tika", SuttaCommentary>>>();
  for (const c of commentaryFiles) {
    grouped.set(c.suttaId, { ...grouped.get(c.suttaId), [c.layer]: suttaCommentarySchema.parse(c) });
  }
  const cCount = writeShards(
    "c",
    byOrder([...grouped].map(([suttaId, body]) => ({ suttaId, body }))),
  );
  for (const entry of suttaIndex) {
    const at = shardOf.get(entry.id);
    if (at?.t !== undefined) entry.vri = { t: at.t, c: at.c ?? null };
  }
  console.log(`VRI 묶음: 본문 ${tCount}개 · 주석 ${cCount}개 (경 ${vriTexts.length}개)`);
}
writeFileSync(path.join(path.dirname(OUT_SUTTAS), "sutta-index.json"), JSON.stringify(suttaIndexSchema.parse(suttaIndex)));

rmSync(OUT_SUTTAS, { recursive: true, force: true });
for (const text of texts) {
  const dir = path.join(OUT_SUTTAS, text.suttaId);
  mkdirSync(dir, { recursive: true });
  const checked = suttaTextSchema.parse(text);
  // 복사를 막아 둔 번역(법현 스님)은 자료 파일을 그대로 읽을 수 없게 감싼다 (src/lib/seal.ts)
  const body = editionById.get(text.editionId)?.allowCopy === false
    ? { suttaId: checked.suttaId, editionId: checked.editionId, sealed: seal(checked.segments, checked.suttaId, checked.editionId) }
    : checked;
  writeFileSync(path.join(dir, `${text.editionId}.json`), JSON.stringify(body));
}
for (const notes of notesFiles) {
  writeFileSync(
    path.join(OUT_SUTTAS, notes.suttaId, `${notes.editionId}.notes.json`),
    JSON.stringify(suttaNotesSchema.parse(notes)),
  );
}
for (const { kind, ...file } of analysisFiles) {
  writeFileSync(
    path.join(OUT_SUTTAS, file.suttaId, `${file.editionId}.${kind}.json`),
    JSON.stringify(suttaNissayaSchema.parse(file)),
  );
}
// 판본 정보 창의 소개 글 (translator_info/<판본 id 의 - 를 _ 로>.txt). 대역·문법분석 소개는 nissaya_·paligrammar_ 가 붙는다.
{
  const dir = path.join(SOURCE_ROOT, "translator_info");
  const outDir = path.join(ROOT, "public/data/edition-info");
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const parse = (text: string) => {
    const sections: EditionInfo["groups"][number]["sections"] = [];
    // <big><b>제목<\b><\big> 으로 단락이 나뉜다. <\b> 는 </b> 로 읽는다.
    const clean = text.replace(/<\\b>/g, "</b>").replace(/\r/g, "");
    for (const chunk of clean.split(/<big>/).slice(1)) {
      const [head, ...rest] = chunk.split(/<\\big>|<\/big>/);
      const title = head.replace(/<\/?b>/g, "").trim();
      const paragraphs = rest
        .join("")
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => parseInline(p));
      sections.push({ title, paragraphs });
    }
    return sections;
  };
  let count = 0;
  for (const editionId of [...usedEditions, ...commentaryEditionIds]) {
    const edition = { id: editionId };
    const base = edition.id.replace(/-/g, "_");
    const groups: EditionInfo["groups"] = [];
    for (const [prefix, kind] of [["", "text"], ["nissaya_", "nissaya"], ["paligrammar_", "grammar"]] as const) {
      const file = path.join(dir, `${prefix}${base}.txt`);
      if (!existsSync(file)) continue;
      const sections = parse(readFileSync(file, "utf8"));
      if (sections.length === 0) warnings.push(`판본 정보 ${path.basename(file)}: 단락 제목(<big>)이 없습니다`);
      else groups.push({ kind, sections });
    }
    if (groups.length === 0) continue;
    const info = editionInfoSchema.parse({ editionId: edition.id, groups });
    writeFileSync(path.join(outDir, `${edition.id}.json`), JSON.stringify(info));
    count++;
  }
  console.log(`판본 정보 ${count}개`);
}
for (const kind of ["nissaya", "grammar"] as const) {
  const list = analysisFiles.filter((f) => f.kind === kind);
  if (list.length) {
    console.log(`${kind === "nissaya" ? "대역" : "문법분석"}: ${list.map((n) => `${n.suttaId}(${n.editionId})`).join(", ")}`);
  }
}

// ── 검색 색인: 언어별 "단어 → { 경|판본 → 문장 번호들 }", 단어 앞글자별 조각 ─────────
rmSync(OUT_SEARCH, { recursive: true, force: true });
const searchShards = new Map<string, SearchShard>(); // "언어/조각" → 조각
for (const text of texts) {
  // 복사를 막아 둔 번역은 검색 색인과 검색 결과 미리보기에 넣지 않는다 (색인 파일도 공개되므로)
  if (editionById.get(text.editionId)?.allowCopy === false) continue;
  const language = editionById.get(text.editionId)?.language ?? "ko";
  const doc = `${text.suttaId}|${text.editionId}`;
  for (const segment of text.segments) {
    if (rowKind(segment.key, text.suttaId) === "hidden") continue;
    for (const token of tokenize(plainText(segment.parts), language)) {
      const shardKey = `${language}/${searchShardName(token)}`;
      const shard = searchShards.get(shardKey) ?? {};
      const docs = (shard[token] ??= {});
      (docs[doc] ??= []).push(segment.key);
      searchShards.set(shardKey, shard);
    }
  }
}
let searchBytes = 0;
for (const [shardKey, shard] of searchShards) {
  const file = path.join(OUT_SEARCH, `${shardKey}.json`);
  mkdirSync(path.dirname(file), { recursive: true });
  const json = JSON.stringify(shard);
  searchBytes += json.length;
  writeFileSync(file, json);
}
console.log(`검색 색인: 조각 ${searchShards.size}개, ${(searchBytes / 1e6).toFixed(1)}MB`);

// ── 보고 ────────────────────────────────────────────────────
const withText = allSuttas.filter((s) => s.editions.length > 0);
console.log(`경전 목록: ${allSuttas.length}개 경 (본문 있음 ${withText.length}개)`);
for (const n of catalog.nikayas) {
  const count = n.nodes.flatMap(function collect(node): CatalogSutta[] {
    return [...node.suttas, ...node.children.flatMap(collect)];
  }).length;
  console.log(`  ${n.nameKo}: ${count}`);
}
// 판본별 합계 (경이 많아지면 경마다 줄을 찍지 않는다)
const byEdition = new Map<string, { 경: number; 문장: number; 각주: number }>();
for (const t of texts) {
  const row = byEdition.get(t.editionId) ?? { 경: 0, 문장: 0, 각주: 0 };
  row.경++;
  row.문장 += t.segments.length;
  row.각주 +=
    notesFiles.find((n) => n.suttaId === t.suttaId && n.editionId === t.editionId)?.notes.length ?? 0;
  byEdition.set(t.editionId, row);
}
console.table(Object.fromEntries(byEdition));
console.log(`본문 있는 경: ${withText.map((s) => s.id).join(", ")}`);
for (const w of warnings) console.warn(`경고: ${w}`);
console.log("변환 오류: 0건");
