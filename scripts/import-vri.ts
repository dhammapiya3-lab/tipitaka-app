/**
 * VRI(6차 결집본) 원문과 주석서·복주석서를 E-Piṭaka DB 에서 꺼내 경 하나씩 content/vri/<경>.json 으로 만든다.
 *
 *   EPITAKA_DB=경로/epitaka.db pnpm import:vri sn56.11 [dn22 …]
 *
 * - 경 찾기: headings.sc_id (SuttaCentral 경 번호) → VRI 책·문단 범위
 * - 원문: sentences (문단·줄). 마하상기띠본(pli-ms) 문장 번호에 맞춰 붙인다 — 빌랄라는 VRI 한 줄을 여러 문장으로
 *   더 잘게 나누는 일이 많아서, VRI 한 줄을 그 줄이 덮는 첫 빌랄라 문장 번호에 둔다(MASTER-PLAN.md 빌랄라 vs VRI).
 * - 주석서·복주석서: book_links 로 이 경의 문단과 이어진 문단을 모으고, 어느 경 문단을 풀이하는지 함께 적는다.
 * 만든 파일은 사람이 읽고 고칠 수 있다(맞춤이 어긋난 곳). `pnpm build:content` 가 이 파일을 사이트 자료로 옮긴다.
 *
 * 출처: VRI Chaṭṭha Saṅgāyana Tipiṭaka (비영리 무료·출처 표시), E-Piṭaka(dhammanana/epitaka_app, CC BY-NC 4.0)
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { EPITAKA_DB, SOURCE_ROOT } from "./paths";
import { paragraphOf } from "../src/lib/segments";

const args = process.argv.slice(2);
/** --all: 사이트 목록(public/data/sutta-index.json)의 모든 경 */
const ids =
  args[0] === "--all"
    ? (
        JSON.parse(
          readFileSync(
            path.join(process.cwd(), "public/data/sutta-index.json"),
            "utf8",
          ),
        ) as { id: string }[]
      ).map((s) => s.id)
    : args;
if (ids.length === 0) {
  console.error(
    "경 번호를 적어 주세요. 예: pnpm import:vri sn56.11 (모두: pnpm import:vri --all)",
  );
  process.exit(1);
}
const quiet = ids.length > 20;
/** 사이트 목록의 경 차례 — 글로 자리를 찾을 때 앞 경이 끝난 곳부터 찾는다 */
const ORDER = (
  JSON.parse(
    readFileSync(
      path.join(process.cwd(), "public/data/sutta-index.json"),
      "utf8",
    ),
  ) as { id: string }[]
).map((s) => s.id);

const db = new DatabaseSync(EPITAKA_DB, { readOnly: true });
const OUT = path.join(process.cwd(), "content/vri");
mkdirSync(OUT, { recursive: true });

interface Line {
  para: number;
  line: number;
  vripara: number | null;
  text: string;
}

/** VRI 글의 따옴표·띄어쓰기를 다듬는다 (‘‘ x → “x, x ’’ → x”) */
function tidy(text: string): string {
  return text
    .replace(/’’’/g, "’”")
    .replace(/‘‘\s*/g, "“")
    .replace(/\s*’’/g, "”")
    .replace(/‘\s+/g, "‘")
    .replace(/\s+’/g, "’")
    .replace(/’\s+ti\b/g, "’ti")
    .replace(/”\s+ti\b/g, "”ti")
    .replace(/\s+([,.;:?!])/g, "$1")
    .replace(/^\d+\.\s*/, "") // 문단 번호(1081.)는 따로 둔다
    .replace(/\s+/g, " ")
    .trim();
}

/** 맞춰 보기용: 소문자, ṁ→ṃ, 이본 [..] ·문장부호·띄어쓰기 없앰 */
function norm(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, "")
    .replace(/ṁ/g, "ṃ")
    .replace(/…\s*pe\s*…|\.\.\.pe\.\.\./g, "")
    .replace(/[^a-zāīūṃṅñṭḍṇḷ]/g, "");
}

/** norm() 과 같은 글자를 만들되, 글자마다 원래 글의 몇 번째 글자였는지도 돌려준다 (VRI 줄을 문장 자리에서 자를 때) */
function normWithIndex(text: string): { s: string; at: number[] } {
  const drop = new Uint8Array(text.length);
  for (const re of [/<[^>]*>/g, /\[[^\]]*\]/g, /…\s*pe\s*…|\.\.\.pe\.\.\./gi]) {
    for (const m of text.matchAll(re))
      drop.fill(1, m.index, m.index + m[0].length);
  }
  let out = "";
  const at: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (drop[i]) continue;
    const c = text[i].toLowerCase().replace("ṁ", "ṃ");
    if (/^[a-zāīūṃṅñṭḍṇḷ]$/.test(c)) {
      out += c;
      at.push(i);
    }
  }
  return { s: out, at };
}

// ── VRI 공식 원문(XML)으로 E-Piṭaka 글을 바로잡기 ─────────────────────────
// E-Piṭaka 의 글에는 옮기며 생긴 오류가 있다(예: "labhantntti" ← 공식 "labhanti"). 줄 나눔·문단 번호·낱말 연결은
// E-Piṭaka 것을 쓰되, 줄마다 글은 공식 원문(github.com/VipassanaTech/tipitaka-xml)에서 그 자리의 글로 바꾼다.
// 책 전체를 글자 단위로 맞춰, 각 줄이 공식 원문의 어디서 시작하는지 찾고 다음 줄 시작 전까지를 그 줄의 글로 삼는다
// (그래서 공식 원문의 글은 빠짐없이 들어가고, E-Piṭaka 에만 있는 글은 빠진다).
const XML_DIR =
  process.env.VRI_XML ??
  path.join(process.cwd(), "content", "tipitaka-xml", "romn");
const xmlStats = {
  books: 0,
  lines: 0,
  changed: 0,
  epitakaOnly: 0,
  missingXml: [] as string[],
};
const corrected = new Map<string, Map<string, string> | null>();

