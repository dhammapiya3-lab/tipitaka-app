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

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error("경 번호를 적어 주세요. 예: pnpm import:vri sn56.11");
  process.exit(1);
}

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

function findFile(dir: string, name: string): string | null {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === name) return full;
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    }
  }
  return null;
}

for (const suttaId of ids) {
  const heads = db
    .prepare("select book_id, para_id, chapter_len, title from headings where sc_id = ? order by level, para_id")
    .all(suttaId) as unknown as { book_id: string; para_id: number; chapter_len: number; title: string }[];
  if (heads.length === 0) {
    console.error(`${suttaId}: E-Piṭaka 에서 경을 찾지 못했습니다 (headings.sc_id)`);
    continue;
  }
  const head = heads[0];
  const book = head.book_id;
  const first = head.para_id + 1;
  const last = head.para_id + head.chapter_len - 1;
  const vri = linesOf(book, first, last).filter((l) => l.text);

  // 마하상기띠본 문장 (0.x 제목 줄 빼고)
  const msFile = findFile(path.join(SOURCE_ROOT, "sutta_pitaka"), `${suttaId}_root-pli-ms.json`);
  if (!msFile) {
    console.error(`${suttaId}: 마하상기띠본 원문 파일을 찾지 못했습니다`);
    continue;
  }
  const ms = Object.entries(JSON.parse(readFileSync(msFile, "utf8")) as Record<string, string>).filter(
    ([key]) => !/:0(\.|$)/.test(key),
  );

  // VRI 한 줄이 덮는 빌랄라 문장들을 앞에서부터 먹어 나간다
  const segments: Record<string, string> = {};
  const vriToKey = new Map<string, string>(); // "para:line" → 빌랄라 문장 번호
  let pos = 0;
  const unmatched: string[] = [];
  for (const l of vri) {
    let rest = norm(l.text);
    const startKey = ms[Math.min(pos, ms.length - 1)]?.[0];
    let used = 0;
    while (pos < ms.length && rest.length > 0) {
      const m = norm(ms[pos][1]);
      if (!m) {
        pos++;
        continue;
      }
      const probe = m.slice(0, Math.min(12, m.length));
      if (!rest.startsWith(probe)) break;
      rest = rest.slice(Math.min(m.length, rest.length));
      pos++;
      used++;
    }
    if (used === 0) {
      unmatched.push(`${l.para}:${l.line} ${l.text.slice(0, 40)}`);
      if (pos < ms.length) pos++; // 짝을 못 찾으면 한 문장 건너뛰고 그 자리에 둔다
    }
    const key = startKey ?? ms.at(-1)![0];
    segments[key] = segments[key] ? `${segments[key]} ${l.text}` : l.text;
    vriToKey.set(`${l.para}:${l.line}`, key);
  }
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
    const from = Math.min(...links.map((l) => l.dst_para));
    const to = Math.max(...links.map((l) => l.dst_para));
    const lines = linesOf(dstBook, from, to);
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
        words: [...new Set(own.map((l) => l.word).filter(Boolean))] as string[],
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
    return { book: dstBook, bookName: info.book_name, vriCode: info.vri_id, from, to, paras };
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
  writeFileSync(path.join(OUT, `${suttaId}.json`), `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    `${suttaId}: ${book} ${first}~${last} · VRI ${vri.length}줄 → 빌랄라 ${Object.keys(segments).length}문장 · ` +
      `주석서 ${out.attha?.paras.length ?? 0}문단 · 복주석서 ${out.tika?.paras.length ?? 0}문단` +
      (unmatched.length ? `\n  짝을 못 찾은 VRI 줄 ${unmatched.length}개:\n   - ${unmatched.join("\n   - ")}` : ""),
  );
}
