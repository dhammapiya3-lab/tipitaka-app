/**
 * DPD 의 나머지 기능 자료 — 어근 가족(root family) · 낱말 가족(word family) · 합성어 가족(compound family) ·
 * 숙어(idioms) · 같은 묶음(sets) · 빈도(frequency).
 *
 *   DPD_REPO=경로/dpd-db pnpm build:dpd-extras
 *
 * - DPD 저장소(github.com/digitalpalidictionary/dpd-db)의 공개 백업에서 읽는다:
 *     db/backup_tsv/dpd_headwords_part_*.tsv — family_root·family_word·family_compound·family_idioms·family_set·freq_data
 *     db/backup_tsv/dpd_roots_part_*.tsv     — 어근 뜻
 *     archive/exporter/goldendict/javascript/frequency_template.js (git 에서) — 빈도표 모양
 * - 사전 조각(public/data/dict/dpd/*.json)의 낱말에 가족 열쇠(fam)를 붙이고,
 *   가족 목록은 public/data/dict/dpd-family/<종류>-<n>.json, 빈도는 public/data/dict/dpd-freq/<n>.json 에 나눠 쓴다
 *   (호스팅 파일 수 한도 2만 개 — 조각을 적게).
 * 출처: Digital Pāḷi Dictionary (CC BY-NC-SA 4.0)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const REPO = process.env.DPD_REPO ?? path.join(process.cwd(), "content", "dpd-db");
const DICT = path.join(process.cwd(), "public/data/dict");
/** 가족 종류마다 조각 수 */
const FAMILY_SHARDS = 8;
/** 빈도 조각 하나에 든 낱말 번호 범위 */
const FREQ_BLOCK = 1000;

/** TSV 한 줄씩 (따옴표로 감싼 칸 안의 탭·줄바꿈을 처리) */
function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === "\t") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

function readTable(prefix: string): Record<string, string>[] {
  const dir = path.join(REPO, "db/backup_tsv");
  const out: Record<string, string>[] = [];
  for (const file of readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".tsv")).sort()) {
    const [head, ...rows] = parseTsv(readFileSync(path.join(dir, file), "utf8"));
    for (const r of rows) {
      if (r.length < 2) continue;
      out.push(Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
    }
  }
  return out;
}

/** 가족 열쇠 → 조각 번호 (화면의 familyShard 와 같은 계산) */
function familyShard(key: string): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % FAMILY_SHARDS;
}

const headwords = readTable("dpd_headwords_part_");
const roots = new Map(readTable("dpd_roots_part_").map((r) => [r.root, r]));
console.log(`DPD 표제어 ${headwords.length.toLocaleString()}개 · 어근 ${roots.size}개`);

type Member = [number, string, string, string];
const member = (h: Record<string, string>): Member => [
  Number(h.id),
  h.lemma_1,
  h.pos,
  (h.meaning_1 || h.meaning_2).replace(/<[^>]+>/g, "").slice(0, 160),
];
const split = (s: string, sep: RegExp) =>
  s
    .split(sep)
    .map((x) => x.trim())
    .filter(Boolean);

/** 종류 → 열쇠 → 낱말들 */
const families: Record<"root" | "word" | "compound" | "idiom" | "set", Map<string, Member[]>> = {
  root: new Map(),
  word: new Map(),
  compound: new Map(),
  idiom: new Map(),
  set: new Map(),
};
/** 낱말 번호 → 그 낱말이 든 가족 열쇠 */
const fams = new Map<number, { root?: string; word?: string; compound?: string[]; idiom?: string[]; set?: string[] }>();
const push = (kind: keyof typeof families, key: string, m: Member) => {
  const list = families[kind].get(key) ?? [];
  list.push(m);
  families[kind].set(key, list);
};
for (const h of headwords) {
  const id = Number(h.id);
  if (!id) continue;
  const m = member(h);
  const f: NonNullable<ReturnType<typeof fams.get>> = {};
  if (h.root_key && h.family_root) {
    f.root = `${h.root_key}|${h.family_root}`;
    push("root", f.root, m);
  }
  if (h.family_word) {
    f.word = h.family_word;
    push("word", f.word, m);
  }
  // 합성어·숙어: 이 낱말이 든 가족들 (빈칸으로 나뉜 낱말들)
  const compound = split(h.family_compound, /\s+/);
  const idiom = split(h.family_idioms, /\s+/);
  const sets = split(h.family_set, /;\s*/);
  for (const k of compound) push("compound", k, m);
  for (const k of idiom) push("idiom", k, m);
  for (const k of sets) push("set", k, m);
  if (compound.length) f.compound = compound;
  if (idiom.length) f.idiom = idiom;
  if (sets.length) f.set = sets;
  if (Object.keys(f).length) fams.set(id, f);
}