/** XML 파일 → 읽는 글 (이본 <note> 는 [ ] 로, 문단 끝은 줄바꿈) */
function xmlText(code: string): string | null {
  let raw: string;
  try {
    const buf = readFileSync(path.join(XML_DIR, `${code}.xml`));
    raw =
      buf[0] === 0xff && buf[1] === 0xfe
        ? buf.toString("utf16le")
        : buf.toString("utf8");
  } catch {
    return null;
  }
  return (
    raw
      .replace(/<pb [^>]*\/>/g, "")
      .replace(/\s*<note>([\s\S]*?)<\/note>/g, " [$1]")
      .replace(
        /<hi rend="paranum">([^<]*)<\/hi><hi rend="dot">([^<]*)<\/hi>/g,
        "$1$2 ",
      )
      .replace(/<\/(p|head|trailer)>/g, "\n")
      // 굵게(낱말 풀이의 표제 낱말)는 E-Piṭaka 처럼 <b> 로 남긴다
      .replace(/<hi rend="bold">([\s\S]*?)<\/hi>/g, "<b>$1</b>")
      .replace(/<(?!\/?b>)[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/[ \t]+/g, " ")
  );
}

function correctedBook(book: string): Map<string, string> | null {
  if (corrected.has(book)) return corrected.get(book)!;
  const code = (
    db.prepare("select vri_id from books where book_id = ?").get(book) as
      { vri_id: string } | undefined
  )?.vri_id;
  const R = code ? xmlText(code) : null;
  if (!R) {
    if (code) xmlStats.missingXml.push(`${book}(${code})`);
    corrected.set(book, null);
    return null;
  }
  const rows = db
    .prepare(
      "select para_id as para, line_id as line, pali as text from sentences where book_id = ? order by para_id, line_id",
    )
    .all(book) as unknown as { para: number; line: number; text: string }[];
  const X = normWithIndex(R);
  // E-Piṭaka 책 글자 줄 세우기
  let E = "";
  const eStart: number[] = [];
  for (const r of rows) {
    eStart.push(E.length);
    E += norm(tidy(String(r.text)));
  }
  // 글자 맞추기 (어긋나면 16글자 앞을 다시 찾아 잇는다)
  const map = new Int32Array(E.length).fill(-1);
  {
    const W = 16;
    let i = 0;
    // 책이 시작하는 자리: 한 XML 파일에 책이 둘 든 경우(아빠다나 2·3권)가 있어, 한 번만 나오는 긴 글 조각으로 찾는다
    let j = 0;
    for (const off of [0, 300, 2000, 10000]) {
      const chunk = E.slice(off, off + 80);
      const k = X.s.indexOf(chunk);
      if (chunk.length === 80 && k >= 0 && X.s.indexOf(chunk, k + 1) < 0) {
        j = Math.max(0, k - off);
        break;
      }
    }
    while (i < E.length && j < X.s.length) {
      if (E[i] === X.s[j]) {
        map[i++] = j++;
        continue;
      }
      const k = X.s.indexOf(E.slice(i, i + W), j);
      const back = E.indexOf(X.s.slice(j, j + W), i);
      if (k >= 0 && k - j < 6000 && (back < 0 || k - j <= back - i)) {
        j = k;
        continue;
      }
      if (back >= 0 && back - i < 6000) {
        i = back;
        continue;
      }
      i++;
      j++;
    }
  }
  // 줄마다 공식 원문에서의 시작 자리 (맞은 첫 글자)
  const startRaw: (number | null)[] = rows.map((r, n) => {
    const from = eStart[n];
    const to = n + 1 < rows.length ? eStart[n + 1] : E.length;
    for (let x = from; x < to; x++) if (map[x] >= 0) return X.at[map[x]];
    return null;
  });
  const out = new Map<string, string>();
  const OPEN = /[‘“'"(\[\s]/;
  for (let n = 0; n < rows.length; n++) {
    xmlStats.lines++;
    const key = `${rows[n].para}:${rows[n].line}`;
    const a0 = startRaw[n];
    if (a0 === null) {
      // 공식 원문에 없는 줄 (E-Piṭaka 에만 있음 — 제목 줄의 꾸밈 등)
      if (norm(String(rows[n].text))) xmlStats.epitakaOnly++;
      out.set(key, "");
      continue;
    }
    const back = (x: number, floor: number) => {
      for (;;) {
        if (x > floor && OPEN.test(R[x - 1]) && R[x - 1] !== "\n") x--;
        else if (x - 3 >= floor && R.slice(x - 3, x) === "<b>") x -= 3;
        else return x;
      }
    };
    const a = back(a0, 0);
    let nextStart = R.length;
    for (let m = n + 1; m < rows.length; m++) {
      if (startRaw[m] !== null) {
        nextStart = back(startRaw[m]!, a);
        break;
      }
    }
    // 책 끝 줄: 다음 문단 끝까지만
    const end =
      nextStart === R.length
        ? R.indexOf("\n", a) < 0
          ? R.length
          : R.indexOf("\n", a)
        : nextStart;
    // 줄 끝에 걸친 굵게 표시는 줄 안에서 닫는다
    let text = tidy(R.slice(a, end).replace(/\n+/g, " "));
    const opens =
      (text.match(/<b>/g) ?? []).length - (text.match(/<\/b>/g) ?? []).length;
    if (opens > 0) text += "</b>".repeat(opens);
    else if (opens < 0) text = "<b>".repeat(-opens) + text;
    const before = tidy(String(rows[n].text));
    if (norm(text) !== norm(before) || text !== before) xmlStats.changed++;
    out.set(key, text);
  }
  xmlStats.books++;
  corrected.set(book, out);
  return out;
}

function linesOf(book: string, from: number, to: number): Line[] {
  const fix = correctedBook(book);
  return (
    db
      .prepare(
        "select para_id as para, line_id as line, vripara, pali as text from sentences where book_id = ? and para_id between ? and ? order by para_id, line_id",
      )
      .all(book, from, to) as unknown as Line[]
  ).map((l) => ({
    ...l,
    text:
      fix?.get(`${l.para}:${l.line}`) ??
      (book.startsWith("Ja-ṭ-") ? cleanJatakaTika : tidy)(String(l.text)),
  }));
}

/**
 * 자따까 새 복주석서(Jātaka-abhinavaṭīkā) — VRI 공식 원문에 없어 E-Piṭaka 글을 그대로 쓴다.
 * 이 책에만 있는 글꼴 흔적을 다듬는다 (글 내용은 바꾸지 않는다):
 * 문장 끝 ".." → ".", l̤ → ḷ (같은 글자의 다른 표기), 인쇄본 각주 번호 <sup>1</sup> (각주 글이 없어) 지움.
 */
function cleanJatakaTika(text: string): string {
  return tidy(
    text
      .replace(/<\/?<sup>\d*<\/sup>|<sup>[^<]*<\/sup>/g, "")
      .replace(/<br\s*\/?>/g, " ")
      .replace(/l̤/g, "ḷ")
      .replace(/L̤/g, "Ḷ")
      .replace(/\.\.+/g, "."),
  );
}

/**
 * 자따까 복주석서: 경(자따까 원문)과 복주석서를 잇는 낱말 연결이 없어, 복주석서의 자따까 제목
 * ("1-apaṇṇakajātakavaṇṇanā (1)" — 괄호 안이 자따까 번호)으로 그 자따까의 풀이를 찾는다.
 * 다음 자따까 제목이나 품·편 제목 앞까지가 그 자따까의 풀이다. 복주석서가 풀이하지 않은 자따까는 제목이 없다.
 */
const JA_TIKA_BOOKS = ["Ja-ṭ-i", "Ja-ṭ-ii", "Ja-ṭ-iii", "Ja-ṭ-iv", "Ja-ṭ-v"];
let jaTikaSpans: Map<
  number,
  { book: string; from: number; to: number }
> | null = null;
function jatakaTikaSpan(num: number) {
  if (!jaTikaSpans) {
    jaTikaSpans = new Map();
    for (const book of JA_TIKA_BOOKS) {
      const heads = db
        .prepare(
          "select para_id, level, title from headings where book_id = ? and level < 10 order by para_id",
        )
        .all(book) as unknown as {
        para_id: number;
        level: number;
        title: string;
      }[];
      const lastPara = (
        db
          .prepare("select max(para_id) n from sentences where book_id = ?")
          .get(book) as { n: number }
      ).n;
      // 경계: 번호 붙은 자따까 제목, 품(vagga)·편(nipāta) 제목. (자따까 끝맺음 줄 "…jātakaṃ.." 은 경계가 아니다)
      const marks: { para: number; num: number | null }[] = [];
      let prevNum = 0;
      for (const h of heads) {
        const t = String(h.title);
        const m = t.match(/jātakavaṇṇanā\s*\((\d+)\)/);
        if (m) {
          let n = Number(m[1]);
          if (n <= prevNum) n = prevNum + 1; // 제목 번호 오타 (예: 53 이 "(43)" 으로) — 차례를 따른다
          if (marks.at(-1)?.para === h.para_id) continue; // 같은 제목이 두 번 적힌 곳
          marks.push({ para: h.para_id, num: n });
          prevNum = n;
        } else if (/vagga|nipāta/.test(t) && h.level <= 2)
          marks.push({ para: h.para_id, num: null });
      }
      marks.forEach((mk, i) => {
        if (mk.num === null) return;
        const next = marks.slice(i + 1).find((x) => x.para > mk.para);
        jaTikaSpans!.set(mk.num, {
          book,
          from: mk.para,
          to: next ? next.para - 1 : lastPara,
        });
      });
    }
  }
  return jaTikaSpans.get(num) ?? null;
}

/** 마하상기띠본 원문 파일: 파일 이름 → 경로 (한 번만 훑는다) */
const msFiles = new Map<string, string>();
(function walk(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith("_root-pli-ms.json"))
      msFiles.set(entry.name, full);
  }
})(path.join(SOURCE_ROOT, "sutta_pitaka"));

