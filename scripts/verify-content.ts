/**
 * 검수 — 사이트에 올라가는 자료(public/data/suttas)가 원본(content/theravada-app)과 글자가 같은지 확인한다.
 * build-content.ts 와 따로 짠 프로그램이라, 변환 프로그램에 실수가 있어도 여기서 드러난다.
 *
 * 비교하는 것
 *   본문(원문·번역): 문장 번호마다 원본 글자에서 서식 표시(<b> <em> <i>, 각주 번호 **42)**)만 뺀 것
 *                    = 사이트 자료의 글자 조각을 이은 것. 앞뒤 공백·보이지 않는 제어 문자만 무시한다.
 *   각주: 각주 번호마다 글자가 같은지
 *   대역·문법분석: 문장 번호마다 글자가 그대로인지
 * 원본에 있는데 사이트에 없는 문장·파일, 사이트에만 있는 문장도 모두 적는다.
 *
 * 사용법: pnpm tsx scripts/verify-content.ts        (먼저 pnpm build:content)
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { unseal } from "../src/lib/seal";
import { SOURCE_ROOT } from "./paths";

const OUT = path.join(process.cwd(), "public", "data", "suttas");
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
const MARKUP = /<b>|<\/b>|<\x08>|<em>|<\/em>|<i>|<\/i>|\*\*\d+(?:-\d+)?\)\*\*/g;

type Part = { type: string; text?: string; mark?: string };
type Segment = { key: string; parts: Part[] };

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const clean = (s: string) => s.replace(MARKUP, "").replace(CONTROL, "").trim();
const joinParts = (parts: Part[]) => parts.map((p) => (p.type === "note" ? "" : (p.text ?? ""))).join("").trim();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** 사이트 본문 파일. 복사를 막아 둔 번역은 감싼 것을 풀어서 본다. */
function readOutText(file: string): Segment[] {
  const data = readJson(file) as { suttaId: string; editionId: string; segments?: Segment[]; sealed?: string };
  if (data.sealed) return unseal(data.sealed, data.suttaId, data.editionId) as Segment[];
  return data.segments ?? [];
}

const report = {
  files: 0,
  sentences: 0,
  same: 0,
  changed: [] as string[],
  missingFiles: [] as string[],
  missingSentences: [] as string[],
  extraSentences: [] as string[],
  emptySkipped: 0,
  misplaced: [] as string[],
};

const NAME = /^(.+?)_(root|translation|comment)-(.+)\.json$/;

for (const file of walk(SOURCE_ROOT)) {
  const rel = path.relative(SOURCE_ROOT, file).split(path.sep).join("/");
  if (!rel.startsWith("sutta_pitaka")) continue;
  const m = path.basename(file).match(NAME);
  if (!m) continue;
  const [, suttaId, kindRaw, rest] = m;
  let kind: "text" | "notes" | "nissaya" | "grammar" = kindRaw === "comment" ? "notes" : "text";
  let edition = rest;
  if (rest.startsWith("nissaya-")) [kind, edition] = ["nissaya", rest.slice("nissaya-".length)];
  if (rest.startsWith("paligrammar-")) [kind, edition] = ["grammar", rest.slice("paligrammar-".length)];

  // 파일 이름의 판본이 들어 있는 폴더와 맞지 않으면(예: 한국어 폴더 안의 "…-pli-ms.json") 앱이 읽지 않는 파일이다
  const folder = path.basename(path.dirname(file)).replace(/_comment$/, "");
  const parent = path.basename(path.dirname(path.dirname(file)));
  const editionFolder = (/^(an|sn)\d/.test(folder) || folder.startsWith("vagga") ? parent : folder).replace(/_comment$/, "");
  if (!editionFolder.endsWith(edition.replace(/-/g, "_"))) {
    report.misplaced.push(`${rel} (폴더 ${editionFolder} 와 판본 ${edition} 이 맞지 않음)`);
    continue;
  }

  let source: Record<string, string>;
  try {
    source = readJson(file) as Record<string, string>;
  } catch {
    report.missingFiles.push(`${rel} (원본 파일 형식이 깨짐 — 변환에서 빠짐)`);
    continue;
  }
  const suffix = { text: ".json", notes: ".notes.json", nissaya: ".nissaya.json", grammar: ".grammar.json" }[kind];
  const out = path.join(OUT, suttaId, `${edition}${suffix}`);
  if (!existsSync(out)) {
    const keys = Object.values(source).filter((v) => v.trim()).length;
    if (keys) report.missingFiles.push(`${rel} (글 있는 문장 ${keys}개)`);
    continue;
  }
  report.files++;

  // 사이트 쪽: 문장 번호 → 글자
  const site = new Map<string, string>();
  if (kind === "text") {
    for (const s of readOutText(out)) site.set(s.key, joinParts(s.parts));
  } else if (kind === "notes") {
    const notes = (readJson(out) as { notes: { key: string; mark: string; parts: Part[] }[] }).notes;
    for (const n of notes) site.set(`${n.key} ${n.mark})`, joinParts(n.parts));
  } else {
    const entries = (readJson(out) as { entries: Record<string, string> }).entries;
    for (const [k, v] of Object.entries(entries)) site.set(k, v.trim());
  }

  // 원본 쪽 (각주는 한 칸에 여러 개가 붙어 있어 번호별로 나눈다)
  const want = new Map<string, string>();
  for (const [key, value] of Object.entries(source)) {
    if (kind === "notes") {
      for (const chunk of value.split(/(?=\*\*\d+(?:-\d+)?\)?\*\*)/)) {
        const mark = chunk.match(/^\*\*(\d+(?:-\d+)?)\)?\*\*/);
        if (mark) want.set(`${key} ${mark[1]})`, clean(chunk.slice(mark[0].length)));
      }
    } else {
      want.set(key, kind === "text" ? clean(value) : value.trim());
    }
  }

  for (const [key, text] of want) {
    if (!text) {
      report.emptySkipped++;
      continue;
    }
    report.sentences++;
    if (!site.has(key)) report.missingSentences.push(`${rel} ${key}`);
    else if (site.get(key) !== text) report.changed.push(`${rel} ${key}\n      원본: ${text.slice(0, 80)}\n      사이트: ${site.get(key)?.slice(0, 80)}`);
    else report.same++;
  }
  for (const key of site.keys()) if (!want.has(key)) report.extraSentences.push(`${rel} ${key}`);
}

const list = (title: string, items: string[], limit = 30) => {
  console.log(`\n${title}: ${items.length}건`);
  for (const item of items.slice(0, limit)) console.log(`  - ${item}`);
  if (items.length > limit) console.log(`  … 외 ${items.length - limit}건`);
};
console.log(`검수한 파일 ${report.files}개, 글이 있는 문장·각주·풀이 ${report.sentences}개`);
console.log(`글자가 같음: ${report.same}개 / 빈 칸이라 뺀 것: ${report.emptySkipped}개`);
list("글자가 달라진 곳", report.changed);
list("사이트에 빠진 문장", report.missingSentences);
list("사이트에만 있는 문장", report.extraSentences);
list("사이트에 올라가지 않은 원본 파일", report.missingFiles, 60);
list("폴더와 판본 이름이 맞지 않아 앱이 읽지 않는 파일", report.misplaced);
process.exit(report.changed.length || report.missingSentences.length || report.extraSentences.length ? 1 : 0);
