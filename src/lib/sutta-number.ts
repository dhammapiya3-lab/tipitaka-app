/**
 * 경 번호·제목으로 찾기.
 * 경 번호: "DN 22", "sn56.11", "상윳따 56.11", "법구경 183", "MN10" 같은 말을 경 번호로 읽는다.
 * 여러 경을 묶은 번호(dhp1-20, an1.1-10, sn45.97-138)는 그 안의 번호로도 찾는다.
 * 앞 번호만 주면(sn56, 상윳따 56) 그 묶음의 경을 모두 돌려준다.
 */

/** 책 이름 → 경 번호 머리. 로마자는 소문자, 띄어쓰기·점·하이픈은 뺀 꼴로 적는다. */
const BOOK_NAMES: [string, string[]][] = [
  [
    "dn",
    [
      "dn",
      "d",
      "디가",
      "디가니까야",
      "장부",
      "장부경전",
      "dighanikaya",
      "digha",
    ],
  ],
  [
    "mn",
    [
      "mn",
      "m",
      "맛지마",
      "맛지마니까야",
      "중부",
      "중부경전",
      "majjhimanikaya",
      "majjhima",
    ],
  ],
  [
    "sn",
    [
      "sn",
      "s",
      "상윳따",
      "상윳따니까야",
      "상응부",
      "상응부경전",
      "samyuttanikaya",
      "samyutta",
    ],
  ],
  [
    "an",
    [
      "an",
      "a",
      "앙굿따라",
      "앙굿따라니까야",
      "증지부",
      "증지부경전",
      "anguttaranikaya",
      "anguttara",
    ],
  ],
  ["kp", ["kp", "khp", "쿳다까빠타", "소송경", "khuddakapatha"]],
  ["dhp", ["dhp", "dh", "법구경", "담마빠다", "dhammapada"]],
  ["ud", ["ud", "우다나", "감흥어", "자설경", "udana"]],
  ["iti", ["iti", "it", "이띠웃따까", "여시어경", "여시어", "itivuttaka"]],
  ["snp", ["snp", "stn", "숫따니빠따", "경집", "suttanipata"]],
  ["vv", ["vv", "위마나왓투", "천궁사", "vimanavatthu"]],
  ["pv", ["pv", "뻬따왓투", "아귀사", "petavatthu"]],
  ["thag", ["thag", "테라가타", "장로게", "장로게경", "theragatha"]],
  ["thig", ["thig", "테리가타", "장로니게", "장로니게경", "therigatha"]],
  [
    "tha-ap",
    ["thaap", "ap", "테라아빠다나", "아빠다나", "theraapadana", "apadana"],
  ],
  ["thi-ap", ["thiap", "테리아빠다나", "theriapadana"]],
  ["bv", ["bv", "붓다왕사", "불종성경", "불종성", "buddhavamsa"]],
  ["cp", ["cp", "짜리야삐따까", "소행장", "cariyapitaka"]],
  ["ja", ["ja", "j", "자따까", "본생경", "본생담", "jataka"]],
  ["mnd", ["mnd", "마하닛데사", "대의석", "mahaniddesa"]],
  ["cnd", ["cnd", "쭐라닛데사", "소의석", "cullaniddesa", "culaniddesa"]],
  ["ps", ["ps", "patis", "빠띠삼비다막가", "무애해도", "patisambhidamagga"]],
  ["ne", ["ne", "netti", "넷띠", "넷띠빠까라나", "nettippakarana"]],
  ["pe", ["pe", "pet", "뻬따꼬빠데사", "petakopadesa"]],
  [
    "mil",
    [
      "mil",
      "밀린다빤하",
      "밀린다왕문경",
      "밀린다왕문",
      "밀린다",
      "milindapanha",
      "milinda",
    ],
  ],
];
/**
 * 이름 맞추기용으로 접는다 — 표기가 갈리는 곳을 하나로:
 *  · 한글: 된소리·거센소리(빠/파, 따/타, 까/카, 짜/차), 받침 ㄴ·ㅇ·ㅁ(빤하/팡하/판하), 띄어쓰기·괄호·한자는 뺀다
 *  · 로마자: 작은 글자로, ā·ṭ·ṃ 같은 부호는 뺀다
 */
export function foldName(text: string): string {
  const INITIAL: Record<number, number> = { 1: 15, 4: 16, 8: 17, 13: 14 }; // ㄲ→ㅋ ㄸ→ㅌ ㅃ→ㅍ ㅉ→ㅊ
  const FINAL: Record<number, number> = { 16: 4, 21: 4 }; // ㅁ→ㄴ ㅇ→ㄴ
  let out = "";
  for (const ch of text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC")) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const n = code - 0xac00;
      let initial = Math.floor(n / 588);
      const medial = Math.floor((n % 588) / 28);
      let final = n % 28;
      initial = INITIAL[initial] ?? initial;
      final = FINAL[final] ?? final;
      out += String.fromCharCode(0xac00 + initial * 588 + medial * 28 + final);
    } else if (/[a-z0-9]/.test(ch)) out += ch;
  }
  return out;
}

