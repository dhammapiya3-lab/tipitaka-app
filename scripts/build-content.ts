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
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  extrasSchema,
  parallelsSchema,
  suttaTitlesSchema,
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
import {
  noteMarks,
  paragraphOf,
  parseInline,
  plainText,
  rowKind,
  splitNotes,
  toSuttaId,
} from "../src/lib/segments";
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
  ExtraItem,
  Footnote,
  Language,
  Segment,
  SuttaCommentary,
  SuttaExtras,
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
  wordLinks: z
    .array(z.tuple([z.string(), z.string(), z.number(), z.number()]))
    .default([]),
  /** 이 경 앞의, 어느 경에도 붙지 않은 주석(책·품 머리말, 이야기 등) */
  before: z
    .array(
      z.object({
        para: z.number(),
        vripara: z.coerce.string().nullable(),
        title: z.string().nullable().optional(),
        lines: z.array(z.string()),
      }),
    )
    .optional(),
  /** 책 맨 끝(마지막 경 뒤)의, 어느 경에도 붙지 않은 주석(맺음말 등) */
  after: z
    .array(
      z.object({
        para: z.number(),
        vripara: z.coerce.string().nullable(),
        title: z.string().nullable().optional(),
        lines: z.array(z.string()),
      }),
    )
    .optional(),
});
/**
 * content/vri/<경>.ko.json — 주석서·복주석서 번역 (사람이 쓰는 파일).
 * translations: 번역자(판본) id → 이름·배지와 층별 "문단 번호 → 줄마다 번역"
 */
const vriKoLines = z.record(z.string(), z.array(z.string().nullable()));
const vriKoSchema = z.object({
  _설명: z.string().optional(),
  attha: z
    .object({ title: z.string().optional(), nameKo: z.string().optional() })
    .optional(),
  tika: z
    .object({ title: z.string().optional(), nameKo: z.string().optional() })
    .optional(),
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
  {
    id: "dn",
    folder: "digha_nikaya",
    name: "Dīgha Nikāya",
    nameKo: "디가 니까야",
  },
  {
    id: "mn",
    folder: "majjhima_nikaya",
    name: "Majjhima Nikāya",
    nameKo: "맛지마 니까야",
  },
  {
    id: "sn",
    folder: "samyutta_nikaya",
    name: "Saṁyutta Nikāya",
    nameKo: "상윳따 니까야",
  },
  {
    id: "an",
    folder: "anguttara_nikaya",
    name: "Aṅguttara Nikāya",
    nameKo: "앙굿따라 니까야",
  },
  {
    id: "kn",
    folder: "khuddaka_nikaya",
    name: "Khuddaka Nikāya",
    nameKo: "쿳다까 니까야",
  },
  // 주석 문헌 — 니까야는 아니지만 같은 경전 목록·읽기 화면을 쓴다 (경전 화면의 "주석 문헌"에서 연다)
  {
    id: "vism",
    folder: "visuddhimagga",
    name: "Visuddhimagga",
    nameKo: "위숫디막가 (청정도론)",
    vriOnly: true,
  },
] as {
  id: string;
  folder: string;
  name: string;
  nameKo: string;
  /** 마하상기띠본 없이 VRI 원문만 있는 책 */
  vriOnly?: boolean;
}[];

/** 쿳다까 니까야 책 → 폴더 (원래 앱과 같은 이름) */
const KN_BOOKS: Record<string, string> = {
  kp: "khuddakapatha",
  dhp: "dhammapada",
  ud: "udana",
  iti: "itivuttaka",
  snp: "suttanipata",
  vv: "vimanavatthu",
  pv: "petavatthu",
  thag: "theragatha",
  thig: "therigatha",
  "tha-ap": "thera-apadana",
  "thi-ap": "theri-apadana",
  bv: "buddhavamsa",
  cp: "cariyapitaka",
  ja: "jataka",
  mnd: "mahaniddesa",
  cnd: "culaniddesa",
  ps: "patisambhidamagga",
  ne: "nettippakaraṇa",
  pe: "petakopadesa",
  mil: "milindapanha",
};

/** 원래 앱 판본 정보의 언어 이름 → 앱의 언어 코드 */
const LANGUAGES: Record<string, Language> = {
  빠알리어: "pli",
  한국어: "ko",
  영어: "en",
};

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
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          nameKo: z.string().optional(),
        }),
      )
      .optional(),
  }),
);
const rawEditionEntrySchema = z.object({
  folder: z.string(),
  edition: z.string(),
  footnote: z.string().optional(),
  /** 문장마다 붙는 각주 폴더 (SuttaCentral 빌라라 꼴: 문장 번호 → 각주 글, 본문에 각주 번호가 없다) */
  comments: z.string().optional(),
});
/** editions.json 은 보통 목록이지만, 책 번호로 묶은 꼴({ "mil": [...] }, 밀린다빤하)도 있다 → 하나로 펼친다 */
const rawEditionListSchema = z
  .union([
    z.array(rawEditionEntrySchema),
    z.record(z.string(), z.array(rawEditionEntrySchema)),
  ])
  .transform((v) => (Array.isArray(v) ? v : Object.values(v).flat()));
const rawTextSchema = z.record(z.string(), z.string());
const registrySchema = z.record(
  z.string(),
  z.object({
    label: z.string(),
    badge: z.string().optional(),
    language: z.string(),
    allowCopy: z.boolean().optional(),
    // 정보 화면 판본 표에만 쓰는 칸 (없으면 label·language 를 그대로 쓴다)
    source: z.string().optional(), // 판본 칸 — 원문을 낸 분 (예: 한국마하시 사야도)
    sourceLanguage: z.string().optional(), // 언어 칸 — 원문의 언어 (예: 미얀마어)
    translator: z.string().optional(), // 번역 칸 (예: 담마간다 스님)
    license: z.string().optional(), // 이용 조건 칸
  }),
);
type EditionList = z.infer<typeof rawEditionListSchema>;

// ── 읽기 도우미 ──────────────────────────────────────────────
const errors: string[] = [];
const warnings: string[] = [];
const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(file, "utf8"));
const orNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

/**
 * 경이 든 폴더와 판본 목록. 쿳다까 니까야는 책마다 따로 있다.
 * base 는 본문(sutta_pitaka) 또는 대역(sutta_pitaka_nissaya) 폴더.
 */
const editionLists = new Map<string, { dir: string; list: EditionList }>();
function editionsFor(nikaya: string, suttaId: string, base = SOURCE) {
  const book =
    nikaya === "khuddaka_nikaya"
      ? suttaId.match(/^([a-z-]+?)(?=\d|$)/)?.[1]
      : undefined;
  const dir = path.join(
    base,
    nikaya,
    ...(book && KN_BOOKS[book] ? [KN_BOOKS[book]] : []),
  );
  let found = editionLists.get(dir);
  if (!found) {
    const file = path.join(dir, "editions.json");
    found = {
      dir,
      list: existsSync(file) ? rawEditionListSchema.parse(readJson(file)) : [],
    };
    editionLists.set(dir, found);
  }
  return found;
}

/** sub: 판본 폴더 안의 경 경로 (suttaFilePath — 예: sn1/sn1.1) */
/**
 * VRI 원문 줄에 붙어 있는 VRI 문단 번호("… bhikkhusaṅghañca. 2.", "Paribbājakakathā 1.")를 뗀다.
 * VRI 줄을 빌랄라 문장에 나눠 담으면서 다음 문단의 번호가 앞 문장 끝에 붙은 것이라 잘못된 자리에 보이고,
 * 문단 번호는 화면의 문단 머리에 이미 있다. (VRI 문단 번호는 주석 연결용으로 따로 남아 있다)
 */
