/**
 * 주석서 풀이 찾기 — 주석서·복주석서가 풀이하는 낱말(VRI 원본에서 굵게 찍힌 표제어, 보통 "~ti" 앞)을 모아
 * 낱말로 찾을 수 있게 한다. Digital Pāli Reader 의 "Aṭṭhakathā Terms"·"Ṭīkā Terms" 와 같은 생각이지만,
 * 자료는 DPR 것이 아니라 이 사이트의 VRI 주석 원문(content/vri/*.json)에서 직접 뽑는다 — 그래서 결과에서
 * 바로 그 주석 문단으로 갈 수 있다. 글은 바꾸지 않고 그 줄을 그대로 보여 준다.
 *
 * 나오는 것: public/data/att/h<n>.json — { l: [주석 줄…], k: { 찾는 말 열쇠: [[표제어, 경 id, 층(0 주석서·1 복주석서), 문단, l 의 줄 번호], …] } }
 *           public/data/att/info.json — 조각 수·개수
 * 열쇠는 src/lib/att.ts 의 attKey 와 같아야 한다. 경 목록(public/data/sutta-index.json)을 읽으므로 build-content 다음에 돌린다.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ATT_SHARDS, attKey, attShard } from "../src/lib/att";

const ROOT = process.cwd();
const VRI = path.join(ROOT, "content", "vri");
const OUT = path.join(ROOT, "public", "data", "att");

const commentary = z
  .object({
    vriCode: z.string().optional(),
    book: z.string(),
    paras: z.array(z.object({ para: z.number(), refs: z.array(z.string()), lines: z.array(z.string()) })),
  })
  .passthrough();
const vriFile = z
  .object({
    suttaId: z.string(),
    attha: commentary.nullable().optional(),
    tika: commentary.nullable().optional(),
    tika2: commentary.nullable().optional(),
  })
  .passthrough();
const indexSchema = z.array(
  z.object({ id: z.string(), commentary: z.array(z.string()).default([]) }).passthrough(),
);

const BOLD = /<b>(.*?)<\/b>/g;
/** 여러 낱말 표제어 속 낱말을 따로 찾게 해 줄 때, 이만큼보다 자주 나오는 낱말은 뺀다 */
const PART_LIMIT = 150;

function main() {
  const indexFile = path.join(ROOT, "public", "data", "sutta-index.json");
  if (!existsSync(indexFile)) throw new Error("public/data/sutta-index.json 이 없습니다 — build:content 를 먼저 돌리세요");
  const index = indexSchema.parse(JSON.parse(readFileSync(indexFile, "utf8")));
  const order = new Map(index.map((e, i) => [e.id, i]));
  const shown = new Map(index.map((e) => [e.id, new Set(e.commentary)]));

  // 같은 주석 문단이 여러 경 파일에 들어 있다(묶음 경) — 문단의 refs 가 가리키는 경을 고르고, 없으면 처음 경
  type Hit = { term: string; sutta: string; layer: 0 | 1; para: number; line: string };
  const owner = new Map<string, { sutta: string; hit: Omit<Hit, "sutta">[] }>();
  const files = readdirSync(VRI)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".ko.json") && !f.startsWith("_"))
    .map((f) => vriFile.parse(JSON.parse(readFileSync(path.join(VRI, f), "utf8"))))
    .filter((d) => order.has(d.suttaId))
    .sort((a, b) => order.get(a.suttaId)! - order.get(b.suttaId)!);
  for (const d of files) {
    for (const name of ["attha", "tika", "tika2"] as const) {
      const c = d[name];
      const layer = name === "attha" ? 0 : 1;
      if (!c || !shown.get(d.suttaId)?.has(layer === 0 ? "attha" : "tika")) continue;
      for (const p of c.paras) {
        const at = `${c.vriCode ?? c.book}/${p.para}`;
        const refSutta = p.refs.map((r) => r.split(":")[0]).find((s) => s === d.suttaId);
        const prev = owner.get(at);
        if (prev && !refSutta) continue; // 이미 다른 경에서 본 문단
        const hits: Omit<Hit, "sutta">[] = [];
        for (const line of p.lines) {
          const seen = new Set<string>();
          for (const m of line.matchAll(BOLD)) {
            const term = m[1].replace(/<[^>]+>/g, "").trim();
            if (!term || seen.has(term)) continue;
            seen.add(term);
            hits.push({ term, layer, para: p.para, line });
          }
        }
        if (!prev || refSutta) owner.set(at, { sutta: d.suttaId, hit: hits });
      }
    }
  }

  // 열쇠마다 모은다 — 여러 낱말 표제어("paṭipanno hotī")는 통째 열쇠와 낱말마다의 열쇠에 모두 넣는다
  // 조각마다 줄은 한 번만 적고(l), 열쇠 목록은 줄 번호로 가리킨다(k)
  type Row = [string, string, number, number, number];
  const shards = Array.from({ length: ATT_SHARDS }, () => ({ l: [] as string[], at: new Map<string, number>(), k: {} as Record<string, Row[]> }));
  let count = 0;
  const terms = new Set<string>();
  // 여러 낱말 표제어 속 낱말 가운데 아주 흔한 말(na·ca·hoti 등)은 낱말 열쇠에 넣지 않는다 — 통째로 굵은 표제어일 때만 찾힌다
  const partCount = new Map<string, number>();
  for (const { hit } of owner.values())
    for (const h of hit) {
      const parts = h.term.split(/\s+/);
      if (parts.length > 1) for (const k of new Set(parts.map(attKey))) partCount.set(k, (partCount.get(k) ?? 0) + 1);
    }
  for (const { sutta, hit } of owner.values()) {
    for (const h of hit) {
      const parts = h.term.split(/\s+/).map(attKey);
      const keys = new Set(
        [attKey(h.term), ...(parts.length > 1 ? parts.filter((k) => (partCount.get(k) ?? 0) <= PART_LIMIT) : [])].filter(
          (k) => k.length > 1,
        ),
      );
      for (const k of keys) {
        const s = shards[attShard(k)];
        let li = s.at.get(h.line);
        if (li === undefined) {
          li = s.l.push(h.line) - 1;
          s.at.set(h.line, li);
        }
        (s.k[k] ??= []).push([h.term, sutta, h.layer, h.para, li]);
      }
      count++;
      terms.add(h.term.toLowerCase());
    }
  }
  // 차례: 경 차례 → 주석서 먼저 → 문단
  for (const s of shards)
    for (const list of Object.values(s.k))
      list.sort((a, b) => order.get(a[1])! - order.get(b[1])! || a[2] - b[2] || a[3] - b[3]);

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  shards.forEach((s, i) => writeFileSync(path.join(OUT, `h${i}.json`), JSON.stringify({ l: s.l, k: s.k })));
  writeFileSync(path.join(OUT, "info.json"), JSON.stringify({ shards: ATT_SHARDS, entries: count, terms: terms.size }));
  console.log(`주석서 풀이: 표제어 ${count.toLocaleString()}곳 (서로 다른 말 ${terms.size.toLocaleString()}개), 조각 ${ATT_SHARDS}개`);
}

main();