// 가족 목록 쓰기 — 어근 가족 머리에는 어근 뜻
const famDir = path.join(DICT, "dpd-family");
rmSync(famDir, { recursive: true, force: true });
mkdirSync(famDir, { recursive: true });
const sortPali = (a: Member, b: Member) => a[1].localeCompare(b[1], "en");
for (const [kind, map] of Object.entries(families)) {
  const shards: Record<string, { head?: string; words: Member[] }>[] = Array.from({ length: FAMILY_SHARDS }, () => ({}));
  for (const [key, words] of map) {
    let head: string | undefined;
    if (kind === "root") {
      const rootKey = key.split("|")[0];
      const r = roots.get(rootKey);
      if (r) head = `${r.root_group ? `${r.root_group} ` : ""}${r.root_sign ? `${r.root_sign} ` : ""}(${r.root_meaning})`;
    }
    shards[familyShard(key)][key] = { ...(head ? { head } : {}), words: [...words].sort(sortPali) };
  }
  shards.forEach((s, i) => writeFileSync(path.join(famDir, `${kind}-${i}.json`), JSON.stringify(s)));
  console.log(`  ${kind} 가족 ${map.size.toLocaleString()}개`);
}

// 빈도 — 표 칸의 숫자만 (색 단계는 화면에서)
const freqDir = path.join(DICT, "dpd-freq");
rmSync(freqDir, { recursive: true, force: true });
mkdirSync(freqDir, { recursive: true });
const freqBlocks = new Map<number, Record<string, unknown>>();
let freqCount = 0;
for (const h of headwords) {
  if (!h.freq_data) continue;
  try {
    const d = JSON.parse(h.freq_data) as Record<string, unknown>;
    if (!Array.isArray(d.CstFreq) || d.CstFreq.length === 0) continue;
    const id = Number(h.id);
    const block = Math.floor(id / FREQ_BLOCK);
    const b = freqBlocks.get(block) ?? {};
    b[id] = { c: d.CstFreq, b: d.BjtFreq, s: d.SyaFreq, m: d.ScFreq, h: String(d.FreqHeading ?? "") };
    freqBlocks.set(block, b);
    freqCount++;
  } catch {
    // 빈도 자료가 없거나 깨진 낱말은 건너뛴다
  }
}
for (const [block, data] of freqBlocks) writeFileSync(path.join(freqDir, `${block}.json`), JSON.stringify(data));
console.log(`  빈도 ${freqCount.toLocaleString()}개 → 조각 ${freqBlocks.size}개`);

// 빈도표 모양 — DPD 의 GoldenDict 틀(frequency_template.js)에서 줄·칸을 읽어 둔다
const template = (() => {
  try {
    return readFileSync(path.join(REPO, "archive/exporter/goldendict/javascript/frequency_template.js"), "utf8");
  } catch {
    return execFileSync("git", ["-C", REPO, "show", "HEAD:archive/exporter/goldendict/javascript/frequency_template.js"], {
      encoding: "utf8",
    });
  }
})();
const body = template.slice(template.indexOf("<tbody>"), template.indexOf("</tbody>"));
const layout: {
  group?: string;
  groupSpan?: number;
  label?: string;
  cells: ({ src: string; i: number; rs: number } | { gap: true } | { void: true })[];
}[] = [];
for (const tr of body.split("<tr").slice(1)) {
  const group = tr.match(/class="vertical-text" rowspan="(\d+)">([^<]+)</);
  if (group) {
    layout.push({ group: group[2].trim(), groupSpan: Number(group[1]), cells: [] });
    continue;
  }
  const label = tr.match(/<th>([^<]+)<\/th>/)?.[1].trim();
  const cells: (typeof layout)[number]["cells"] = [];
  for (const td of tr.matchAll(/<td class="(gap|void|gr\$\{data\.(\w+)Grad\[(\d+)\]\})"(?:\s+rowspan="(\d+)")?>/g)) {
    if (td[1] === "gap") cells.push({ gap: true });
    else if (td[1] === "void") cells.push({ void: true });
    else cells.push({ src: { Cst: "c", Bjt: "b", Sya: "s", Sc: "m" }[td[2]] ?? td[2], i: Number(td[3]), rs: Number(td[4] ?? 1) });
  }
  layout.push({ label, cells });
}
writeFileSync(path.join(DICT, "dpd-freq-layout.json"), JSON.stringify(layout));
console.log(`  빈도표 모양 ${layout.length}줄`);

// 사전 조각의 낱말에 가족 열쇠를 붙인다
let patched = 0;
for (const file of readdirSync(path.join(DICT, "dpd")).filter((f) => f.endsWith(".json"))) {
  const p = path.join(DICT, "dpd", file);
  const shard = JSON.parse(readFileSync(p, "utf8")) as Record<string, Record<string, unknown>>;
  for (const [id, entry] of Object.entries(shard)) {
    const f = fams.get(Number(id));
    if (f) {
      entry.fam = f;
      patched++;
    } else delete entry.fam;
  }
  writeFileSync(p, JSON.stringify(shard));
}
console.log(`  가족 열쇠를 붙인 낱말 ${patched.toLocaleString()}개`);
