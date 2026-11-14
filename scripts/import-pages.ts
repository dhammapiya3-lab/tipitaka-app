/**
 * 책 쪽 번호(PTS · 미얀마 · 태국 · VRI 인쇄본)를 VRI 공식 원문(XML)에서 꺼내 경 문장 번호에 붙인다.
 *
 *   VRI_XML=경로/tipitaka-xml/romn pnpm import:pages
 *
 * - 원문: github.com/VipassanaTech/tipitaka-xml 의 romn/*.mul.xml — 글 사이에 <pb ed="P" n="5.0421"/> 처럼 쪽이 바뀌는 곳이 있다.
 *   ed: P = PTS, M = 미얀마 6차 결집 인쇄본, T = 태국본, V = VRI 인쇄본. n = 권.쪽
 * - content/vri/<경>.json 의 VRI 본문과 XML 글을 글자 단위로 맞춰, 쪽이 바뀌는 곳이 어느 문장(빌랄라 번호)인지 찾는다.
 * - 주석서·복주석서(content/vri/<경>.json 의 attha·tika)도 같은 방법으로 줄마다 — 키 "c:<책>:<문단>:<줄 차례>"
 * - 청정도론(vism)은 e0101n·e0102n.mul.xml 을 같은 폴더에 두고 함께 가져온다.
 * - 경(주석) 안에서 쪽이 바뀌지 않아도 시작하는 쪽을 첫 줄에 붙인다.
 * - 결과: content/vri-pages.json  { 경: [[문장 번호, ed, 권.쪽], …] }
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const XML_DIR =
  process.env.VRI_XML ??
  path.join(process.cwd(), "content", "tipitaka-xml", "romn");
const VRI_DIR = path.join(process.cwd(), "content", "vri");

/** import-vri.ts 의 맞춰 보기용 글자와 같은 규칙 */
function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, "")
    .replace(/ṁ/g, "ṃ")
    .replace(/…\s*pe\s*…|\.\.\.pe\.\.\./g, "")
    .replace(/[^a-zāīūṃṅñṭḍṇḷ]/g, "");
}

interface Book {
  text: string;
  pages: { at: number; ed: string; n: string }[];
}
const books = new Map<string, Book>();
function bookOf(code: string): Book | null {
  if (books.has(code)) return books.get(code)!;
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
  // 이본 주석(<note>)은 본문이 아니다
  raw = raw.replace(/<note>[\s\S]*?<\/note>/g, "");
  let text = "";
  const pages: Book["pages"] = [];
  for (const piece of raw.split(/(<pb ed="[A-Z]" n="[^"]*"\s*\/>)/)) {
    const pb = piece.match(/^<pb ed="([A-Z])" n="([^"]*)"/);
    if (pb) pages.push({ at: text.length, ed: pb[1], n: pb[2] });
    else text += norm(piece.replace(/<[^>]+>/g, " "));
  }
  const book = { text, pages };
  books.set(code, book);
  return book;
}

type Layer = {
  book: string;
  vriCode: string;
  from: number;
  paras: { para: number; lines: string[] }[];
  before?: { para: number; lines: string[] }[];
  after?: { para: number; lines: string[] }[];
} | null;
type Doc = {
  suttaId: string;
  source: { vriCode: string; paras?: [number, number] };
  segments: Record<string, string>;
  attha?: Layer;
  tika?: Layer;
  tika2?: Layer;
};
const files = readdirSync(VRI_DIR).filter(
  (f) => f.endsWith(".json") && !f.endsWith(".ko.json") && !f.startsWith("_"),
);
const docs = files.map(
  (f) => JSON.parse(readFileSync(path.join(VRI_DIR, f), "utf8")) as Doc,
);

/**
 * 맞출 글 덩어리 하나 — 경 본문(문장 번호마다) 또는 주석서·복주석서 한 권의 이 경 부분(줄마다).
 * 키: 경 본문은 문장 번호, 주석은 "c:<책>:<E-Piṭaka 문단>:<줄 차례>" (화면의 주석 줄과 같은 차례).
 */