/** 경 번호 앞부분 → 찾아볼 E-Piṭaka 책 (목차에 수따센트럴 번호가 없을 때) */
const BOOKS_BY_PREFIX: Record<string, string[]> = {
  dn: ["D-i", "D-ii", "D-iii"],
  mn: ["M-i", "M-ii", "M-iii"],
  sn: ["S-i", "S-ii", "S-iii", "S-iv", "S-v"],
  an: [
    "A-i",
    "A-ii",
    "A-iii",
    "A-iv",
    "A-v",
    "A-vi",
    "A-vii",
    "A-viii",
    "A-ix",
    "A-x",
    "A-xi",
  ],
  kp: ["Khp"],
  dhp: ["Dhp"],
  ud: ["Ud"],
  iti: ["It"],
  snp: ["Sn"],
  vv: ["Vv"],
  pv: ["Pv"],
  thag: ["Th"],
  thig: ["Thī"],
  "tha-ap": ["Ap-i", "Ap-ii"],
  "thi-ap": ["Ap-iii", "Ap-ii"],
  bv: ["Bv"],
  cp: ["Cp"],
  ja: ["Ja-i", "Ja-ii"],
  mnd: ["Nidd-i"],
  cnd: ["Nidd-ii"],
  ps: ["Paṭis"],
  ne: ["Nett"],
  pe: ["Pet"],
  mil: ["Mil"],
};
/** 책마다 맞춰 보기용 글 (한 번만 만든다) */
const bookStreams = new Map<
  string,
  { text: string; starts: number[]; lines: Line[] }
>();
function bookStream(book: string) {
  let s = bookStreams.get(book);
  if (!s) {
    const lines = (
      db
        .prepare(
          "select para_id as para, line_id as line, vripara, pali as text from sentences where book_id = ? order by para_id, line_id",
        )
        .all(book) as unknown as Line[]
    ).map((l) => ({ ...l, text: tidy(String(l.text)) }));
    const starts: number[] = [];
    let text = "";
    for (const l of lines) {
      starts.push(text.length);
      text += norm(l.text);
    }
    s = { text, starts, lines };
    bookStreams.set(book, s);
  }
  return s;
}
/** 같은 책에서 앞서 찾은 경 다음부터 찾는다 (같은 글이 되풀이되는 책) */
const lastFound = new Map<string, number>();
function locate(suttaId: string) {
  const prefix = suttaId.replace(/[\d.\-]+$/, "");
  const file = msFiles.get(`${suttaId}_root-pli-ms.json`);
  if (!file) return null;
  const segs = Object.entries(
    JSON.parse(readFileSync(file, "utf8")) as Record<string, string>,
  )
    .filter(([key]) => !/:0(\.|$)/.test(key))
    .map(([, t]) => norm(t))
    .filter(Boolean);
  const body = segs.join("");
  if (body.length < 20) return null;
  const A = Math.min(40, Math.floor(body.length / 3));
  // 첫머리·끝머리 글로 찾는다. 맨 앞의 "namo tassa…" 처럼 E-Piṭaka 에서 자리가 다른 줄이 있으면 다음 문장부터 다시 찾는다
  const heads: { text: string; skip: number }[] = [];
  const tails: string[] = [];
  for (
    let i = 0, off = 0;
    i < Math.min(8, segs.length);
    off += segs[i].length, i++
  )
    heads.push({ text: body.slice(off, off + A), skip: off });
  for (
    let i = segs.length - 1, end = body.length;
    i >= Math.max(0, segs.length - 8);
    end -= segs[i].length, i--
  )
    tails.push(body.slice(Math.max(0, end - A), end));
  // 앞 경이 있던 책부터 본다
  let prevBook: string | null = null;
  try {
    prevBook = (
      JSON.parse(
        readFileSync(
          path.join(OUT, `${ORDER[ORDER.indexOf(suttaId) - 1]}.json`),
          "utf8",
        ),
      ) as { source: { book: string } }
    ).source.book;
  } catch {
    // 없으면 차례대로
  }
  const candidates = BOOKS_BY_PREFIX[prefix] ?? [];
  for (const book of prevBook && candidates.includes(prevBook)
    ? [prevBook, ...candidates.filter((b) => b !== prevBook)]
    : candidates) {
    const s = bookStream(book);
    if (s.lines.length === 0) continue;
    // 앞 경(목록 차례)이 끝난 자리부터 찾는다 — 같은 글이 되풀이되는 책(생략 경·아빠다나 정형구)이 많아서
    const prevId = ORDER[ORDER.indexOf(suttaId) - 1];
    let from = lastFound.get(book) ?? 0;
    try {
      const prev = JSON.parse(
        readFileSync(path.join(OUT, `${prevId}.json`), "utf8"),
      ) as { source: { book: string; paras: [number, number] } };
      if (prev.source.book === book) {
        const k = s.lines.findIndex((l) => l.para > prev.source.paras[1]);
        if (k >= 0) from = Math.max(from, s.starts[k]);
      }
    } catch {
      // 앞 경 파일이 없으면 그대로
    }
    // 첫머리가 나오는 자리마다 끝머리가 뒤따르는지 보고, 가장 짧게 이어지는 쌍을 고른다
    // (수따센트럴 쪽이 줄여 쓴 경은 VRI 가 훨씬 길 수 있어 넉넉히 본다)
    const window = Math.max(body.length * 3 + 2000, 25000);
    let at = -1;
    let endAt = -1;
    let tailText = "";
    for (const start of [from, 0]) {
      for (const h of heads) {
        if (h.text.length < 16) continue;
        for (
          let k = s.text.indexOf(h.text, start), tries = 0;
          k >= 0 && tries < 60;
          k = s.text.indexOf(h.text, k + 1), tries++
        ) {
          const a0 = Math.max(0, k - h.skip);
          // 끝머리는 맨 끝 문장부터 (찾으면 그것을 쓴다)
          for (const t of tails) {
            if (t.length < 16) continue;
            const e = s.text.indexOf(t, a0);
            if (e < 0 || e - a0 > window) continue;
            at = a0;
            endAt = e;
            tailText = t;
            break;
          }
          // 앞에서부터 처음 맞는 자리를 쓴다 (경 안에서 첫머리 글이 되풀이되면 뒤쪽 자리는 경 앞부분이 잘린다)
          if (at >= 0) break;
        }
        // 앞 문장의 첫머리로 찾았으면 그것을 쓴다 (뒤 문장으로 찾으면 경 앞부분이 잘릴 수 있다)
        if (at >= 0) break;
      }
      if (at >= 0) break;
    }
    if (endAt < 0) continue;
    const lineAt = (offset: number) => {
      let lo = 0;
      let hi = s.starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (s.starts[mid] <= offset) lo = mid;
        else hi = mid - 1;
      }
      return s.lines[lo];
    };
    const a = lineAt(at);
    const b = lineAt(endAt + tailText.length - 1);
    lastFound.set(book, endAt);
    // 경 이름: 그 자리 앞의 가장 가까운 E-Piṭaka 목차 제목
    const title =
      (
        db
          .prepare(
            "select title from headings where book_id = ? and para_id < ? order by para_id desc limit 1",
          )
          .get(book, a.para) as { title: string } | undefined
      )?.title ?? "";
    return {
      head: { book_id: book, para_id: a.para - 1, chapter_len: 0, title },
      first: a.para,
      last: b.para,
    };
  }
  return null;
}

