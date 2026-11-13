/**
 * 낱말 나누기(Splitter) — 사전에 그대로 없는 낱말을 사전에 있는 낱말들로 나눈다.
 *   예: cakkaṃva → cakkaṃ + iva, evamāha → evaṃ + āha, tañca → taṃ + ca
 *
 *   pnpm build:splitter      (사전 조각 public/data/dict/lookup 과 content/vri 원문이 있어야 한다)
 *
 * - Digital Pāḷi Dictionary 의 Splitter(deconstructor)처럼, 사이트 원문(VRI 경·주석·복주석)에 나오는 낱말 가운데
 *   DPD 표제어 하나의 변화형이 아닌 낱말을 미리 나눠 둔다 (DPD 찾아보기 목록에 있어도, 연음으로 붙은 말이면 나눈다). 화면은 찾을 때 조각 하나만 받는다.
 * - 연음(sandhi) 규칙: 모음 생략(…ṃ + iva → …ṃva), ṃ → m(모음 앞)·n/ñ/ṇ/m(자음 앞), 끝 모음 생략,
 *   모음 합침(a + i → e, a + u → o, a + a → ā 등), iti 줄임(…ṃ + iti → …nti, …a + iti → …āti).
 * - 조각이 적을수록, 조각이 길수록 좋은 나눔으로 본다. 자동으로 나눈 것이라 틀릴 수 있다(화면에 알린다).
 * - 결과: public/data/dict/splitter/<n>.json  { 낱말: "앞 + 뒤" }  (호스팅 파일 수 한도 때문에 조각 128개)
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeWord } from "../src/lib/pali";

const DICT = path.join(process.cwd(), "public/data/dict");
const VRI = path.join(process.cwd(), "content/vri");
export const SPLITTER_SHARDS = 128;

/** 화면의 splitterShard 와 같은 계산 */
function shardNo(word: string): number {
  let h = 0;
  for (const ch of word) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % SPLITTER_SHARDS;
}

// ── 사전 표제어의 어형들 (낱말 하나의 변화형만 — DPD 찾아보기 목록에는 연음으로 붙은 말도 섞여 있어 쓰지 않는다) ──
const known = new Set<string>();
for (const f of readdirSync(path.join(DICT, "dpd-inflections"))) {
  const shard = JSON.parse(readFileSync(path.join(DICT, "dpd-inflections", f), "utf8")) as Record<string, string>;
  for (const list of Object.values(shard)) for (const w of list.split(",")) if (w) known.add(normalizeWord(w));
}
console.log(`DPD 표제어 어형 ${known.size.toLocaleString()}개`);

// ── 원문 낱말 모으기 ──
const words = new Map<string, number>();
const addText = (text: string) => {
  for (const raw of text.replace(/<[^>]+>/g, " ").replace(/\[[^\]]*\]/g, " ").split(/[^\p{L}\p{M}]+/u)) {
    const w = normalizeWord(raw);
    if (w.length >= 4) words.set(w, (words.get(w) ?? 0) + 1);
  }
};
for (const f of readdirSync(VRI).filter((f) => f.endsWith(".json") && !f.endsWith(".ko.json") && !f.startsWith("_"))) {
  const d = JSON.parse(readFileSync(path.join(VRI, f), "utf8")) as {
    segments: Record<string, string>;
    [layer: string]: unknown;
  };
  for (const t of Object.values(d.segments)) addText(t);
  for (const layer of ["attha", "tika", "tika2"]) {
    const c = d[layer] as { paras?: { lines: string[] }[]; before?: { lines: string[] }[]; after?: { lines: string[] }[] } | null;
    if (!c) continue;
    for (const p of [...(c.paras ?? []), ...(c.before ?? []), ...(c.after ?? [])]) for (const l of p.lines) addText(l);
  }
}
const unknown = [...words.keys()].filter((w) => !known.has(w));
console.log(`원문 낱말 ${words.size.toLocaleString()}개 중 사전에 그대로 없는 낱말 ${unknown.length.toLocaleString()}개`);

// ── 나누기 ──
const VOWELS = new Set([..."aāiīuūeo"]);
const isVowel = (c: string | undefined) => c !== undefined && VOWELS.has(c);
/** 홀로 쓰이는 짧은 낱말 (두 글자 조각은 이것만) */
// (va·pi·ti 는 iva·api·iti 가 줄어든 것이라 여기 두지 않는다 — 규칙 2 로 원래 모양을 보인다)
const SHORT = new Set(["ca", "hi", "na", "ce", "me", "te", "vo", "no", "so", "sā", "taṃ", "naṃ", "kho", "nu", "ha", "ve", "yaṃ", "kiṃ", "maṃ", "tvaṃ", "ahaṃ", "yo", "ko", "kā", "tā", "yā"]);
const CONSONANT_PAIR = /^([^aāiīuūeoṃ])\1/;
const ok = (part: string) =>
  known.has(part) && (part.length >= 3 || SHORT.has(part)) && !CONSONANT_PAIR.test(part);