/**
 * 본문에서 떼는 VRI 번호를 경 문단에 매긴다. 문장 끝의 번호는 다음 문단의 번호이고(VRI 는 문단 앞에 번호가 있다),
 * 문장 가운데의 번호는 그 문장이 든 문단, 경 첫 문단은 VRI 자료의 첫 번호.
 */
/**
 * 주석 문단 첫 줄 맨 앞의 VRI 번호 — 문단 머리("VRI 1")에 이미 보이므로 글에서는 뗀다 (데이터는 그대로).
 * 번호가 그 문단의 VRI 번호(의 첫 수)와 같을 때만 — 장·품 제목의 번호("2. Nīvaraṇappahāna…")는 그대로.
 */
function withoutLeadNumber(line: string, vripara: string | null): string {
  if (!vripara) return line;
  const m = line.match(/^\s*(\d+)(?:-\d+)?\.\s+(?=\S)/);
  return m && m[1] === vripara.split(/[-,\s]/)[0]
    ? line.slice(m[0].length)
    : line;
}

/** 문장 칸인지 (경 이름 줄 0.x · 소제목 칸 .0 / .0.N 이 아닌) — 맨 앞 번호는 문장 칸에서만 문단 번호로 본다 */
function isSentenceKey(key: string): boolean {
  const tail = key.slice(key.indexOf(":") + 1);
  return !(tail === "0" || tail.startsWith("0.") || /\.0(\.\d+)?$/.test(tail));
}

/** 소제목처럼 보이는 글 (scripts/move-heading-paranums.py 의 heading_like 와 같다) */
function headingLike(text: string): boolean {
  return text.length < 80 && !/[“‘"?–;,]/.test(text);
}

/** 맨 앞 번호를 문단 번호로 볼 칸 — 문장 칸, 또는 소제목 칸 번호지만 VRI 가 문장을 넣어 둔 칸 */
function leadNumberKey(key: string, text: string): boolean {
  const tail = key.slice(key.indexOf(":") + 1);
  if (tail === "0" || tail.startsWith("0.")) return false;
  return isSentenceKey(key) || !headingLike(text);
}

function vriParaNumbers(
  segments: Record<string, string>,
  suttaId: string,
  first: unknown,
): Record<string, string> {
  const keys = Object.keys(segments);
  const found = new Map<string, string[]>();
  const add = (key: string | undefined, n: string) => {
    if (!key) return;
    const p = paragraphOf(key, suttaId);
    const list = found.get(p) ?? [];
    if (!list.includes(n)) list.push(n);
    found.set(p, list);
  };
  const firstText = keys.find((k) => !/:0\.\d+$/.test(k));
  const head = String(first ?? "").match(/^(\d+(?:-\d+)?)/)?.[1];
  if (head) add(firstText, head);
  keys.forEach((key, i) => {
    const text = segments[key];
    // 문장 칸 맨 앞의 번호 (VRI 원본처럼 문단 줄 맨 앞 — scripts/move-heading-paranums.py)
    const lead = leadNumberKey(key, text)
      ? text.match(/^\s*(\d+(?:-\d+)?)\.\s+(?=\S)/)
      : null;
    if (lead) add(key, lead[1]);
    for (const m of text.matchAll(
      /[.?!;:’”–—\])]\s+(\d+(?:-\d+)?)\.(?=\s+\S)/g,
    ))
      add(key, m[1]);
    const end = text.match(/\S\s+(\d+(?:-\d+)?)\.\s*$/);
    if (end) add(keys[i + 1], end[1]);
  });
  return Object.fromEntries(
    [...found].map(([p, list]) => [p, list.join(", ")]),
  );
}

function withoutParaNumbers(
  segments: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(segments).map(([key, text]) => [
      key,
      (leadNumberKey(key, text)
        ? text.replace(/^\s*\d+(?:-\d+)?\.\s+(?=\S)/, "")
        : text
      )
        .replace(/([.?!;:’”–—\])])\s+\d+(?:-\d+)?\.(?=\s+\S)/g, "$1")
        .replace(/(\S)\s+\d+(?:-\d+)?\.\s*$/, "$1"),
    ]),
  );
}

function readText(dir: string, folder: string, sub: string, edition: string) {
  for (const kind of ["root", "translation"]) {
    const file = path.join(dir, folder, `${sub}_${kind}-${edition}.json`);
    if (existsSync(file))
      return applyLineMap(
        edition,
        edition === "pli-pts"
          ? cleanPts(rawTextSchema.parse(readJson(file)))
          : rawTextSchema.parse(readJson(file)),
      );
  }
  return null;
}

/**
 * PTS 전자판(GRETIL · 담마까야 재단 입력)의 별표·밑줄을 뗀다 (원본 파일은 그대로, 사이트 자료에서만):
 *  · 품·경 끝의 구분선 "********…", "______…" (인쇄본의 줄 긋기)
 *  · 각주 표시 "Suttanta.]*", "aṭṭhamiṃ*" (각주 글은 넣지 않았다)
 *  · 두 별표로 감싼 말 "*kiṃ paccati*" — 별표만 빼고 글자는 그대로
 * 빠알리 글자는 하나도 바뀌지 않는다.
 */
function cleanPts(text: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(text).map(([key, value]) => [
      key,
      value
        .replace(/\s*(?:\*{3,}|_{3,})/g, "")
        .replace(/\*/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .trim(),
    ]),
  );
}

/**
 * 줄 대응표(scripts/line-maps/<판본>.json): 게송을 다르게 나눈 판본(PTS 등)의 줄을
 * 마하상기띠본의 같은 글 줄 번호로 옮긴다. 원본 파일은 그대로 두고 사이트 자료에만 적용한다.
 */
const lineMaps = new Map<string, Record<string, string>>();
function applyLineMap(
  edition: string,
  raw: Record<string, string>,
): Record<string, string> {
  if (!lineMaps.has(edition)) {
    const file = path.join(
      process.cwd(),
      "scripts",
      "line-maps",
      `${edition}.json`,
    );
    const map = existsSync(file)
      ? z.record(z.string(), z.string()).parse(readJson(file))
      : {};
    delete map._설명;
    lineMaps.set(edition, map);
  }
  const map = lineMaps.get(edition) ?? {};
  if (!Object.keys(map).some((key) => key in raw)) return raw;
  return Object.fromEntries(
    Object.entries(raw).map(([key, text]) => [map[key] ?? key, text]),
  );
}