interface Unit {
  suttaId: string;
  code: string;
  order: number;
  keys: string[];
  texts: string[];
}
const units: Unit[] = [];
for (const d of docs) {
  const keys = Object.keys(d.segments).filter((k) => !/:0\.\d+$/.test(k));
  units.push({
    suttaId: d.suttaId,
    code: d.source.vriCode,
    order: d.source.paras?.[0] ?? 0,
    keys,
    texts: keys.map((k) => d.segments[k]),
  });
  for (const layer of [d.attha, d.tika, d.tika2]) {
    if (!layer?.vriCode) continue;
    const all = [
      ...(layer.before ?? []),
      ...layer.paras,
      ...(layer.after ?? []),
    ].sort((a, b) => a.para - b.para);
    const keysC: string[] = [];
    const textsC: string[] = [];
    for (const p of all)
      p.lines.forEach((line, i) => {
        keysC.push(`c:${layer.book}:${p.para}:${i}`);
        textsC.push(line);
      });
    units.push({
      suttaId: d.suttaId,
      code: layer.vriCode,
      order: all[0]?.para ?? layer.from,
      keys: keysC,
      texts: textsC,
    });
  }
}
units.sort((a, b) => a.code.localeCompare(b.code) || a.order - b.order);

const out: Record<string, [string, string, string][]> = {};
const cursor = new Map<string, number>();
let found = 0;
let missed = 0;
for (const u of units) {
  const book = bookOf(u.code);
  if (!book) continue;
  const { keys } = u;
  const parts = u.texts.map((x) => norm(x.replace(/<[^>]+>/g, " ")));
  const S = parts.join("");
  if (S.length < 20) continue;
  const starts: number[] = [];
  parts.reduce((acc, t) => (starts.push(acc), acc + t.length), 0);
  // 이 경이 책의 어디서 시작하나 — 앞 경이 끝난 곳부터 찾는다 (같은 글이 되풀이되는 경이 많아서)
  const from = cursor.get(u.code) ?? 0;
  let k = book.text.indexOf(S.slice(0, 60), from);
  if (k < 0) k = book.text.indexOf(S.slice(0, 30), from);
  // 앞 경이 엉뚱한 곳(되풀이되는 글)까지 가 버렸으면 책 처음부터 다시 찾는다
  if (k < 0) k = book.text.indexOf(S.slice(0, 60));
  if (k < 0) k = book.text.indexOf(S.slice(0, 30));
  if (k < 0) {
    missed++;
    continue;
  }
  // 글자 맞추기: B 의 글자 → S 의 글자
  const B = book.text;
  const toS = new Map<number, number>();
  let i = 0;
  let j = k;
  const end = Math.min(B.length, k + Math.round(S.length * 1.5) + 4000);
  while (i < S.length && j < end) {
    if (S[i] === B[j]) {
      toS.set(j, i);
      i++;
      j++;
      continue;
    }
    const w = S.slice(i, i + 16);
    const f = B.indexOf(w, j);
    if (f >= 0 && f - j < 3000) {
      j = f;
      continue;
    }
    const g = S.indexOf(B.slice(j, j + 16), i);
    if (g >= 0 && g - i < 3000) {
      i = g;
      continue;
    }
    j++;
  }
  if (j > from) cursor.set(u.code, j);
  const segAt = (offset: number) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return keys[lo];
  };
  const list: [string, string, string][] = [];
  // 글이 시작하는 쪽 — 경(주석) 안에서 쪽이 바뀌지 않아도 어느 쪽에 있는지 알 수 있게, 시작 바로 앞의 쪽 표시를 첫 줄에
  const startPage = new Map<string, string>();
  for (const p of book.pages) if (p.at <= k) startPage.set(p.ed, p.n);
  for (const [ed, n] of startPage)
    if (!book.pages.some((p) => p.ed === ed && p.at > k && p.at <= k + 3))
      list.push([keys[0], ed, n]);
  for (const p of book.pages) {
    if (p.at < k || p.at > j) continue;
    // 쪽이 바뀐 바로 뒤 글자가 맞춰진 곳을 찾는다
    let x = p.at;
    while (x < j && !toS.has(x)) x++;
    const s = toS.get(x);
    if (s === undefined) continue;
    list.push([segAt(s), p.ed, p.n]);
  }
  // 첫 줄 안에서 쪽이 바로 바뀌면(제목 줄 뒤 등) 시작 쪽은 빼고 바뀐 쪽만 둔다
  for (const [ed] of startPage) {
    const same = list.filter((x) => x[0] === keys[0] && x[1] === ed);
    if (same.length > 1) list.splice(list.indexOf(same[0]), 1);
  }
  if (list.length) {
    out[u.suttaId] = [...(out[u.suttaId] ?? []), ...list];
    found += list.length;
  }
}
writeFileSync(
  path.join(process.cwd(), "content", "vri-pages.json"),
  `${JSON.stringify(out)}\n`,
);
console.log(
  `쪽 번호 ${found}개 · 경 ${Object.keys(out).length}개 (XML 에서 자리를 못 찾은 글 덩어리 ${missed}개)`,
);
