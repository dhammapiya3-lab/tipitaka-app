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

const args = process.argv.slice(2);
/** --all: 사이트 목록(public/data/sutta-index.json)의 모든 경 */
const ids =
  args[0] === "--all"
    ? (JSON.parse(readFileSync(path.join(process.cwd(), "public/data/sutta-index.json"), "utf8")) as { id: string }[]).map(
        (s) => s.id,
      )
    : args;
if (ids.length === 0) {
  console.error("경 번호를 적어 주세요. 예: pnpm import:vri sn56.11 (모두: pnpm import:vri --all)");
  process.exit(1);
}
const quiet = ids.length > 20;

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
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, "")
    .replace(/ṁ/g, "ṃ")
    .replace(/…\s*pe\s*…|\.\.\.pe\.\.\./g, "")
    .replace(/[^a-zāīūṃṅñṭḍṇḷ]/g, "");
}

function linesOf(book: string, from: number, to: number): Line[] {
  return (
    db
      .prepare(
        "select para_id as para, line_id as line, vripara, pali as text from sentences where book_id = ? and para_id between ? and ? order by para_id, line_id",
      )
      .all(book, from, to) as unknown as Line[]
  ).map((l) => ({ ...l, text: tidy(String(l.text)) }));
}

/** 마하상기띠본 원문 파일: 파일 이름 → 경로 (한 번만 훑는다) */
const msFiles = new Map<string, string>();
(function walk(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith("_root-pli-ms.json")) msFiles.set(entry.name, full);
  }
})(path.join(SOURCE_ROOT, "sutta_pitaka"));