const stats = {
  done: 0,
  lines: 0,
  unmatched: 0,
  unsure: [] as string[],
  gaps: 0,
  segs: 0,
  missing: [] as string[],
  located: [] as string[],
  withUnmatched: [] as string[],
};
for (const suttaId of ids) {
  const heads = db
    .prepare(
      "select book_id, para_id, chapter_len, title from headings where sc_id = ? order by level, para_id",
    )
    .all(suttaId) as unknown as {
    book_id: string;
    para_id: number;
    chapter_len: number;
    title: string;
  }[];
  // E-Piṭaka 목차에 수따센트럴 번호가 없는 경(붓다왐사·닛데사·아빠다나 일부·상윳따 생략 경 등)은 글로 자리를 찾는다
  const found = heads.length ? null : locate(suttaId);
  if (heads.length === 0 && !found) {
    if (!quiet)
      console.error(
        `${suttaId}: E-Piṭaka 에서 경을 찾지 못했습니다 (headings.sc_id · 글 찾기)`,
      );
    stats.missing.push(suttaId);
    continue;
  }
  if (found) stats.located.push(suttaId);
  const head = found ? found.head : heads[0];
  const book = head.book_id;
  const first = found ? found.first : head.para_id + 1;
  // 한 경이 목차 여러 칸(자따까 546·547 의 품들)으로 나뉘어 있으면 모두 합친 범위
  // 한 경이 목차 여러 칸(자따까 546·547 의 품들)으로 나뉘어 있으면 이어진 칸끼리 합친다
  // (같은 번호가 멀리 떨어진 다른 곳에도 붙어 있는 경우가 있어 — 아빠다나 — 이어진 것만)
  const ownLast = found
    ? found.last
    : [...heads]
        .sort((x, y) => x.para_id - y.para_id)
        .reduce(
          (end, h) =>
            h.para_id <= end + 2
              ? Math.max(end, h.para_id + h.chapter_len - 1)
              : end,
          head.para_id + head.chapter_len - 1,
        );
  // 경 뒤의 끝맺음 줄(품·책을 마치는 줄, 요약 게송 uddāna, 책 맺음말)도 이 경 끝에 둔다 — 다음 경이 시작하기 전까지
  const nextStart = (
    db
      .prepare(
        "select min(para_id) n from headings where book_id = ? and para_id > ? and sc_id is not null and sc_id != ?",
      )
      .get(book, ownLast, suttaId) as { n: number | null }
  ).n;
  const bookEnd = (
    db
      .prepare("select max(para_id) n from sentences where book_id = ?")
      .get(book) as { n: number }
  ).n;
  // 다음 경까지 몇 문단 안 될 때만(끝맺음 줄·요약 게송·다음 품 제목 정도) — 목차 번호 없이 글로 찾은 경은 늘리지 않는다
  // 번호가 붙은 다음 제목(다음 품·다음 경: "2. Nandanavaggo") 앞까지만 — 끝맺음 줄("Sagāthāvaggo paṭhamo.")은 번호가 없다
  const nextTitle =
    (
      db
        .prepare(
          "select para_id, level, title from headings where book_id = ? and level < 10 and para_id > ? and para_id <= ? order by para_id",
        )
        .all(book, ownLast, ownLast + 15) as unknown as {
        para_id: number;
        level: number;
        title: string;
      }[]
    ).find((h) => h.level <= 3 && /^\s*\(?\d/.test(String(h.title)))?.para_id ??
    null;
  const gapEnd =
    Math.min(nextStart ?? bookEnd + 1, nextTitle ?? bookEnd + 1) - 1;
  const last =
    !found && gapEnd > ownLast && gapEnd - ownLast <= 15 ? gapEnd : ownLast;
  /** 책·품 제목 줄 (목차에 있는 문단) — 경 안에 넣지 않는다 */
  const titleParas = new Set(
    (
      db
        .prepare(
          "select para_id from headings where book_id = ? and level < 10 and para_id between ? and ?",
        )
        .all(book, first, last) as unknown as {
        para_id: number;
      }[]
    ).map((h) => h.para_id),
  );
  const vri = linesOf(book, first, last).filter((l) => l.text);
  // 책의 첫 경이면 그 앞의 "Namo tassa bhagavato…" 같은 줄 (제목 줄은 빼고) — 경 문장과 섞지 않고 맨 위에 따로 보인다
  const bookStart = (
    db
      .prepare("select min(para_id) n from sentences where book_id = ?")
      .get(book) as { n: number }
  ).n;
  const isFirstOfBook =
    !found &&
    !db
      .prepare(
        "select 1 from headings where book_id = ? and sc_id is not null and para_id < ? limit 1",
      )
      .get(book, head.para_id);
  const preface = isFirstOfBook
    ? (() => {
        const titles = new Set(
          (
            db
              .prepare(
                "select para_id from headings where book_id = ? and level < 10 and para_id < ?",
              )
              .all(book, first) as unknown as { para_id: number }[]
          ).map((h) => h.para_id),
        );
        return linesOf(book, bookStart, first - 1)
          .filter(
            (l) =>
              l.text && !titles.has(l.para) && /namo\s+tassa/i.test(l.text),
          )
          .map((l) => l.text);
      })()
    : [];

  // 마하상기띠본 문장 (0.x 제목 줄 빼고)
  const msFile = msFiles.get(`${suttaId}_root-pli-ms.json`) ?? null;
  if (!msFile) {
    if (!quiet)
      console.error(`${suttaId}: 마하상기띠본 원문 파일을 찾지 못했습니다`);
    stats.missing.push(suttaId);
    continue;
  }
  const ms = Object.entries(
    JSON.parse(readFileSync(msFile, "utf8")) as Record<string, string>,
  ).filter(([key]) => !/:0(\.|$)/.test(key));

  // 글자 단위로 맞춘다: VRI 줄들과 빌랄라 문장들을 각각 한 줄로 이어(맞춰 보기용 글자만) 앞에서부터 같이 읽다가,
  // 어긋나면(이본·생략 표시) 다음 16글자가 다시 나오는 곳을 찾아 이어 간다.
  // VRI 줄의 첫 글자가 닿은 빌랄라 문장에 그 줄을 둔다 (줄 나눔이 달라도 같은 문장에 모인다).
  const segments: Record<string, string> = {};
  const vriToKey = new Map<string, string>(); // "para:line" → 빌랄라 문장 번호
  const unmatched: string[] = [];
  const vNorm = vri.map((l) => norm(l.text));
  const mNorm = ms.map(([, t]) => norm(t));
  const V = vNorm.join("");
  const M = mNorm.join("");
  const vStarts: number[] = [];
  vNorm.reduce((acc, t) => (vStarts.push(acc), acc + t.length), 0);
  const mStarts: number[] = [];
  mNorm.reduce((acc, t) => (mStarts.push(acc), acc + t.length), 0);
  const map = new Int32Array(V.length).fill(-1);
  {
    const W = 16;
    let i = 0;
    let j = 0;
    while (i < V.length && j < M.length) {
      if (V[i] === M[j]) {
        map[i++] = j++;
        continue;
      }
      const k = M.indexOf(V.slice(i, i + W), j);
      if (k >= 0 && k - j < 4000) {
        j = k;
        continue;
      }
      // 빌랄라 쪽 글이 VRI 에 없으면(또는 그 반대) VRI 쪽을 한 글자 넘긴다
      const back = V.indexOf(M.slice(j, j + W), i);
      if (back >= 0 && back - i < 4000) {
        i = back;
        continue;
      }
      i++;
    }
  }
  const segOf = (offset: number) => {
    let lo = 0;
    let hi = mStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (mStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  // VRI 줄 하나에 빌랄라 문장이 여럿 들어 있으면, 두 판본의 글이 그 자리 앞뒤로 똑같을 때만(확실할 때만) 그 자리에서 잘라 나눈다.
  // 글이 달라 자리가 애매하면 자르지 않고 앞 문장에 그대로 두고, 그 문장 번호를 unsure 에 적는다 (화면 표시·검토 목록).
  const SURE = 4; // 자르는 자리 앞뒤로 이만큼 글자가 똑같이 맞아야 확실하다고 본다
  const unsure = new Set<string>();
  const add = (key: string, text: string) => {
    if (text) segments[key] = segments[key] ? `${segments[key]} ${text}` : text;
  };
  let prevSeg = 0;
  vri.forEach((l, n) => {
    const from = vStarts[n];
    const to = from + vNorm[n].length;
    let hit = -1;
    let matched = 0;
    for (let x = from; x < to; x++) {
      if (map[x] >= 0) {
        if (hit < 0) hit = map[x];
        matched++;
      }
    }
    let seg = hit >= 0 ? segOf(hit) : prevSeg;
    if (seg < prevSeg) seg = prevSeg; // 차례를 거꾸로 가지 않는다
    // 책·품 제목 줄(목차에 있는 문단)은 빌랄라 쪽에 짝이 없으면 넣지 않는다 — 끝맺음 줄은 마지막 문장에 남는다
    if (titleParas.has(l.para) && matched < (to - from) / 2) return;
    // 경 뒤로 늘린 자리(끝맺음 줄)에서는 이 경 원문과 맞는 줄만 — 맞지 않는 줄은 다음 경(목차 번호가 없는 경)의 글이다
    if (l.para > ownLast && matched < (to - from) / 2) return;
    if (to > from && matched < (to - from) / 2)
      unmatched.push(`${l.para}:${l.line} ${l.text.slice(0, 40)}`);
    vriToKey.set(`${l.para}:${l.line}`, ms[seg]?.[0] ?? ms.at(-1)![0]);

    const { s: ns, at } = normWithIndex(l.text);
    const cuts: { raw: number; seg: number }[] = [];
    if (ns === vNorm[n]) {
      let cur = seg;
      for (let x = from + 1; x < to; x++) {
        if (map[x] < 0) continue;
        const s2 = segOf(map[x]);
        if (s2 <= cur) continue;
        const exact =
          map[x] === mStarts[s2] &&
          Array.from({ length: SURE }, (_, d) => d + 1).every(
            (d) =>
              (x - d < from || map[x - d] === map[x] - d) &&
              (x + d - 1 >= to || map[x + d - 1] === map[x] + d - 1),
          );
        if (exact) {
          let raw = at[x - from];
          while (raw > 0 && /[“‘(\[]/.test(l.text[raw - 1])) raw--;
          cuts.push({ raw, seg: s2 });
        } else {
          for (let k = cur + 1; k <= s2; k++) unsure.add(ms[cur]![0]);
        }
        cur = s2;
      }
    }
    let start = 0;
    let curSeg = seg;
    for (const c of cuts) {
      add(ms[curSeg]?.[0] ?? ms.at(-1)![0], l.text.slice(start, c.raw).trim());
      start = c.raw;
      curSeg = c.seg;
    }
    add(ms[curSeg]?.[0] ?? ms.at(-1)![0], l.text.slice(start).trim());
    prevSeg = curSeg;
  });
  // 경 이름 줄 — 마하상기띠본의 마지막 제목 줄(0.x) 자리에 VRI 경 이름을 둔다
  const msTitleKey = Object.keys(
    JSON.parse(readFileSync(msFile, "utf8")) as Record<string, string>,
  )
    .filter((k) => /:0\.\d+$/.test(k))
    .at(-1);
  const titled =
    msTitleKey && tidy(head.title)
      ? { [msTitleKey]: tidy(head.title).replace(/^\d+\.\s*/, "") }
      : {};

  /** 경 문단(VRI para) → 빌랄라 문단(sn56.11:2) */
  const paraToMark = (para: number, line?: number) => {
    const key =
      (line !== undefined ? vriToKey.get(`${para}:${line}`) : undefined) ??
      vri
        .filter((l) => l.para === para)
        .map((l) => vriToKey.get(`${l.para}:${l.line}`))[0];
    return key ? paragraphOf(key, suttaId) : null;
  };

  const meta = db
    .prepare("select attha_ref, tika_ref from books where book_id = ?")
    .get(book) as
    { attha_ref: string | null; tika_ref: string | null } | undefined;

  type Link = {
    src_para: number;
    src_line: number;
    dst_para: number;
    dst_line: number;
    word: string | null;
  };

  /** VRI 문단 번호 → 그 번호의 숫자들 ("1081" · "23-25" → 23,24,25) */
  const vriNumbers = (v: unknown) => {
    const m = String(v ?? "").match(/^(\d+)(?:-(\d+))?/);
    if (!m) return [];
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    return b - a > 50
      ? [a]
      : Array.from({ length: b - a + 1 }, (_, i) => a + i);
  };

  /**
   * 주석서 책이 여럿으로 나뉜 경우("Th-a-i Th-a-ii")가 있어 하나씩 본다.
   * 낱말 연결(book_links)이 없으면 VRI 문단 번호로 잇는다 — 주석 문단은 풀이하는 경 문단의 번호로 시작한다(예: "1081.").
   */
  function commentaryFor(
    ref: string | null | undefined,
    maxFallbackParas = 120,
  ) {
    for (const dstBook of (ref ?? "").split(/\s+/).filter(Boolean)) {
      const links = db
        .prepare(
          "select src_para, src_line, dst_para, dst_line, word from book_links where src_book = ? and src_para between ? and ? and dst_book = ? order by dst_para, dst_line",
        )
        .all(book, first, last, dstBook) as unknown as Link[];
      const result = commentary(dstBook, links);
      if (result) return result;
    }
    for (const dstBook of (ref ?? "").split(/\s+/).filter(Boolean)) {
      const mulaByNumber = new Map<number, Line>();
      for (const l of vri)
        for (const n of vriNumbers(l.vripara))
          if (!mulaByNumber.has(n)) mulaByNumber.set(n, l);
      if (mulaByNumber.size === 0) continue;
      const rows = db
        .prepare(
          "select para_id as para, line_id as line, vripara from sentences where book_id = ? and vripara is not null",
        )
        .all(dstBook) as unknown as {
        para: number;
        line: number;
        vripara: unknown;
      }[];
      const links: Link[] = [];
      for (const r of rows) {
        for (const n of vriNumbers(r.vripara)) {
          const m = mulaByNumber.get(n);
          if (m)
            links.push({
              src_para: m.para,
              src_line: m.line,
              dst_para: r.para,
              dst_line: r.line,
              word: null,
            });
        }
      }
      // 번호가 붙은 주석 문단 다음의 번호 없는 문단들도 그 풀이에 이어지므로, 다음 번호 문단 앞까지 포함한다
      if (links.length) {
        const lastDst = Math.max(...links.map((l) => l.dst_para));
        const nextNumbered = rows
          .map((r) => r.para)
          .filter((p) => p > lastDst)
          .sort((a, b) => a - b)[0];
        if (nextNumbered && nextNumbered - 1 > lastDst) {
          const tail = links.find((l) => l.dst_para === lastDst)!;
          links.push({
            ...tail,
            dst_para: Math.min(nextNumbered - 1, lastDst + 60),
            dst_line: 1,
          });
        }
      }
      const result = commentary(dstBook, links);
      // 번호가 책 안에서 되풀이되면(아빠다나 등) 엉뚱하게 넓게 잡히므로, 너무 길면 쓰지 않는다
      if (result && result.paras.length <= maxFallbackParas) return result;
    }
    return null;
  }

  function commentary(dstBook: string, links: Link[]) {
    if (links.length === 0) return null;
    // 같은 낱말이 멀리 떨어진 다른 경의 주석에도 걸리는 일이 있어(엉뚱한 링크), 연결된 문단을 가까운 것끼리
    // 묶어 가장 많이 걸린 묶음(과 그만큼 많이 걸린 묶음)만 쓴다.
    const linked = [...new Set(links.map((l) => l.dst_para))].sort(
      (a, b) => a - b,
    );
    const clusters: { from: number; to: number; n: number }[] = [];
    for (const para of linked) {
      const last = clusters.at(-1);
      const n = links.filter((l) => l.dst_para === para).length;
      if (last && para - last.to <= 60) {
        last.to = para;
        last.n += n;
      } else clusters.push({ from: para, to: para, n });
    }
    const best = Math.max(...clusters.map((c) => c.n));
    const kept = clusters.filter((c) => c.n >= best * 0.25);
    const from = Math.min(...kept.map((c) => c.from));
    const to = Math.max(...kept.map((c) => c.to));
    const lines = linesOf(dstBook, from, to);
    links.splice(
      0,
      links.length,
      ...links.filter((l) => l.dst_para >= from && l.dst_para <= to),
    );
    let cursor = 0;
    // 연결이 없는 줄은 바로 앞 줄의 문단을 따른다 — 문단을 넘어서도 이어진다 (이야기 문단 등)
    let last: string[] | null = null;
    const paras = [...new Set(lines.map((l) => l.para))].map((para) => {
      const own = links.filter((l) => l.dst_para === para);
      const refs = (
        [
          ...new Set(
            own.map((l) => paraToMark(l.src_para, l.src_line)).filter(Boolean),
          ),
        ] as string[]
      ).sort((a, b) => Number(a.split(":")[1]) - Number(b.split(":")[1]));
      const mine = lines.filter((l) => l.para === para && l.text);
      return {
        para,
        vripara:
          lines.find((l) => l.para === para && l.vripara)?.vripara ?? null,
        refs,
        lines: mine.map((l) => l.text),
        // 줄마다 풀이하는 경 문단 — 연결이 없는 줄은 바로 앞 줄을 따른다 (첫 줄들은 문단 전체의 연결)
        lineRefs: mine.map((l) => {
          const found = [
            ...new Set(
              own
                .filter((k) => k.dst_line === l.line)
                .map((k) => paraToMark(k.src_para, k.src_line))
                .filter(Boolean),
            ),
          ] as string[];
          if (found.length) {
            // 같은 낱말이 경의 여러 문단에 나오면 링크가 여럿 걸린다. 주석은 경의 차례를 따르므로
            // 지금 자리(cursor) 이후의 가장 가까운 문단 하나를 고른다.
            const num = (r: string) => Number(r.slice(r.indexOf(":") + 1));
            const sorted = found.sort((a, b) => num(a) - num(b));
            last = [sorted.find((r) => num(r) >= cursor) ?? sorted[0]];
            cursor = num(last[0]);
          }
          return last ?? (refs.length ? [refs[0]] : []);
        }),
      };
    });
    const info = db
      .prepare("select book_name, vri_id from books where book_id = ?")
      .get(dstBook) as {
      book_name: string;
      vri_id: string;
    };
    // 주석 문단 머리의 "경 문단" 번호는 줄마다 정한 문단에서 모은다 — 같은 낱말이 경의 다른 문단에도
    // 나와 걸린 엉뚱한 연결(예: 1번 문단 풀이에 12번이 붙는 것)을 빼기 위해서다
    const num = (r: string) => Number(r.match(/(\d+)(?:\.\d+)*$/)?.[1] ?? 0);
    for (const p of paras)
      p.refs = [...new Set(p.lineRefs.flat())].sort((a, b) => num(a) - num(b));
    // 법구경 주석서: 낱말 연결은 게송 풀이(Tattha …)에만 있어, 그 앞의 인연담(이야기)은 앞 게송에 붙어 버린다.
    // 이야기 하나(제목 줄 … "…vatthu …timaṃ. 30." 맺음 줄)를 통째로 그 이야기가 든 게송에 단다.
    if (info.book_name.startsWith("Dhammapada"))
      fixDhammapadaStories(paras, suttaId);
    // 낱말 연결: [경 문장 번호, 낱말, 주석 문단 순번, 그 문단 안 줄 순번] — 경의 낱말을 누르면 그 주석 줄로 간다
    const paraIndex = new Map(paras.map((p, i) => [p.para, i]));
    const lineIndex = new Map<string, number>();
    for (const para of paras) {
      lines
        .filter((l) => l.para === para.para && l.text)
        .forEach((l, i) => lineIndex.set(`${l.para}:${l.line}`, i));
    }
    const wordLinks: [string, string, number, number][] = [];
    const seenLink = new Set<string>();
    for (const l of links) {
      const key = vriToKey.get(`${l.src_para}:${l.src_line}`);
      const pi = paraIndex.get(l.dst_para);
      const li = lineIndex.get(`${l.dst_para}:${l.dst_line}`);
      const word = (l.word ?? "")
        .toLowerCase()
        .replace(/ṁ/g, "ṃ")
        .replace(/\s+/g, " ")
        .trim();
      if (!key || pi === undefined || li === undefined || !word) continue;
      // 같은 낱말이 경의 여러 곳에 나와 걸린 엉뚱한 연결은 뺀다 (그 주석 줄이 풀이하는 문단만)
      if (!paras[pi].lineRefs[li].includes(paragraphOf(key, suttaId))) continue;
      const id = `${key}|${word}|${pi}|${li}`;
      if (seenLink.has(id)) continue;
      seenLink.add(id);
      wordLinks.push([key, word, pi, li]);
    }
    return {
      book: dstBook,
      bookName: info.book_name,
      vriCode: info.vri_id,
      from,
      to,
      paras,
      wordLinks,
    };
  }

  /** 자따까: 제목으로 찾은 복주석서 범위 — 문단마다 이 자따까의 첫 문단을 풀이하는 것으로 둔다 */
  function jatakaTika() {
    const num = suttaId.match(/^ja(\d+)$/)?.[1];
    const span = num ? jatakaTikaSpan(Number(num)) : null;
    if (!span) return null;
    const firstKey = Object.keys(segments).find((k) => !/:0\.\d+$/.test(k));
    const mark = firstKey ? paragraphOf(firstKey, suttaId) : null;
    const lines = linesOf(span.book, span.from, span.to).filter((l) => l.text);
    const paras = [...new Set(lines.map((l) => l.para))].map((para) => {
      const mine = lines.filter((l) => l.para === para);
      return {
        para,
        vripara: null,
        refs: mark ? [mark] : [],
        lines: mine.map((l) => l.text),
        lineRefs: mine.map(() => (mark ? [mark] : [])),
      };
    });
    const vol =
      ["i", "ii", "iii", "iv", "v"].indexOf(span.book.replace("Ja-ṭ-", "")) + 1;
    return {
      book: span.book,
      bookName: `Jātaka-abhinavaṭīkā-${vol}`,
      vriCode: "",
      from: span.from,
      to: span.to,
      paras,
      wordLinks: [] as [string, string, number, number][],
    };
  }

  const out = {
    suttaId,
    source: {
      db: "E-Piṭaka (dhammanana/epitaka_app)",
      book,
      vriCode: (
        db.prepare("select vri_id from books where book_id = ?").get(book) as {
          vri_id: string;
        }
      ).vri_id,
      paras: [first, last],
      vripara: vri.find((l) => l.vripara)?.vripara ?? null,
    },
    segments: { ...titled, ...segments },
    /** VRI 한 줄에 다음 문장까지 들어 있을 수 있는 문장 (두 판본 글이 달라 자를 자리가 확실하지 않음) */
    unsure: [...unsure],
    /** 책 첫머리 줄 (Namo tassa…) — 책의 첫 경에만 */
    preface,
    attha: commentaryFor(meta?.attha_ref),
    tika: commentaryFor(meta?.tika_ref) ?? jatakaTika(),
    // 복주석서가 두 종류인 책(디가니까야: 옛 복주석서 Sv-pt 와 새 복주석서 Abhinavaṭīkā Sv-nt)
    tika2: commentaryFor(
      (
        db
          .prepare(
            "select book_id from books where mula_ref = ? and category = 'Ṭīkā' and book_id != ?",
          )
          .all(
            book,
            (meta?.tika_ref ?? "").split(/\s+/)[0] ?? "",
          ) as unknown as { book_id: string }[]
      )
        .map((r) => r.book_id)
        .join(" "),
      3000,
    ),
  };
  writeFileSync(
    path.join(OUT, `${suttaId}.json`),
    quiet ? `${JSON.stringify(out)}\n` : `${JSON.stringify(out, null, 2)}\n`,
  );
  stats.done++;
  stats.unmatched += unmatched.length;
  stats.unsure.push(...unsure);
  stats.segs += ms.length;
  stats.gaps += ms.filter(([k]) => !segments[k]).length;
  stats.lines += vri.length;
  if (unmatched.length)
    stats.withUnmatched.push(`${suttaId}(${unmatched.length})`);
  if (!quiet)
    console.log(
      `${suttaId}: ${book} ${first}~${last} · VRI ${vri.length}줄 → 빌랄라 ${Object.keys(segments).length}문장 · ` +
        `주석서 ${out.attha?.paras.length ?? 0}문단 · 복주석서 ${out.tika?.paras.length ?? 0}문단` +
        (unmatched.length
          ? `\n  짝을 못 찾은 VRI 줄 ${unmatched.length}개:\n   - ${unmatched.join("\n   - ")}`
          : ""),
    );
}
// ── 주석 사이의 빈 곳: 어느 경에도 붙지 않은 주석 문단(책 머리말·품 머리말·이야기 등)을 바로 뒤 경의 "앞 부분"으로 ──
// Digital Pāḷi Reader 처럼 주석에서 앞으로 넘기면 보이게 한다 (--all 일 때만: 책 전체의 빈 곳을 알아야 한다)
if (quiet) {
  const files = readdirSync(OUT).filter(
    (f) => f.endsWith(".json") && !f.endsWith(".ko.json") && !f.startsWith("_"),
  );
  type Span = {
    file: string;
    layer: "attha" | "tika" | "tika2";
    min: number;
    max: number;
  };
  const byBook = new Map<string, Span[]>();
  const docs = new Map<string, Record<string, unknown>>();
  for (const file of files) {
    const d = JSON.parse(readFileSync(path.join(OUT, file), "utf8")) as Record<
      string,
      unknown
    >;
    docs.set(file, d);
    for (const layer of ["attha", "tika", "tika2"] as const) {
      const c = d[layer] as { book: string; paras: { para: number }[] } | null;
      if (!c?.paras.length) continue;
      const ps = c.paras.map((p) => p.para);
      const list = byBook.get(c.book) ?? [];
      list.push({ file, layer, min: Math.min(...ps), max: Math.max(...ps) });
      byBook.set(c.book, list);
    }
  }
  let filled = 0;
  let tailFilled = 0;
  const touched = new Set<string>();
  for (const [book, spans] of byBook) {
    spans.sort((a, b) => a.min - b.min);
    const firstPara = (
      db
        .prepare("select min(para_id) n from sentences where book_id = ?")
        .get(book) as { n: number }
    ).n;
    // 주석서 책의 목차 (Digital Pāḷi Reader 처럼 책의 제목 구조를 따른다)
    // 큰 제목 = 번호가 붙은 제목("1. Brahmajālasuttavaṇṇanā")이나 책 단계 제목("Ganthārambhakathā")
    const heads = (
      db
        .prepare(
          "select para_id, level, title from headings where book_id = ? and level < 10 order by para_id",
        )
        .all(book) as unknown as {
        para_id: number;
        level: number;
        title: string;
      }[]
    ).map((h) => ({
      ...h,
      major: /^\s*\(?\d/.test(String(h.title)) || h.level <= 3,
    }));
    const lastHead = (p: number, majorOnly: boolean) => {
      let found: (typeof heads)[number] | null = null;
      for (const h of heads) {
        if (h.para_id > p) break;
        if (!majorOnly || h.major) found = h;
      }
      return found;
    };
    const titleOf = (p: number) => {
      const h = lastHead(p, false);
      if (!h || /^\(?empty\)?$/i.test(String(h.title).trim())) return null;
      return (
        (book.startsWith("Ja-ṭ-") ? cleanJatakaTika : tidy)(
          String(h.title),
        ).replace(/^\(?[\d\-–]+[.)]?\s*/, "") || String(h.title)
      );
    };
    const parasOf = (from: number, to: number) => {
      const lines = linesOf(book, from, to).filter((l) => l.text);
      return [...new Set(lines.map((l) => l.para))].map((para) => ({
        para,
        vripara:
          lines.find((l) => l.para === para && l.vripara)?.vripara ?? null,
        title: titleOf(para),
        lines: lines.filter((l) => l.para === para).map((l) => l.text),
      }));
    };
    const addTo = (
      span: Span,
      key: "before" | "after",
      items: ReturnType<typeof parasOf>,
    ) => {
      if (!items.length) return;
      const layer = docs.get(span.file)![span.layer] as Record<string, unknown>;
      const list = [
        ...((layer[key] as typeof items | undefined) ?? []),
        ...items,
      ].sort((a, b) => a.para - b.para);
      layer[key] = list;
      touched.add(span.file);
      if (key === "before") filled += items.length;
      else tailFilled += items.length;
    };
    let covered = firstPara - 1;
    let prev: Span | null = null;
    for (const span of spans) {
      const from = covered + 1;
      const to = span.min - 1;
      if (to >= from && to - from < 2000) {
        // 경과 경 사이에 낀 주석: 앞 경 주석과 같은 큰 제목 안이면 앞 경의 "끝 부분", 새 큰 제목부터는 뒤 경의 "앞 부분"
        let split = from;
        if (prev) {
          const prevMajor = lastHead(covered, true);
          while (split <= to && lastHead(split, true) === prevMajor) split++;
          if (split > from) addTo(prev, "after", parasOf(from, split - 1));
        }
        if (split <= to) addTo(span, "before", parasOf(split, to));
      }
      if (span.max >= covered) {
        covered = span.max;
        prev = span;
      }
    }
    // 책 맨 끝의 남은 주석(맺음말·총론 등)은 마지막 경의 "끝 부분"으로
    const lastPara = (
      db
        .prepare("select max(para_id) n from sentences where book_id = ?")
        .get(book) as { n: number }
    ).n;
    if (prev && lastPara > covered && lastPara - covered < 2000)
      addTo(prev, "after", parasOf(covered + 1, lastPara));
  }
  for (const file of touched)
    writeFileSync(path.join(OUT, file), `${JSON.stringify(docs.get(file))}\n`);
  console.log(
    `주석 앞 부분(머리말 등): 문단 ${filled}개를 경 ${touched.size}개 앞에 붙였습니다 · 끝 부분(맺음말 등): 문단 ${tailFilled}개`,
  );
}

if (quiet) {
  console.log(
    `경 ${stats.done}개 · VRI ${stats.lines}줄 · 짝을 못 찾은 줄 ${stats.unmatched}개 (${stats.withUnmatched.length}개 경)\n` +
      `목차에 번호가 없어 글로 자리를 찾은 경 ${stats.located.length}개\n` +
      `E-Piṭaka 에서 못 찾은 경 ${stats.missing.length}개: ${stats.missing.join(" ")}\n` +
      `빌랄라 ${stats.segs}문장 중 VRI 글이 빈 문장 ${stats.gaps}개 · 자를 자리가 애매해 앞 문장에 합친 곳 ${stats.unsure.length}개`,
  );
  writeFileSync(path.join(OUT, "_unsure.txt"), `${stats.unsure.join("\n")}\n`);
  console.log(
    `VRI 공식 원문으로 바로잡기: 책 ${xmlStats.books}권 · 줄 ${xmlStats.lines.toLocaleString()}개 중 글이 달라진 줄 ${xmlStats.changed.toLocaleString()}개 · ` +
      `공식 원문에 없는 E-Piṭaka 줄 ${xmlStats.epitakaOnly}개` +
      (xmlStats.missingXml.length
        ? ` · 공식 원문 파일이 없는 책: ${xmlStats.missingXml.join(" ")}`
        : ""),
  );
  writeFileSync(
    path.join(OUT, "_import-report.txt"),
    `짝을 못 찾은 줄이 있는 경:\n${stats.withUnmatched.join("\n")}\n\nE-Piṭaka 에 없는 경:\n${stats.missing.join("\n")}\n`,
  );
}

/**
 * 법구경 주석서의 문단을 이야기 단위로 게송에 다시 단다.
 * 이야기는 맺음 줄("Revatattheravatthu ekūnatiṃsatimaṃ. 30.")로 끝난다. 이야기 안의 게송 문단(vripara)
 * 앞쪽은 그 첫 게송에, 게송 문단부터는 그 게송에 단다 (한 이야기에 게송이 여럿이면 게송마다 나뉜다).
 */
function fixDhammapadaStories(
  paras: {
    vripara: string | number | null;
    refs: string[];
    lines: string[];
    lineRefs: string[][];
  }[],
  suttaId: string,
) {
  const m = suttaId.match(/^dhp(\d+)-(\d+)$/);
  if (!m) return;
  const [lo, hi] = [Number(m[1]), Number(m[2])];
  const mark = (v: string | number | null) => {
    const n = Number(v);
    return v && n >= lo && n <= hi ? `dhp${n}` : null;
  };
  const isClosing = (line: string) =>
    /vatthu\s+\S+\.\s*\d+\.?\s*$/i.test(line.replace(/<[^>]+>/g, "").trim());
  let start = 0;
  const apply = (from: number, to: number) => {
    const story = paras.slice(from, to + 1);
    const verses = story.map((p) => mark(p.vripara));
    const first = verses.find(Boolean);
    if (!first) return;
    let current = first;
    story.forEach((p, i) => {
      current = verses[i] ?? current;
      p.refs = [current];
      p.lineRefs = p.lines.map(() => [current]);
    });
  };
  paras.forEach((p, i) => {
    if (p.lines.some(isClosing)) {
      apply(start, i);
      start = i + 1;
    }
  });
  if (start < paras.length) apply(start, paras.length - 1);
}