const NAMO =
  /^\s*[“"]?\s*namo\s+tassa\s+bhagavato\s+arahat[oa]\s+sammā\s*sambuddhassa\s*[.!]?\s*/i;

/** 경의 첫 문장(그 앞의 제목·소제목 칸 포함)이 "Namo tassa …" 로 시작하면 그 부분을 떼어 머리말로 */
/**
 * PTS 경 첫머리의 큰 글자 제목 — 대문자 낱말이 이어지는 부분. 큰 글자로 찍힌 문장 첫 낱말
 * ("EVAṂ me sutaṃ", "KĀ iddhi?")은 문장이므로 뺀다. 로마 숫자만 있는 것("CII.", "I-VI.")은 그대로 둔다.
 */
function ptsHeading(text: string): string[] | null {
  const UP = /^[A-ZĀĪŪṀṂṄÑṬḌṆḶ0-9.,:;\-–—()[\]'"/{}]+$/;
  const ROMAN = /^\(?[IVXLCDM]+(?:[-–]+[IVXLCDM]+)?[.\-–)]*$/;
  const tokens = text.trim().split(/\s+/);
  let n = 0;
  while (n < tokens.length && UP.test(tokens[n]!)) n++;
  // 바로 뒤가 작은 글자로 이어지면 마지막 큰 글자 낱말은 문장 첫 낱말 ("EVAṂ me sutaṃ")
  while (
    n > 0 &&
    n < tokens.length &&
    /^[‘']?([a-zāīūṃṁṅñṭḍṇḷ]|Bhikkhave)/.test(tokens[n]!) &&
    !/[.)\]]$/.test(tokens[n - 1]!)
  )
    n--;
  // 끝의 번호만 있는 낱말("[11.", "1--2.")은 다음 제목·문장의 것이므로 글에 남긴다
  while (n > 0 && /^[[(]?[\d\-–.]+$/.test(tokens[n - 1]!)) n--;
  const run = tokens.slice(0, n);
  const real = run.some(
    (w) =>
      w.replace(/[^A-ZĀĪŪṀṂṄÑṬḌṆḶ]/g, "").length >= 3 &&
      !ROMAN.test(w) &&
      w !== "[FOOTNOTES]",
  );
  if (!real) return null;
  // 줄 나누기 — 번호로 시작하는 낱말("1", "1.ITTHIVIMĀNA", "I-PĪṬHAVAGGA", "II")에서 새 줄
  // (PTS 인쇄본에서 제목마다 따로 된 줄). "BOOK III." 처럼 앞 낱말과 한 덩어리인 번호는 그대로.
  const lines: string[][] = [];
  run.forEach((w, i) => {
    const prev = run[i - 1];
    const numbered = /^(\d|[IVXLC]+(?:[-–.]|$))/.test(w);
    const joined =
      !prev ||
      /^(BOOK|VAGGA|SECTION|DIVISION|PART)$/.test(prev) ||
      /^[\d[(]|^[IVXLC]+[-–.]*$/.test(prev);
    // 끝에 혼자 붙은 로마 숫자("MAGGA-SAṂYUTTAM XLV.")는 앞 줄에 그대로
    const lastRoman = i === run.length - 1 && /^[IVXLC]+\.?$/.test(w);
    if (numbered && !joined && !lastRoman) lines.push([w]);
    else if (lines.length) lines.at(-1)!.push(w);
    else lines.push([w]);
  });
  return lines.map((l) => l.join(" "));
}

function splitNamo(
  raw: Record<string, string>,
  pts = false,
): {
  text: Record<string, string>;
  preface: string[];
} {
  const text = { ...raw };
  const preface: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    const tail = key.slice(key.indexOf(":") + 1);
    const titleOrHeading =
      tail === "0" || tail.startsWith("0.") || /\.0(\.\d+)?$/.test(tail);
    let rest = value;
    // "Namo tassa …" 와 PTS 큰 글자 제목 줄은 원본 차례대로 번갈아 나올 수 있다 (thig1.1: THERĪ-GĀTHĀ. → Namo tassa …)
    for (let guard = 0; guard < 6; guard++) {
      const before = rest;
      const m = rest.match(NAMO);
      if (m && !/[“"]/.test(m[0])) {
        preface.push(m[0].trim());
        rest = rest.slice(m[0].length);
      }
      // PTS: 경 첫머리의 큰 글자 제목 줄(예: "1 ITTHIVIMĀNA", "1.ITTHIVIMĀNA", "I-PĪṬHAVAGGA")도 머리말로
      if (pts) {
        const head = ptsHeading(rest);
        if (head) {
          preface.push(...head);
          const at = rest.indexOf(head.at(-1)!) + head.at(-1)!.length;
          rest = rest.slice(at).replace(/^\s+/, "");
        }
      }
      if (rest === before) break;
    }
    if (rest !== value) text[key] = rest;
    // 첫 문장까지만 — 머리말로 다 빠져 비었으면 다음 문장도 본다 (vv1: 1.1 = Namo·제목, 2.1 첫머리 = "I-PĪṬHAVAGGA")
    if (!titleOrHeading && rest.trim()) break;
  }
  return { text, preface };
}

function toSegments(raw: Record<string, string>): Segment[] {
  return Object.entries(raw)
    .map(([key, text]) => ({ key, parts: parseInline(text) }))
    .filter((s) => s.parts.length > 0);
}

// ── 변환 ────────────────────────────────────────────────────
const registry = registrySchema.parse(
  readJson(path.join(SOURCE_ROOT, "edition-registry.json")),
);
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
        badge:
          (e.badge ?? "").replace(/\)\s*$/, "").trim() || e.label.slice(0, 2),
        language: language ?? "ko",
        translator: e.translator ?? (language === "pli" ? null : e.label),
        license: e.license ?? null,
        allowCopy: e.allowCopy ?? true,
        ...(e.source ? { source: e.source } : {}),
        ...(e.sourceLanguage ? { sourceLanguage: e.sourceLanguage } : {}),
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
  preface: z.array(z.string()).default([]),
  source: z.object({ vripara: z.unknown() }).partial().optional(),
});
/**
 * VRI 주석서·복주석서 원본의 소제목 줄 (content/vri-heads.json, scripts/import-vri-heads.py).
 * 주석 줄이 이 가운데 하나와 같으면 그 줄 번호를 heads 에 적어 화면에서 소제목처럼 그린다(글자는 그대로).
 */
const vriHeadsFile = path.join(ROOT, "content", "vri-heads.json");
const vriHeads = new Set<string>(
  existsSync(vriHeadsFile)
    ? z.array(z.string()).parse(readJson(vriHeadsFile))
    : [],
);
/** scripts/import-vri-heads.py 의 norm 과 같아야 한다 */
function headNorm(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .normalize("NFC")
    .replace(/[“”‘’"'.,;:!?–—()\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/( \d+)+$/, "");
}

/** VRI XML 의 문단 번호 자리 — 경 → 경 문단 → VRI 문단 번호 (content/vri-paranums.json, scripts/fill-vri-gaps.py) */
const vriParanumsFile = path.join(ROOT, "content", "vri-paranums.json");
const vriParanums: Record<string, Record<string, string>> = existsSync(
  vriParanumsFile,
)
  ? z
      .record(z.string(), z.record(z.string(), z.string()))
      .parse(readJson(vriParanumsFile))
  : {};
/** 수따센따 msdiv — 경 → 문장 번호 → VRI 문단 번호 (content/sc-msdiv.json, scripts/import-sc-refs.py) */
const scMsdivFile = path.join(ROOT, "content", "sc-msdiv.json");
const scMsdiv: Record<string, Record<string, string>> = existsSync(scMsdivFile)
  ? z
      .record(z.string(), z.record(z.string(), z.string()))
      .parse(readJson(scMsdivFile))
  : {};
const commentaryFiles: SuttaCommentary[] = [];
const vriTexts: SuttaText[] = [];
const vriUnsure = new Map<string, string[]>();
const vriPreface = new Map<string, string[]>();
/** 경 문단 → VRI 문단·게송 번호 (본문에서 뗀 번호를 문단 머리에 따로 보인다) */
const vriNumbers = new Map<string, Record<string, string>>();
/** 주석 번역 판본 id — 판본 정보 창의 소개 글(translator_info)을 함께 옮긴다 */
const commentaryEditionIds = new Set<string>();
const usedEditions = new Set<string>();
const texts: SuttaText[] = [];
const notesFiles: SuttaNotes[] = [];
/** 본문 파일 안에 함께 넣는 각주 (빌라라 각주 — 경마다 각주 파일을 따로 만들면 호스팅 파일 수 한도를 넘는다) */
const embeddedNotes = new Map<string, SuttaNotes["notes"]>();

/** 빌라라 각주 글: 링크(<a>)·<span> 은 글자만 남긴다 (HTML 로 그리지 않는다) */
function cleanBilaraComment(text: string): string {
  return (
    text
      .replace(/<a\b[^>]*>/g, "")
      .replace(/<\/a>/g, "")
      .replace(/<\/?span\b[^>]*>/g, "")
      // <i lang='pi' translate='no'> 처럼 속성이 붙은 서식 태그는 속성을 뗀다 (parseInline 은 <i>·<em>·<b> 만 안다)
      .replace(/<(i|em|b)\s[^>]*>/g, "<$1>")
      // 그 밖의 태그는 지운다
      .replace(/<(?!\/?(?:i|em|b)>)[^>]*>/g, "")
      // 수자또 스님이 각주 여러 개를 " | " 로 이어 둔 것 → 줄을 바꿔 보인다
      .replace(/\s+\|\s+/g, "\n\n")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "‹")
      .replace(/&gt;/g, "›")
      .trim()
  );
}
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
  // 마하상기띠본이 없는 책(청정도론)은 VRI 원문이 곧 기준 원문이다 — 문장 번호를 VRI 자료에서 가져온다
  const vriOnly = path.join(ROOT, "content", "vri", `${id}.json`);
  const root = rootEntry
    ? readText(dir, rootEntry.folder, sub, ROOT_EDITION)
    : nikaya.vriOnly && existsSync(vriOnly)
      ? vriSchema.parse(readJson(vriOnly)).segments
      : null;

  for (const entry of editionList) {
    const raw =
      entry.edition === ROOT_EDITION
        ? root
        : readText(dir, entry.folder, sub, entry.edition);
    if (!raw) continue;
    const where = `${id} ${entry.edition}`;
    if (!editionById.has(entry.edition))
      errors.push(`${where}: edition-registry.json 에 판본 정보가 없습니다`);
    if (!root) {
      errors.push(
        `${where}: 빠알리 원문(${ROOT_EDITION}) 없이 번역만 있습니다`,
      );
      continue;
    }
    // 번역에 원문에 없는 문장 번호가 있으면 오류. 다른 빠알리 판본(PTS 등)은 줄 나눔이 달라 경고만 한다.
    const extra = Object.keys(raw).filter((key) => !(key in root));
    if (extra.length) {
      const message = `${where}: 원문에 없는 문장 번호 ${extra.slice(0, 5).join(", ")}`;
      if (editionById.get(entry.edition)?.language === "pli")
        warnings.push(message);
      else errors.push(message);
    }

    // 마하상기띠본·PTS 경 첫머리의 "Namo tassa bhagavato…" 는 문장이 아니라 책 첫머리 줄 — 그 판본의 머리말로
    // 따로 보인다 (VRI 처럼, 데이터는 그대로). 경 안 대화 속의 Namo tassa(mn27 등)는 그대로.
    const { text: body, preface } =
      entry.edition === "pli-ms" || entry.edition === "pli-pts"
        ? splitNamo(raw, entry.edition === "pli-pts")
        : { text: raw, preface: [] };
    const segments = toSegments(body);
    texts.push({
      suttaId: id,
      editionId: entry.edition,
      segments,
      ...(preface.length ? { preface } : {}),
    });
    sutta.editions.push(entry.edition);
    usedEditions.add(entry.edition);

    // 빌라라 꼴 각주: 각주가 있는 문장 끝에 차례 번호를 붙인다
    if (entry.comments) {
      const file = path.join(
        dir,
        entry.comments,
        `${sub}_comment-${entry.edition}.json`,
      );
      if (!existsSync(file)) continue;
      const notes: SuttaNotes["notes"] = [];
      for (const [key, text] of Object.entries(
        rawTextSchema.parse(readJson(file)),
      )) {
        const clean = cleanBilaraComment(text);
        if (!clean) continue;
        const seg = segments.find((s) => s.key === key);
        if (!seg) {
          warnings.push(
            `${where} ${key}: 각주가 붙을 문장이 번역에 없어 뺐습니다`,
          );
          continue;
        }
        const mark = String(notes.length + 1);
        seg.parts.push({ type: "note", mark });
        notes.push({ mark, key, parts: parseInline(clean) });
      }
      if (notes.length) {
        embeddedNotes.set(`${id}/${entry.edition}`, notes);
        sutta.noteEditions.push(entry.edition);
      }
      continue;
    }

    // 각주: 본문의 (문장, 각주 번호)와 각주 파일이 1:1 로 맞아야 한다.
    // 같은 번호의 각주가 두 문장에 붙기도 해서(dn22 71번) 번호만으로는 찾지 않는다.
    const marks = new Set(
      segments.flatMap((s) => noteMarks(s.parts).map((m) => `${s.key} ${m})`)),
    );
    const noteFile = entry.footnote
      ? path.join(dir, entry.footnote, `${sub}_comment-${entry.edition}.json`)
      : null;
    if (!noteFile || !existsSync(noteFile)) {
      if (marks.size)
        errors.push(
          `${where}: 각주 번호 ${marks.size}개가 있는데 각주 파일이 없습니다`,
        );
      continue;
    }
    let noteJson: unknown;
    try {
      noteJson = readJson(noteFile);
    } catch {
      // 원래 사이트의 파일 자체가 깨졌다(따옴표 누락 등). 이 판본의 각주 번호는 누를 수 없게 둔다.
      warnings.push(
        `${where}: 원래 사이트의 각주 파일 형식이 깨져 각주 ${marks.size}개를 뺐습니다 (${path.basename(noteFile)})`,
      );
      continue;
    }
    const notes: Footnote[] = [];
    for (const [key, text] of Object.entries(rawTextSchema.parse(noteJson))) {
      const { notes: split, leftover } = splitNotes(text);
      // 각주 번호 앞의 따옴표 한 글자는 원본 입력 실수라 무시한다.
      if (split.length === 0) {
        warnings.push(
          `${where} ${key}: 각주 파일에 각주가 아닌 글이 있어 뺐습니다 "${leftover.slice(0, 20)}"`,
        );
        continue;
      }
      if (leftover && !/^[\s‘’“”'"]*$/.test(leftover)) {
        errors.push(
          `${where} ${key}: 각주 번호 없이 시작하는 글자 "${leftover.slice(0, 20)}"`,
        );
      }
      for (const note of split) {
        if (!marks.has(`${key} ${note.mark})`)) {
          errors.push(
            `${where} ${key}: 각주 ${note.mark}) 가 본문의 같은 문장에 없습니다`,
          );
        }
        notes.push({ mark: note.mark, key, parts: parseInline(note.text) });
      }
    }
    const missing = [...marks].filter(
      (m) => !notes.some((n) => `${n.key} ${n.mark})` === m),
    );
    if (missing.length)
      errors.push(`${where}: 각주 내용이 없는 곳 ${missing.join(", ")}`);
    notesFiles.push({ suttaId: id, editionId: entry.edition, notes });
    sutta.noteEditions.push(entry.edition);
  }

  // VRI 6차 결집본 원문과 주석서·복주석서 (content/vri/<경>.json — `pnpm import:vri` 로 만든다)
  const vriFile = path.join(ROOT, "content", "vri", `${id}.json`);
  if (existsSync(vriFile) && root) {
    const vri = vriSchema.parse(readJson(vriFile));
    const where = `${id} VRI`;
    // VRI 에만 있는 소제목 칸(<문단>.0 — 마하상기띠본에 소제목이 없는 곳, scripts/fill-vri-gaps.py)은 받는다
    const rootParasForHeads = new Set(
      Object.keys(root).map((key) => paragraphOf(key, id)),
    );
    const extra = Object.keys(vri.segments).filter(
      (key) =>
        !(key in root) &&
        !(/\.0$/.test(key) && rootParasForHeads.has(paragraphOf(key, id))),
    );
    if (extra.length)
      errors.push(
        `${where}: 원문에 없는 문장 번호 ${extra.slice(0, 5).join(", ")}`,
      );
    // VRI 본문·주석은 경마다 파일을 만들지 않고 묶음 파일(public/data/vri/)에 모은다 — 호스팅 파일 수 한도(2만 개)
    vriTexts.push({
      suttaId: id,
      editionId: VRI_EDITION.id,
      segments: toSegments(withoutParaNumbers(vri.segments)),
    });
    if (vri.unsure.length) vriUnsure.set(id, vri.unsure);
    if (vri.preface.length) vriPreface.set(id, vri.preface);
    const numbers = vriParaNumbers(vri.segments, id, vri.source?.vripara);
    // VRI 원문에서 번호를 못 뗀 문단(제목 줄에 붙은 번호가 맞춤에서 빠진 곳 등)은 VRI XML 의 번호 자리(fill-vri-gaps.py)로 채운다
    // 경 문단 하나에 VRI 문단이 둘 이상 들어 있으면 "266, 267" 처럼 모두
    for (const [p, n] of Object.entries(vriParanums[id] ?? {})) {
      const list = (numbers[p] ?? "").split(", ").filter(Boolean);
      for (const x of n.split(", ")) if (!list.includes(x)) list.push(x);
      numbers[p] = list
        .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))
        .join(", ");
    }
    // 그래도 없으면 수따센따의 msdiv(= VRI 문단 번호)로
    for (const [key, n] of Object.entries(scMsdiv[id] ?? {})) {
      const p = paragraphOf(key, id);
      if (!numbers[p]) numbers[p] = n;
    }
    if (Object.keys(numbers).length) vriNumbers.set(id, numbers);
    const rootParas = new Set(
      Object.keys(root).map((key) => paragraphOf(key, id)),
    );
    sutta.editions.push(VRI_EDITION.id);
    usedEditions.add(VRI_EDITION.id);
    // 복주석서가 두 종류면(디가 옛·새 복주석서) 한 층에 이어 붙이고, 문단마다 어느 책인지 적는다
    const tikaBoth = (() => {
      const [a, b] = [vri.tika, vri.tika2 ?? null];
      const tag = (c: NonNullable<typeof a>) =>
        c.paras.map((p) => ({ ...p, book: c.book }));
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
        const moved = new Map(
          sorted.flatMap((x, n) => (x.book === 0 ? [[x.i, n] as const] : [])),
        );
        const wordLinks = a.wordLinks.map(
          ([k, w, pi, li]) =>
            [k, w, moved.get(pi) ?? pi, li] as (typeof a.wordLinks)[number],
        );
        // 앞 부분(머리말 등)도 두 책 것을 이어 붙인다
        const before = [...(a.before ?? []), ...(b.before ?? [])];
        const after = [...(a.after ?? []), ...(b.after ?? [])];
        return {
          ...a,
          paras: sorted.map((x) => x.p),
          books: [a, b],
          wordLinks,
          before,
          after,
        };
      }
      if (b) return { ...b, paras: tag(b), books: [b] };
      if (a) return { ...a, paras: tag(a), books: [a] };
      return null;
    })();
    for (const layer of ["attha", "tika"] as const) {
      const c =
        layer === "tika"
          ? tikaBoth
          : vri.attha
            ? { ...vri.attha, books: [vri.attha] }
            : null;
      if (!c) continue;
      const koFile = path.join(ROOT, "content", "vri", `${id}.ko.json`);
      const ko = existsSync(koFile)
        ? vriKoSchema.parse(readJson(koFile))
        : undefined;
      const translators = Object.entries(ko?.translations ?? {});
      for (const [tid, t] of translators) {
        if (!/^kor-[a-z0-9-]+$/.test(tid))
          errors.push(
            `${id}.ko.json: 번역 판본 id "${tid}" 는 kor-영문소문자 형식이어야 합니다`,
          );
        for (const para of Object.keys(t[layer])) {
          if (!c.paras.some((p) => String(p.para) === para))
            errors.push(
              `${id}.ko.json ${tid} ${layer}: ${c.book} 에 문단 ${para} 이 없습니다`,
            );
        }
      }
      const paras = c.paras.map((p) => {
        const bad = p.refs.filter((ref) => !rootParas.has(ref));
        if (bad.length)
          errors.push(
            `${where} ${c.book} ${p.para}: 경에 없는 문단 ${bad.join(", ")}`,
          );
        const tr: Record<string, (ReturnType<typeof parseInline> | null)[]> =
          {};
        for (const [tid, t] of translators) {
          const koLines = t[layer][String(p.para)] ?? [];
          if (koLines.length > p.lines.length) {
            errors.push(
              `${id}.ko.json ${tid} ${layer} ${p.para}: 번역 줄(${koLines.length})이 원문 줄(${p.lines.length})보다 많습니다`,
            );
          }
          if (koLines.some((line) => line?.trim())) {
            tr[tid] = p.lines.map((_, i) =>
              koLines[i]?.trim() ? parseInline(koLines[i]!) : null,
            );
          }
        }
        return {
          para: p.para,
          ...("book" in p && typeof p.book === "string" && p.book !== c.book
            ? { book: p.book }
            : {}),
          vripara: p.vripara,
          refs: p.refs,
          lines: p.lines.map((line, i) =>
            parseInline(i === 0 ? withoutLeadNumber(line, p.vripara) : line),
          ),
          lineRefs: p.lineRefs,
          ...(() => {
            const heads = p.lines.flatMap((line, i) =>
              line.length < 160 && vriHeads.has(headNorm(line)) ? [i] : [],
            );
            return heads.length ? { heads } : {};
          })(),
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
          title: p.title ?? null,
          lines: p.lines.map((line, i) =>
            parseInline(i === 0 ? withoutLeadNumber(line, p.vripara) : line),
          ),
        })),
        after: (("after" in c ? c.after : undefined) ?? []).map((p) => ({
          para: p.para,
          vripara: p.vripara,
          title: p.title ?? null,
          lines: p.lines.map((line, i) =>
            parseInline(i === 0 ? withoutLeadNumber(line, p.vripara) : line),
          ),
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
    {
      kind: "grammar",
      base: GRAMMAR_SOURCE,
      file: "paligrammar",
      label: "문법분석",
    },
  ] as const;
  for (const a of analyses) {
    const found = editionsFor(nikaya.folder, id, a.base);
    for (const entry of found.list) {
      const file = path.join(
        found.dir,
        entry.folder,
        `${sub}_root-${a.file}-${entry.edition}.json`,
      );
      if (!existsSync(file) || !root) continue;
      const where = `${id} ${a.label} ${entry.edition}`;
      if (!editionById.has(entry.edition))
        errors.push(`${where}: edition-registry.json 에 판본 정보가 없습니다`);
      const entries = Object.fromEntries(
        Object.entries(rawTextSchema.parse(readJson(file))).filter(([, text]) =>
          text.trim(),
        ),
      );
      const extra = Object.keys(entries).filter((key) => !(key in root));
      if (extra.length)
        errors.push(
          `${where}: 원문에 없는 문장 번호 ${extra.slice(0, 5).join(", ")}`,
        );
      if (Object.keys(entries).length === 0) continue;
      analysisFiles.push({
        kind: a.kind,
        suttaId: id,
        editionId: entry.edition,
        entries,
      });
      sutta[a.kind].push(entry.edition);
      usedEditions.add(entry.edition);
    }
  }
  return sutta;
}

function buildNode(
  nikaya: (typeof NIKAYAS)[number],
  raw: RawNode,
): CatalogNode {
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
          .object({
            description: z.string().optional(),
            introduction: z.string().optional(),
          })
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
const allSuttas = catalog.nikayas.flatMap((n) =>
  n.nodes.flatMap(function collect(node): CatalogSutta[] {
    return [...node.suttas, ...node.children.flatMap(collect)];
  }),
);
const seen = new Set<string>();
for (const s of allSuttas) {
  if (seen.has(s.id))
    errors.push(`${s.id}: 같은 경 번호가 목록에 두 번 있습니다`);
  seen.add(s.id);
}

if (errors.length) {
  console.error(
    `변환 실패 — 오류 ${errors.length}건. 아무 파일도 쓰지 않았습니다.`,
  );
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// ── 쓰기 (쓰기 전에 앱이 읽을 형식인지 한 번 더 검사) ──────────────
// 판본 순서: 빠알리 → 한국어 → 영어, 같은 언어 안에서는 원래 판본 정보의 순서
const LANGUAGE_ORDER: Language[] = ["pli", "ko", "en"];
// VRI 6차 결집본은 빠알리 판본 중 맨 위 (마하상기띠본 · PTS 보다 먼저)
const editions: Edition[] = [
  VRI_EDITION,
  ...[...editionById.values()].filter((e) => e.id !== VRI_EDITION.id),
]
  .filter((e) => usedEditions.has(e.id))
  .sort(
    (a, b) =>
      LANGUAGE_ORDER.indexOf(a.language) - LANGUAGE_ORDER.indexOf(b.language),
  );
mkdirSync(OUT_DATA, { recursive: true });
writeFileSync(
  path.join(OUT_DATA, "catalog.json"),
  JSON.stringify(catalogSchema.parse(catalog)),
);
writeFileSync(
  path.join(OUT_DATA, "editions.json"),
  JSON.stringify(editionsSchema.parse(editions)),
);
// PEA 사전 자료를 받은 날 (매달 자동 확인이 content/peu-version.json 을 고친다) → 정보 화면 "사용한 판"
writeFileSync(
  path.join(OUT_DATA, "peu-version.json"),
  JSON.stringify(
    z.object({ date: z.string() }).parse(JSON.parse(readFileSync(path.join(process.cwd(), "content/peu-version.json"), "utf8"))),
  ),
);
// 경 읽기 화면용 목록 — 본문이 있는 경만, 목록 순서대로 (SuttaIndexEntry)
const suttaIndex = catalog.nikayas.flatMap((n) => {
  const entries: SuttaIndexEntry[] = [];
  const walk = (node: CatalogNode, groups: { id: string; label: string }[]) => {
    const here = [
      ...groups,
      { id: node.id, label: node.nameKo ?? node.name ?? node.id },
    ];
    for (const s of node.suttas) {
      if (s.editions.length > 0) {
        entries.push({
          ...s,
          nikaya: n.id,
          trail: { nikayaName: n.nameKo, groups: here, groupPages: false },
        });
      }
    }
    node.children.forEach((child) => walk(child, here));
  };
  n.nodes.forEach((node) => walk(node, []));
  // 경이 많은 니까야는 목록을 묶음별 페이지로 나눈다 (src/lib/data.ts splitsIntoGroups 와 같은 기준)
  const total = n.nodes.flatMap(function collect(node): CatalogSutta[] {
    return [...node.suttas, ...node.children.flatMap(collect)];
  }).length;
  return entries.map((e) => ({
    ...e,
    trail: { ...e.trail, groupPages: total > INLINE_SUTTA_LIMIT },
  }));
});
mkdirSync(path.dirname(OUT_SUTTAS), { recursive: true });
// 경 읽기 오른쪽 칸의 참고 경전 · 해설 법문 · 기타 자료 (content/extras.json — 이 저장소에서 직접 고치는 파일)
{
  const extrasPath = path.join(ROOT, "content/extras.json");
  const extras = existsSync(extrasPath)
    ? extrasSchema.parse(readJson(extrasPath))
    : {};
  const known = new Set(suttaIndex.map((s) => s.id));
  addDhpStoryLinks(extras, known);
  for (const [id, kinds] of Object.entries(extras)) {
    if (!known.has(id))
      errors.push(`content/extras.json: "${id}" 경이 목록에 없습니다`);
    for (const item of Object.values(kinds).flat()) {
      if (item?.suttaId && !known.has(item.suttaId)) {
        errors.push(
          `content/extras.json: ${id} 의 참고 경 "${item.suttaId}" 가 목록에 없습니다`,
        );
      }
    }
  }
  if (errors.length) {
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  writeFileSync(
    path.join(path.dirname(OUT_SUTTAS), "extras.json"),
    JSON.stringify(extras),
  );
}
// 검색에서 경 제목으로 찾도록 — 한국어 번역들의 경 제목 (0.x 줄의 마지막 글, 예: "새김확립 긴 경", "무아상경(無我相經)")
{
  const titles = new Map<string, Set<string>>();
  for (const text of texts) {
    if (editionById.get(text.editionId)?.language !== "ko") continue;
    const head = text.segments.filter((seg) => /:0\.\d+$/.test(seg.key));
    const last = head.at(-1);
    if (!last) continue;
    const t = last.parts
      .map((p) => (p.type === "note" ? "" : p.text))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!t || t.length > 60) continue;
    const set = titles.get(text.suttaId) ?? new Set<string>();
    set.add(t);
    titles.set(text.suttaId, set);
  }
  writeFileSync(
    path.join(path.dirname(OUT_SUTTAS), "sutta-titles.json"),
    JSON.stringify(
      suttaTitlesSchema.parse(
        Object.fromEntries([...titles].map(([id, set]) => [id, [...set]])),
      ),
    ),
  );
  console.log(`경 제목(한국어 번역): 경 ${titles.size}개`);
}
// 병행 경전 (content/parallels.json — scripts/import-parallels.py). 니까야마다 파일 하나.
{
  const file = path.join(ROOT, "content/parallels.json");
  const parallels = existsSync(file)
    ? parallelsSchema.parse(readJson(file))
    : {};
  const nikayaOf = new Map(suttaIndex.map((s) => [s.id, s.nikaya]));
  const out = new Map<string, Record<string, unknown>>();
  let missing = 0;
  for (const [id, list] of Object.entries(parallels)) {
    const nikaya = nikayaOf.get(id);
    const kept = list.filter((p) => nikayaOf.has(p.s));
    missing += list.length - kept.length;
    if (!nikaya || kept.length === 0) continue;
    out.set(nikaya, { ...out.get(nikaya), [id]: kept });
  }
  const dir = path.join(path.dirname(OUT_SUTTAS), "parallels");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [nikaya, body] of out)
    writeFileSync(path.join(dir, `${nikaya}.json`), JSON.stringify(body));
  if (missing)
    warnings.push(
      `병행 경전: 목록에 없는 경으로 가는 연결 ${missing}건은 뺐습니다`,
    );
  console.log(
    `병행 경전: 경 ${Object.keys(parallels).length}개 (니까야 ${out.size}개 파일)`,
  );
}
// VRI 경로 줄 — content/vri-paths.json (scripts/import-vri-paths.py) 을 니까야마다 한 파일로.
// 이름은 한 번만 적고(names) 경마다 번호로 — public/data/vri-paths/<니까야>.json
{
  const pathsFile = path.join(ROOT, "content", "vri-paths.json");
  const OUT_PATHS = path.join(ROOT, "public/data/vri-paths");
  rmSync(OUT_PATHS, { recursive: true, force: true });
  if (existsSync(pathsFile)) {
    mkdirSync(OUT_PATHS, { recursive: true });
    const all = z
      .record(
        z.string(),
        z.object({
          path: z.array(z.string()),
          // [문단, 소제목] 또는 장 제목이면 [문단, 장 제목, 1]
          heads: z
            .array(
              z.union([
                z.tuple([z.string(), z.string()]),
                z.tuple([z.string(), z.string(), z.literal(1)]),
              ]),
            )
            .optional(),
        }),
      )
      .parse(readJson(pathsFile));
    // 주석서·복주석서 경로 — content/vri-comm-paths.json (scripts/import-vri-comm-paths.py)
    const commFile = path.join(ROOT, "content", "vri-comm-paths.json");
    // 경 → 층 → [[주석 문단, 그 문단부터의 경로], …] (경로가 바뀌는 자리만)
    const comm = existsSync(commFile)
      ? z
          .record(
            z.string(),
            z.object({
              attha: z
                .array(z.tuple([z.number(), z.array(z.string())]))
                .optional(),
              tika: z
                .array(z.tuple([z.number(), z.array(z.string())]))
                .optional(),
            }),
          )
          .parse(readJson(commFile))
      : {};
    const byNikaya = new Map<string, typeof suttaIndex>();
    for (const s of suttaIndex)
      if (all[s.id] || comm[s.id])
        byNikaya.set(s.nikaya, [...(byNikaya.get(s.nikaya) ?? []), s]);
    for (const [nikaya, list] of byNikaya) {
      const names: string[] = [];
      const at = new Map<string, number>();
      const idx = (name: string) => {
        if (!at.has(name)) {
          at.set(name, names.length);
          names.push(name);
        }
        return at.get(name)!;
      };
      // 주석 경로는 같은 경로가 여러 번 나오므로 경로 표(paths)에 한 번만
      const paths: number[][] = [];
      const pathAt = new Map<string, number>();
      const pathIdx = (p: string[]) => {
        const k = p.join("\u0000");
        if (!pathAt.has(k)) {
          pathAt.set(k, paths.length);
          paths.push(p.map(idx));
        }
        return pathAt.get(k)!;
      };
      const suttas = list.map((s) => {
        const e = all[s.id] ?? { path: [], heads: [] as [string, string][] };
        const c = comm[s.id] ?? {};
        return [
          s.id,
          e.path.map(idx),
          (e.heads ?? []).map((h) =>
            h.length === 3 ? [h[0], idx(h[1]), 1] : [h[0], idx(h[1])],
          ),
          Object.fromEntries(
            (["attha", "tika"] as const)
              .filter((l) => c[l]?.length)
              .map((l) => [l, c[l]!.map(([para, p]) => [para, pathIdx(p)])]),
          ),
        ];
      });
      writeFileSync(
        path.join(OUT_PATHS, `${nikaya}.json`),
        JSON.stringify({ names, paths, suttas }),
      );
    }
    console.log(
      `VRI 경로 줄: 경 ${Object.keys(all).length}개 (니까야 ${byNikaya.size}개 파일)`,
    );
  }
}
// VRI 묶음 파일: 목록 차례대로 경을 모아 ~400KB 가 넘으면 다음 묶음. 본문(t-)과 주석(c-)은 따로.
const OUT_VRI = path.join(ROOT, "public/data/vri");
rmSync(OUT_VRI, { recursive: true, force: true });
mkdirSync(OUT_VRI, { recursive: true });
{
  const SHARD_BYTES = 400_000;
  const order = new Map(suttaIndex.map((s, i) => [s.id, i]));
  const byOrder = <T extends { suttaId: string }>(list: T[]) =>
    [...list].sort(
      (a, b) => (order.get(a.suttaId) ?? 0) - (order.get(b.suttaId) ?? 0),
    );
  const shardOf = new Map<string, { t?: number; c?: number }>();
  const writeShards = (
    kind: "t" | "c",
    items: { suttaId: string; body: unknown }[],
  ) => {
    let shard: Record<string, unknown> = {};
    let bytes = 0;
    let n = 0;
    const flush = () => {
      if (Object.keys(shard).length === 0) return;
      writeFileSync(
        path.join(OUT_VRI, `${kind}-${n}.json`),
        JSON.stringify(shard),
      );
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
    ? z
        .record(
          z.string(),
          z.array(z.tuple([z.string(), z.string(), z.string()])),
        )
        .parse(readJson(pagesFile))
    : {};
  // 수따센따 참조 번호(PTS 문단·냐나몰리 문단·스리랑카·태국·날란다·미얀마 인쇄본) — content/sc-refs.json (scripts/import-sc-refs.py)
  const scRefsFile = path.join(ROOT, "content", "sc-refs.json");
  if (existsSync(scRefsFile)) {
    const refs = z
      .record(
        z.string(),
        z.array(z.tuple([z.string(), z.string(), z.string()])),
      )
      .parse(readJson(scRefsFile));
    for (const [id, list] of Object.entries(refs))
      pages[id] = [...(pages[id] ?? []), ...list];
  }
  const tCount = writeShards(
    "t",
    byOrder(vriTexts).map((t) => ({
      suttaId: t.suttaId,
      body: {
        s: suttaTextSchema.parse(t).segments,
        p: pages[t.suttaId] ?? [],
        ...(vriUnsure.has(t.suttaId) ? { u: vriUnsure.get(t.suttaId) } : {}),
        ...(vriPreface.has(t.suttaId) ? { h: vriPreface.get(t.suttaId) } : {}),
        ...(vriNumbers.has(t.suttaId) ? { n: vriNumbers.get(t.suttaId) } : {}),
      },
    })),
  );
  const grouped = new Map<
    string,
    Partial<Record<"attha" | "tika", SuttaCommentary>>
  >();
  for (const c of commentaryFiles) {
    grouped.set(c.suttaId, {
      ...grouped.get(c.suttaId),
      [c.layer]: suttaCommentarySchema.parse(c),
    });
  }
  const cCount = writeShards(
    "c",
    byOrder([...grouped].map(([suttaId, body]) => ({ suttaId, body }))),
  );
  for (const entry of suttaIndex) {
    const at = shardOf.get(entry.id);
    if (at?.t !== undefined) entry.vri = { t: at.t, c: at.c ?? null };
  }
  console.log(
    `VRI 묶음: 본문 ${tCount}개 · 주석 ${cCount}개 (경 ${vriTexts.length}개)`,
  );
}
// 경이 아주 많은 판본(PTS — 경 5천여 개)은 경마다 파일을 두면 호스팅 파일 수 한도(2만 개)를 넘는다.
// VRI 처럼 목록 차례대로 ~400KB 씩 묶어 public/data/shards/<판본>-<n>.json 에 두고, 목록(sutta-index)에 몇 번 묶음인지 적는다.
const SHARDED_EDITIONS = new Set(["pli-pts"]);
const OUT_SHARDS = path.join(ROOT, "public/data/shards");
rmSync(OUT_SHARDS, { recursive: true, force: true });
mkdirSync(OUT_SHARDS, { recursive: true });
{
  const SHARD_BYTES = 400_000;
  const order = new Map(suttaIndex.map((s, i) => [s.id, i]));
  const entryOf = new Map(suttaIndex.map((s) => [s.id, s]));
  for (const editionId of SHARDED_EDITIONS) {
    const list = texts
      .filter((t) => t.editionId === editionId)
      .sort(
        (a, b) => (order.get(a.suttaId) ?? 0) - (order.get(b.suttaId) ?? 0),
      );
    let shard: Record<string, unknown> = {};
    let bytes = 0;
    let n = 0;
    const flush = () => {
      if (Object.keys(shard).length === 0) return;
      writeFileSync(
        path.join(OUT_SHARDS, `${editionId}-${n}.json`),
        JSON.stringify(shard),
      );
      shard = {};
      bytes = 0;
      n++;
    };
    for (const text of list) {
      const body = suttaTextSchema.parse(text);
      const json = JSON.stringify(body);
      if (bytes > 0 && bytes + json.length > SHARD_BYTES) flush();
      shard[text.suttaId] = body;
      bytes += json.length;
      const entry = entryOf.get(text.suttaId);
      if (entry) entry.shards = { ...entry.shards, [editionId]: n };
    }
    flush();
    console.log(`${editionId} 묶음: ${n}개 (경 ${list.length}개)`);
  }
}
writeFileSync(
  path.join(path.dirname(OUT_SUTTAS), "sutta-index.json"),
  JSON.stringify(suttaIndexSchema.parse(suttaIndex)),
);

rmSync(OUT_SUTTAS, { recursive: true, force: true });
for (const text of texts) {
  if (SHARDED_EDITIONS.has(text.editionId)) continue; // 위에서 묶음 파일로 썼다
  const dir = path.join(OUT_SUTTAS, text.suttaId);
  mkdirSync(dir, { recursive: true });
  const notes = embeddedNotes.get(`${text.suttaId}/${text.editionId}`);
  const checked = suttaTextSchema.parse(notes ? { ...text, notes } : text);
  // 복사를 막아 둔 번역(법현 스님)은 자료 파일을 그대로 읽을 수 없게 감싼다 (src/lib/seal.ts)
  const body =
    editionById.get(text.editionId)?.allowCopy === false
      ? {
          suttaId: checked.suttaId,
          editionId: checked.editionId,
          sealed: seal(checked.segments, checked.suttaId, checked.editionId),
        }
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
    for (const [prefix, kind] of [
      ["", "text"],
      ["nissaya_", "nissaya"],
      ["paligrammar_", "grammar"],
    ] as const) {
      const file = path.join(dir, `${prefix}${base}.txt`);
      if (!existsSync(file)) continue;
      const sections = parse(readFileSync(file, "utf8"));
      if (sections.length === 0)
        warnings.push(
          `판본 정보 ${path.basename(file)}: 단락 제목(<big>)이 없습니다`,
        );
      else groups.push({ kind, sections });
    }
    if (groups.length === 0) continue;
    const info = editionInfoSchema.parse({ editionId: edition.id, groups });
    writeFileSync(
      path.join(outDir, `${edition.id}.json`),
      JSON.stringify(info),
    );
    count++;
  }
  console.log(`판본 정보 ${count}개`);
}
for (const kind of ["nissaya", "grammar"] as const) {
  const list = analysisFiles.filter((f) => f.kind === kind);
  if (list.length) {
    console.log(
      `${kind === "nissaya" ? "대역" : "문법분석"}: ${list.map((n) => `${n.suttaId}(${n.editionId})`).join(", ")}`,
    );
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
console.log(
  `검색 색인: 조각 ${searchShards.size}개, ${(searchBytes / 1e6).toFixed(1)}MB`,
);

// ── 보고 ────────────────────────────────────────────────────
const withText = allSuttas.filter((s) => s.editions.length > 0);
console.log(
  `경전 목록: ${allSuttas.length}개 경 (본문 있음 ${withText.length}개)`,
);
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
    notesFiles.find(
      (n) => n.suttaId === t.suttaId && n.editionId === t.editionId,
    )?.notes.length ?? 0;
  byEdition.set(t.editionId, row);
}
console.table(Object.fromEntries(byEdition));
console.log(`본문 있는 경: ${withText.map((s) => s.id).join(", ")}`);
for (const w of warnings) console.warn(`경고: ${w}`);
console.log("변환 오류: 0건");

/**
 * 법구경 주석서 이야기 ↔ 자따까·우다나·장로니게경·천궁사·아귀사 주석서·니까야·율장 (content/dhp-story-links.tsv, 사용자 목록)
 * 양쪽 '참고 경전' 칸에 서로 넣는다. 법구경 쪽은 그 이야기가 시작되는 주석서 문단(content/dhp-story-paras.json)으로 간다.
 * 율장처럼 이 사이트에 없는 문헌(경 번호 "-")은 법구경 쪽에 이름만 적는다.
 */
function addDhpStoryLinks(
  extras: Record<string, SuttaExtras>,
  known: Set<string>,
) {
  const tsvPath = path.join(ROOT, "content/dhp-story-links.tsv");
  if (!existsSync(tsvPath)) return;
  const stories = z
    .record(
      z.string(),
      z.object({ suttaId: z.string(), para: z.number().int(), title: z.string() }),
    )
    .parse(readJson(path.join(ROOT, "content/dhp-story-paras.json")));
  const rows = readFileSync(tsvPath, "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => l.split("\t"));
  const push = (id: string, item: ExtraItem) => {
    const kinds = (extras[id] ??= {});
    (kinds.refs ??= []).push(item);
  };
  const dhpSide: [number, string, ExtraItem][] = [];
  for (const [i, cols] of rows.entries()) {
    const [verses, target, layer, name, note = ""] = cols;
    const first = verses?.split("~")[0];
    const story = first ? stories[first] : undefined;
    if (cols.length < 4 || !verses || !target || !layer || !name || !story) {
      errors.push(`content/dhp-story-links.tsv ${i + 1}번째 줄: 칸이 모자라거나 게송 ${first} 이야기 자리를 모릅니다`);
      continue;
    }
    if (target !== "-" && !known.has(target)) {
      errors.push(`content/dhp-story-links.tsv: "${target}" 경이 목록에 없습니다`);
      continue;
    }
    const verseLabel = `게송 ${verses}번 이야기`;
    const linked = target !== "-";
    dhpSide.push([
      Number(first),
      story.suttaId,
      {
        title: `${verseLabel} — ${name}${linked && layer === "attha" ? " (주석서)" : ""}`,
        ...(linked ? { suttaId: target } : {}),
        ...(linked && layer === "attha" ? { layer: "attha" as const } : {}),
        note: [linked ? null : "이 사이트에는 아직 없는 문헌", note.trim() || null]
          .filter(Boolean)
          .join(" · ") || null,
      },
    ]);
    if (linked) {
      push(target, {
        title: `법구경 ${verseLabel} (주석서 — ${story.title})`,
        suttaId: story.suttaId,
        layer: "attha",
        anchor: `attha-p${story.para}`,
        note: note.trim() || null,
      });
    }
  }
  // 법구경 쪽은 게송 차례로
  dhpSide.sort((a, b) => a[0] - b[0]);
  for (const [, id, item] of dhpSide) push(id, item);
}
