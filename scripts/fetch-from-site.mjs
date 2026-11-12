// 원래 앱(theravada-application.vercel.app)의 자료를 같은 폴더 구조로 받아 content/theravada-app/ 에 넣는다.
// 그분(원래 앱 제작자)은 자기 자료 폴더를 그대로 복사하면 되므로 이 프로그램이 필요 없다. 시험·보충용이다.
//
// 사용법: node scripts/fetch-from-site.mjs [니까야 ...]     예) node scripts/fetch-from-site.mjs mn sn
//   니까야: dn mn sn an kn  (없으면 전부). 이미 받은 파일은 건너뛰고, 사이트가 끊기면 30초마다 다시 시도한다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SITE = "https://theravada-application.vercel.app";
const OUT = process.env.CONTENT_SOURCE ?? path.join(process.cwd(), "content", "theravada-app");
const CONCURRENCY = 6;

const NIKAYAS = { dn: "digha_nikaya", mn: "majjhima_nikaya", sn: "samyutta_nikaya", an: "anguttara_nikaya", kn: "khuddaka_nikaya" };
/** 쿳다까 니까야 책 → 폴더 (원래 앱과 같은 이름) */
const KN_BOOKS = { kp: "khuddakapatha", dhp: "dhammapada", ud: "udana", iti: "itivuttaka", snp: "suttanipata", vv: "vimanavatthu", pv: "petavatthu", thag: "theragatha", thig: "therigatha", "tha-ap": "thera-apadana", "thi-ap": "theri-apadana", bv: "buddhavamsa", cp: "cariyapitaka", ja: "jataka", mnd: "mahaniddesa", cnd: "culaniddesa", ps: "patisambhidamagga", ne: "nettippakaraṇa", pe: "petakopadesa", mil: "milindapanha" };
/** 이띠웃따까 품 범위 (원래 앱과 같은 값) */
const ITI_VAGGAS = [[1, 1, 10], [2, 11, 20], [3, 21, 27], [4, 28, 37], [5, 38, 49], [6, 50, 59], [7, 60, 69], [8, 70, 79], [9, 80, 89], [10, 90, 99], [11, 100, 112]];

/**
 * 원래 앱의 경 번호(sn.1.1) → 판본 폴더 안의 경로(sn1/sn1.1). 원래 앱 코드와 같은 규칙.
 * scripts/source-paths.ts 의 suttaFilePath 와 같아야 한다.
 */
function suttaFilePath(sourceId) {
  const m = sourceId.split(".");
  const y = m[0];
  if ((y === "an" || y === "sn") && m.length >= 3) return `${y}${m[1]}/${y}${m[1]}.${m[2]}`;
  if ((y === "ud" || y === "snp") && m.length >= 3) return `vagga${m[1]}/${y}${m[1]}.${m[2]}`;
  if (y === "iti" && m.length >= 2) {
    const n = Number.parseInt(m[1], 10);
    const vagga = ITI_VAGGAS.find(([, from, to]) => n >= from && n <= to)?.[0] ?? 1;
    return `vagga${vagga}/${y}${m[1]}`;
  }
  if (["thag", "thig", "ps", "mil"].includes(y) && m.length >= 3) return `${y}${m.slice(1).join(".")}`;
  return m.length >= 2 ? `${y}${m[1]}` : sourceId.replace(/\./g, "");
}

let got = 0;
let skipped = 0;
let missing = 0;
const broken = [];

async function request(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(60_000) });
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
}

/** /data/ 아래 상대 경로를 받아 저장한다. 없으면 null. 이미 있으면 받지 않고 읽어서 돌려준다. */
async function get(rel, { refresh = false } = {}) {
  const file = path.join(OUT, rel);
  if (!refresh && existsSync(file)) {
    skipped++;
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      return {};
    }
  }
  const res = await request(`${SITE}/data/${rel}`);
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) {
    missing++;
    return null;
  }
  const text = await res.text();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
  got++;
  try {
    return JSON.parse(text);
  } catch {
    broken.push(rel);
    return {};
  }
}

/** 본문은 root 를 먼저, 없으면 translation (원래 앱과 같은 순서) */
async function getText(dir, sub, edition) {
  for (const kind of ["root", "translation"]) {
    if (existsSync(path.join(OUT, `${dir}/${sub}_${kind}-${edition}.json`))) {
      skipped++;
      return;
    }
  }
  for (const kind of ["root", "translation"]) {
    if (await get(`${dir}/${sub}_${kind}-${edition}.json`)) return;
  }
}

/** 작업 목록을 동시에 몇 개씩 처리한다 */
async function runAll(jobs) {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < jobs.length) await jobs[next++]();
    }),
  );
}

function suttaIds(nodes) {
  return nodes.flatMap((n) => [...(n.suttas ?? []).map((s) => s.id), ...suttaIds(n.children ?? [])]);
}

// ── 사이트가 응답할 때까지 기다린다 ───────────────────────────
for (let tries = 1; ; tries++) {
  try {
    const res = await fetch(`${SITE}/data/edition-registry.json`, { signal: AbortSignal.timeout(20_000) });
    if (res.ok) break;
  } catch {
    // 응답 없음
  }
  if (tries >= 60) {
    console.log("사이트가 30분 동안 응답하지 않아 그만둡니다.");
    process.exit(1);
  }
  console.log(`사이트 응답 없음 — 30초 뒤 다시 시도 (${tries})`);
  await new Promise((r) => setTimeout(r, 30_000));
}

await get("edition-registry.json", { refresh: true });

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(NIKAYAS);
for (const nikayaId of wanted) {
  const folder = NIKAYAS[nikayaId];
  if (!folder) throw new Error(`모르는 니까야: ${nikayaId}`);
  const structure = await get(`sutta_pitaka/${folder}/structure.json`);
  const ids = suttaIds(structure ?? []);
  const before = got;

  const jobs = [];
  for (const id of ids) {
    const book = id.split(".")[0];
    const dir = nikayaId === "kn" ? `sutta_pitaka/${folder}/${KN_BOOKS[book] ?? book}` : `sutta_pitaka/${folder}`;
    const editions = await get(`${dir}/editions.json`);
    const sub = suttaFilePath(id);
    for (const e of Array.isArray(editions) ? editions : []) {
      const edition = e.sourceEdition ?? e.edition;
      jobs.push(() => getText(`${dir}/${e.folder}`, sub, edition));
      if (e.footnote) jobs.push(() => get(`${dir}/${e.footnote}/${sub}_comment-${edition}.json`));
    }
  }
  console.log(`${nikayaId}: 경 ${ids.length}개, 받을 파일 ${jobs.length}개`);
  await runAll(jobs);
  console.log(`${nikayaId}: 새로 받음 ${got - before}개`);
}

console.log(`전체: 새로 받음 ${got}개, 이미 있음 ${skipped}개, 없음 ${missing}개`);
if (broken.length) console.log(`형식이 깨진 파일 ${broken.length}개:\n  ${broken.join("\n  ")}`);