const BOOK_OF = new Map<string, string>();
for (const [book, names] of BOOK_NAMES)
  for (const n of names) BOOK_OF.set(foldName(n), book);

/** 찾을 말 → [책 머리, 번호들] (경 번호가 아니면 null) */
export function parseSuttaNumber(
  query: string,
): { book: string; numbers: number[] } | null {
  const q = query
    .trim()
    .toLowerCase()
    .replace(/:.*$/, "") // sn56.11:2.1 → 문장 번호는 뺀다
    .replace(/[　\s]+/g, " ");
  const m = q.match(/^([a-z가-힣ṭ\-. ]*?)\s*(\d+(?:\s*[.,\s]\s*\d+)*)$/);
  if (!m) return null;
  const name = foldName(m[1]);
  const book = BOOK_OF.get(name);
  if (!book) return null;
  const numbers = m[2].split(/\s*[.,\s]\s*/).map(Number);
  return { book, numbers };
}

/** 경 번호 "sn45.97-138" → { book, head: [45], lo: 97, hi: 138 } */
function splitId(id: string) {
  const m = id.match(/^([a-z]+(?:-ap)?)(\d+(?:\.\d+)*)(?:-(\d+))?$/);
  if (!m) return null;
  const nums = m[2].split(".").map(Number);
  const lo = nums[nums.length - 1];
  return {
    book: m[1],
    head: nums.slice(0, -1),
    lo,
    hi: m[3] ? Number(m[3]) : lo,
  };
}

/**
 * 경 번호로 찾은 경들 (목록 순서). 경 번호가 아니면 빈 목록.
 * 번호를 끝까지 주면 그 경 하나, 앞 번호만 주면 그 아래 경들.
 */
export function findSuttasByNumber<T extends { id: string }>(
  query: string,
  suttas: T[],
): T[] {
  const parsed = parseSuttaNumber(query);
  if (!parsed) return [];
  const { book, numbers } = parsed;
  const exact: T[] = [];
  const under: T[] = [];
  for (const s of suttas) {
    const p = splitId(s.id);
    if (!p || p.book !== book) continue;
    const full = [...p.head, p.lo];
    if (numbers.length === full.length) {
      const sameHead = p.head.every((n, i) => n === numbers[i]);
      const last = numbers[numbers.length - 1];
      if (sameHead && last >= p.lo && last <= p.hi) exact.push(s);
    } else if (numbers.length < full.length) {
      if (numbers.every((n, i) => n === full[i])) under.push(s);
    }
  }
  return exact.length ? exact : under;
}

/** 책 이름만 넣었을 때 (예: "법구경", "담마파다", "밀린다왕문경") 그 책 */
export function bookOfName(query: string): string | null {
  const f = foldName(query);
  return f ? (BOOK_OF.get(f) ?? null) : null;
}

export interface FindableSutta {
  id: string;
  /** 목록의 한국어 이름 또는 빠알리 이름 */
  title: string;
  /** 빠알리 이름 */
  name?: string;
}

/**
 * 경 번호·책 이름·경 제목으로 찾은 경들.
 * 1) 경 번호(DN 22, 상윳따 56.11) 2) 책 이름만(법구경, 숫따니빠따) — 그 책의 경 모두
 * 3) 경 제목(대념처경, 염처경, Satipaṭṭhāna) — 목록 이름·빠알리 이름·한국어 번역들의 제목에서. 같은 제목이 먼저.
 */
export function findSuttas<T extends FindableSutta>(
  query: string,
  suttas: T[],
  koTitles: Record<string, string[]> = {},
): { by: "number" | "book" | "title"; items: T[] } | null {
  const byNumber = findSuttasByNumber(query, suttas);
  if (byNumber.length) return { by: "number", items: byNumber };
  const book = bookOfName(query);
  if (book) {
    const items = suttas.filter((s) => splitId(s.id)?.book === book);
    if (items.length) return { by: "book", items };
  }
  const f = foldName(query);
  const hangul = /[가-힣]/.test(f);
  if (f.length < (hangul ? 2 : 4)) return null;
  const exact: T[] = [];
  const partial: T[] = [];
  for (const s of suttas) {
    const names = [s.title, s.name ?? "", ...(koTitles[s.id] ?? [])]
      .map((t) => foldName(t.replace(/\(.*?\)/g, "")))
      .filter(Boolean);
    if (names.some((n) => n === f)) exact.push(s);
    else if (names.some((n) => n.includes(f))) partial.push(s);
  }
  const items = [...exact, ...partial];
  return items.length ? { by: "title", items } : null;
}