const stats = { done: 0, lines: 0, unmatched: 0, missing: [] as string[], withUnmatched: [] as string[] };
for (const suttaId of ids) {
  const heads = db
    .prepare("select book_id, para_id, chapter_len, title from headings where sc_id = ? order by level, para_id")
    .all(suttaId) as unknown as { book_id: string; para_id: number; chapter_len: number; title: string }[];
  if (heads.length === 0) {
    if (!quiet) console.error(`${suttaId}: E-Piṭaka 에서 경을 찾지 못했습니다 (headings.sc_id)`);
    stats.missing.push(suttaId);
    continue;
  }
  const head = heads[0];
  const book = head.book_id;
  const first = head.para_id + 1;
  const last = head.para_id + head.chapter_len - 1;
  const vri = linesOf(book, first, last).filter((l) => l.text);

  // 마하상기띠본 문장 (0.x 제목 줄 빼고)
  const msFile = msFiles.get(`${suttaId}_root-pli-ms.json`) ?? null;
  if (!msFile) {
    if (!quiet) console.error(`${suttaId}: 마하상기띠본 원문 파일을 찾지 못했습니다`);
    stats.missing.push(suttaId);
    continue;
  }
  const ms = Object.entries(JSON.parse(readFileSync(msFile, "utf8")) as Record<string, string>).filter(
    ([key]) => !/:0(\.|$)/.test(key),
  );

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
    if (to > from && matched < (to - from) / 2) unmatched.push(`${l.para}:${l.line} ${l.text.slice(0, 40)}`);
    prevSeg = seg;
    const key = ms[seg]?.[0] ?? ms.at(-1)![0];
    segments[key] = segments[key] ? `${segments[key]} ${l.text}` : l.text;
    vriToKey.set(`${l.para}:${l.line}`, key);
  });
  // 경 이름 줄 — 마하상기띠본의 마지막 제목 줄(0.x) 자리에 VRI 경 이름을 둔다
  const msTitleKey = Object.keys(JSON.parse(readFileSync(msFile, "utf8")) as Record<string, string>)
    .filter((k) => /:0\.\d+$/.test(k))
    .at(-1);
  const titled = msTitleKey ? { [msTitleKey]: tidy(head.title).replace(/^\d+\.\s*/, "") } : {};

  /** 경 문단(VRI para) → 빌랄라 문단(sn56.11:2) */
  const paraToMark = (para: number, line?: number) => {
    const key =
      (line !== undefined ? vriToKey.get(`${para}:${line}`) : undefined) ??
      vri.filter((l) => l.para === para).map((l) => vriToKey.get(`${l.para}:${l.line}`))[0];
    return key ? key.slice(0, key.lastIndexOf(".")) : null;
  };

  const meta = db.prepare("select attha_ref, tika_ref from books where book_id = ?").get(book) as
    | { attha_ref: string | null; tika_ref: string | null }
    | undefined;

  function commentary(dstBook: string | null | undefined) {
    if (!dstBook) return null;
    const links = db
      .prepare(
        "select src_para, src_line, dst_para, dst_line, word from book_links where src_book = ? and src_para between ? and ? and dst_book = ? order by dst_para, dst_line",
      )
      .all(book, first, last, dstBook) as unknown as {
      src_para: number;
      src_line: number;
      dst_para: number;
      dst_line: number;
      word: string | null;
    }[];
    if (links.length === 0) return null;
    // 같은 낱말이 멀리 떨어진 다른 경의 주석에도 걸리는 일이 있어(엉뚱한 링크), 연결된 문단을 가까운 것끼리
    // 묶어 가장 많이 걸린 묶음(과 그만큼 많이 걸린 묶음)만 쓴다.
    const linked = [...new Set(links.map((l) => l.dst_para))].sort((a, b) => a - b);
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
    links.splice(0, links.length, ...links.filter((l) => l.dst_para >= from && l.dst_para <= to));
    let cursor = 0;
    const paras = [...new Set(lines.map((l) => l.para))].map((para) => {
      const own = links.filter((l) => l.dst_para === para);
      const refs = ([...new Set(own.map((l) => paraToMark(l.src_para, l.src_line)).filter(Boolean))] as string[]).sort(
        (a, b) => Number(a.split(":")[1]) - Number(b.split(":")[1]),
      );
      const mine = lines.filter((l) => l.para === para && l.text);
      let last: string[] | null = null;
      return {
        para,
        vripara: lines.find((l) => l.para === para && l.vripara)?.vripara ?? null,
        refs,
        lines: mine.map((l) => l.text),
        // 줄마다 풀이하는 경 문단 — 연결이 없는 줄은 바로 앞 줄을 따른다 (첫 줄들은 문단 전체의 연결)
        lineRefs: mine.map((l) => {
          const found = [
            ...new Set(own.filter((k) => k.dst_line === l.line).map((k) => paraToMark(k.src_para, k.src_line)).filter(Boolean)),
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
    const info = db.prepare("select book_name, vri_id from books where book_id = ?").get(dstBook) as {
      book_name: string;
      vri_id: string;
    };
    // 낱말 연결: [경 문장 번호, 낱말, 주석 문단 순번, 그 문단 안 줄 순번] — 경의 낱말을 누르면 그 주석 줄로 간다
    const paraIndex = new Map(paras.map((p, i) => [p.para, i]));
    const lineIndex = new Map<string, number>();
    for (const para of paras) {
      lines.filter((l) => l.para === para.para && l.text).forEach((l, i) => lineIndex.set(`${l.para}:${l.line}`, i));
    }
    const wordLinks: [string, string, number, number][] = [];
    const seenLink = new Set<string>();
    for (const l of links) {
      const key = vriToKey.get(`${l.src_para}:${l.src_line}`);
      const pi = paraIndex.get(l.dst_para);
      const li = lineIndex.get(`${l.dst_para}:${l.dst_line}`);
      const word = (l.word ?? "").toLowerCase().replace(/ṁ/g, "ṃ").replace(/\s+/g, " ").trim();
      if (!key || pi === undefined || li === undefined || !word) continue;
      // 같은 낱말이 경의 여러 곳에 나와 걸린 엉뚱한 연결은 뺀다 (그 주석 줄이 풀이하는 문단만)
      if (!paras[pi].lineRefs[li].includes(key.slice(0, key.lastIndexOf(".")))) continue;
      const id = `${key}|${word}|${pi}|${li}`;
      if (seenLink.has(id)) continue;
      seenLink.add(id);
      wordLinks.push([key, word, pi, li]);
    }
    return { book: dstBook, bookName: info.book_name, vriCode: info.vri_id, from, to, paras, wordLinks };
  }

  const out = {
    suttaId,
    source: {
      db: "E-Piṭaka (dhammanana/epitaka_app)",
      book,
      vriCode: (db.prepare("select vri_id from books where book_id = ?").get(book) as { vri_id: string }).vri_id,
      paras: [first, last],
      vripara: vri.find((l) => l.vripara)?.vripara ?? null,
    },
    segments: { ...titled, ...segments },
    attha: commentary(meta?.attha_ref),
    tika: commentary(meta?.tika_ref),
  };
  writeFileSync(path.join(OUT, `${suttaId}.json`), quiet ? `${JSON.stringify(out)}\n` : `${JSON.stringify(out, null, 2)}\n`);
  stats.done++;
  stats.unmatched += unmatched.length;
  stats.lines += vri.length;
  if (unmatched.length) stats.withUnmatched.push(`${suttaId}(${unmatched.length})`);
  if (!quiet) console.log(
    `${suttaId}: ${book} ${first}~${last} · VRI ${vri.length}줄 → 빌랄라 ${Object.keys(segments).length}문장 · ` +
      `주석서 ${out.attha?.paras.length ?? 0}문단 · 복주석서 ${out.tika?.paras.length ?? 0}문단` +
      (unmatched.length ? `\n  짝을 못 찾은 VRI 줄 ${unmatched.length}개:\n   - ${unmatched.join("\n   - ")}` : ""),
  );
}
if (quiet) {
  console.log(
    `경 ${stats.done}개 · VRI ${stats.lines}줄 · 짝을 못 찾은 줄 ${stats.unmatched}개 (${stats.withUnmatched.length}개 경)\n` +
      `E-Piṭaka 에 없는 경 ${stats.missing.length}개: ${stats.missing.join(" ")}`,
  );
  writeFileSync(
    path.join(OUT, "_import-report.txt"),
    `짝을 못 찾은 줄이 있는 경:\n${stats.withUnmatched.join("\n")}\n\nE-Piṭaka 에 없는 경:\n${stats.missing.join("\n")}\n`,
  );
}