/** 모음 합침: 겉에 보이는 글자 → [앞 낱말 끝, 뒤 낱말 첫머리] */
const CONTRACT: Record<string, [string, string][]> = {
  e: [["a", "i"], ["a", "ī"], ["ā", "i"]],
  o: [["a", "u"], ["a", "ū"], ["ā", "u"]],
  ā: [["ā", "a"], ["a", "a"], ["a", "ā"], ["ā", "ā"]],
  ī: [["i", "i"], ["a", "i"]],
  ū: [["u", "u"], ["a", "u"]],
};
/** 앞 낱말 뒤에서 첫 모음이 떨어져 나가는 낱말 (…ṃ + iva → …ṃva, kiṃ + api → kimpi, … + iti → …ti) */
const ELIDED = new Set(["iva", "api", "iti", "eva", "ivā"]);
/** 앞 낱말 끝 모음이 떨어져 나가게 하는 뒤 낱말의 첫머리 (tassa + eva → tasseva, ekassa + api → ekassāpi) */
const FOLLOWERS = ["eva", "evaṃ", "api", "iti", "iva", "idāni", "idha", "ettha", "ahaṃ", "āha", "ime", "imaṃ", "assa", "eka", "etaṃ", "etad", "ahu", "āsi"];
const NASAL = new Set([..."mnñṇṅ"]);


interface Best {
  parts: string[];
  score: number;
}
function split(word: string): string[] | null {
  const n = word.length;
  const memo = new Map<string, Best | null>();
  // state: 위치 pos 부터, 다음 조각 앞에 붙일 글자 pre (생략된 첫 모음 등)
  const go = (pos: number, pre: string, depth: number): Best | null => {
    if (pos === n) return pre ? null : { parts: [], score: 0 };
    if (depth >= 5) return null;
    const key = `${pos}|${pre}`;
    if (memo.has(key)) return memo.get(key)!;
    let best: Best | null = null;
    const consider = (part: string, nextPos: number, nextPre: string, penalty = 0) => {
      if (!ok(part)) return;
      // 떨어져 나간 첫 모음은 정해진 낱말(iva·api·iti·eva)에만
      if (pre.startsWith("~") && !ELIDED.has(part)) return;
      if (nextPos === n && nextPre) return;
      if (pos === 0 && !pre && nextPos === n) return; // 통째로 하나면 나눈 것이 아니다
      const rest = go(nextPos, nextPre, depth + 1);
      if (!rest) return;
      // 조각이 적을수록, 조각이 길수록 (길이 제곱의 합) 좋다
      // 짧은 조각(4글자 미만, 흔한 짧은 낱말 빼고)은 억지로 나눈 경우가 많아 덜 좋게 본다
      const shortPenalty = part.length < 4 && !SHORT.has(part) && !ELIDED.has(part) ? 400 : 0;
      const score = rest.score + 1000 - part.length * part.length + penalty + shortPenalty;
      if (!best || score < best.score) best = { parts: [part, ...rest.parts], score };
    };
    for (let end = pos + 1; end <= n; end++) {
      const core = pre.replace("~", "") + word.slice(pos, end);
      const next = word[end];
      // 1. 그대로
      consider(core, end, "");
      // 2. 다음 낱말(iva·api·iti·eva)의 첫 모음이 떨어져 나감 (cakkaṃ + (i)va, kiṃ + (a)pi)
      if (end < n && !isVowel(next) && (isVowel(core.at(-1)) || core.endsWith("ṃ"))) {
        for (const v of ["i", "a", "e"]) consider(core, end, `~${v}`, 20);
        // 긴 모음 + ti: vikappetabbā + (i)ti, karomī + (i)ti 처럼 앞 모음이 길어진다
        const short = { ā: "a", ī: "i", ū: "u" }[core.at(-1)!];
        if (short && next === "t") consider(core.slice(0, -1) + short, end, "~i", 20);
      }
      // 3. ṃ 가 뒤 글자에 따라 m (모음 앞) · n ñ ṇ ṅ m (자음 앞) 으로
      if (NASAL.has(core.at(-1)!) && end < n) {
        const base = `${core.slice(0, -1)}ṃ`;
        consider(base, end, "", 10);
        if (!isVowel(next)) for (const v of ["i", "a", "e"]) consider(base, end, `~${v}`, 20); // taṃ + (i)ti → tanti
      }
      // 4. 앞 낱말의 끝 모음이 떨어져 나감 — 뒤 낱말이 eva·api·iti 등일 때만 (tass(a) + eva → tasseva)
      if (end < n && isVowel(next) && !isVowel(core.at(-1)) && FOLLOWERS.some((f) => word.startsWith(f, end))) {
        for (const v of ["a", "ā", "i", "ī", "u", "ū", "e", "o"]) consider(core + v, end, "", 30);
      }
      // 5. 모음 합침: 겉 글자 하나가 앞 끝 + 뒤 첫머리 (a + i → e, a + u → ū)
      if (end < n && CONTRACT[next]) {
        for (const [a, b] of CONTRACT[next]) consider(core + a, end + 1, b, 30);
      }
    }
    memo.set(key, best);
    return best;
  };
  return go(0, "", 0)?.parts ?? null;
}

const out: Record<string, string>[] = Array.from({ length: SPLITTER_SHARDS }, () => ({}));
let done = 0;
const started = Date.now();
for (const w of unknown) {
  if (w.length > 40) continue;
  const parts = split(w);
  if (parts && parts.length >= 2) {
    out[shardNo(w)][w] = parts.join(" + ");
    done++;
  }
}
const dir = path.join(DICT, "splitter");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
out.forEach((s, i) => writeFileSync(path.join(dir, `${i}.json`), JSON.stringify(s)));
console.log(
  `나눈 낱말 ${done.toLocaleString()}개 / ${unknown.length.toLocaleString()}개 (${Math.round((Date.now() - started) / 1000)}초) → 조각 ${SPLITTER_SHARDS}개`,
);
for (const w of ["cakkaṃva", "evamāha", "tañca", "seyyathidaṃ", "bhagavantaṃyeva", "tenupasaṅkami", "dhammanti"]) {
  console.log(`  ${w}: ${known.has(w) ? "(사전에 있음)" : (split(w) ?? ["(못 나눔)"]).join(" + ")}`);
}
