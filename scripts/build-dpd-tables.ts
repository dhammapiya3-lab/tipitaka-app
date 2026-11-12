/**
 * DPD 어형 변화표(declension·conjugation) 자료를 만든다.
 *
 *   DPD_REPO=경로/dpd-db pnpm build:dpd-tables
 *
 * - DPD 저장소(github.com/digitalpalidictionary/dpd-db)의 공개 백업에서 읽는다:
 *     db/backup_tsv/dpd_headwords_part_*.tsv  — 낱말마다 어간(stem)·변화 유형(pattern)
 *     db/inflections/templates/*.tsv          — 변화 유형별 표 (어미)
 *     db/inflections/templates_index.tsv      — 변화 유형의 본보기 낱말 (like)
 * - 이미 만들어 둔 사전 조각(public/data/dict/dpd/*.json)의 낱말에 stem·pattern 을 붙이고,
 *   표 틀은 public/data/dict/dpd-templates.json 하나로 쓴다. 화면이 어간 + 어미로 표를 그린다(DPD 와 같은 방식).
 * 출처: Digital Pāḷi Dictionary (CC BY-NC-SA 4.0)
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const REPO = process.env.DPD_REPO ?? path.join(process.cwd(), "content", "dpd-db");
const DICT = path.join(process.cwd(), "public/data/dict");

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

// ── 낱말마다 어간·변화 유형 ──
const backup = path.join(REPO, "db/backup_tsv");
const stems = new Map<number, { stem: string; pattern: string }>();
for (const file of readdirSync(backup).filter((f) => /^dpd_headwords_part_\d+\.tsv$/.test(f)).sort()) {
  const [head, ...rows] = parseTsv(readFileSync(path.join(backup, file), "utf8"));
  const col = (name: string) => head.indexOf(name);
  const [ci, cs, cp] = [col("id"), col("stem"), col("pattern")];
  for (const r of rows) {
    const id = Number(r[ci]);
    const stem = r[cs] ?? "";
    const pattern = r[cp] ?? "";
    if (!id || !pattern || stem === "-") continue;
    stems.set(id, { stem: stem.replace(/[!*]/g, ""), pattern });
  }
}

// ── 변화 유형별 표 틀: [줄][칸][어미들]. 0번 줄은 머리, 0번 칸은 줄 이름, 홀수 칸이 어미, 짝수 칸은 문법 이름 ──
const templatesDir = path.join(REPO, "db/inflections/templates");
const like = new Map(
  parseTsv(readFileSync(path.join(REPO, "db/inflections/templates_index.tsv"), "utf8"))
    .slice(1)
    .map((r) => [r[0], r[1] ?? ""] as const),
);
const templates: Record<string, { like: string; rows: string[][][] }> = {};
for (const file of readdirSync(templatesDir).filter((f) => f.endsWith(".tsv"))) {
  const rows = parseTsv(readFileSync(path.join(templatesDir, file), "utf8"))
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => r.map((c) => (c.trim() ? c.split(",").map((x) => x.trim()) : [])));
  const pattern = rows[0]?.[0]?.join(", ") ?? file.replace(/\.tsv$/, "");
  templates[pattern] = { like: like.get(pattern) ?? "", rows };
}
writeFileSync(path.join(DICT, "dpd-templates.json"), JSON.stringify(templates));

// ── 사전 조각의 낱말에 stem·pattern 붙이기 ──
let patched = 0;
let missing = 0;
const dpdDir = path.join(DICT, "dpd");
for (const file of readdirSync(dpdDir).filter((f) => f.endsWith(".json"))) {
  const shard = JSON.parse(readFileSync(path.join(dpdDir, file), "utf8")) as Record<
    string,
    { id: number; stem?: string; pattern?: string }
  >;
  for (const entry of Object.values(shard)) {
    const s = stems.get(entry.id);
    if (s && templates[s.pattern]) {
      entry.stem = s.stem;
      entry.pattern = s.pattern;
      patched++;
    } else if (s) missing++;
  }
  writeFileSync(path.join(dpdDir, file), JSON.stringify(shard));
}
console.log(
  `변화표 틀 ${Object.keys(templates).length}개 · 낱말 ${patched}개에 어간·유형을 붙였습니다` +
    (missing ? ` (틀이 없는 유형 ${missing}개)` : ""),
);
