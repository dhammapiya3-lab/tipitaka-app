/**
 * 경마다 주제 해시태그(#자애 #선정 …)를 단다 — 주제별로 경을 모아 볼 수 있게.
 *
 *   pnpm build:topics      (pnpm build:content 다음에)
 *
 * - 사람이 손으로 만든 색인(CIPS 등)은 저작권 허락이 없어 쓰지 않고, 이 사이트가 스스로 단다:
 *   ① 상윳따의 주제별 묶음(연기 상윳따 → #연기, 진리 상윳따 → #사성제 …)은 그 묶음의 모든 경에.
 *   ② 경의 빠알리 원문(마하상기띠본)에서 주제마다 정한 핵심 낱말이 얼마나 나오는지 세어, 그 경에서 두드러진 주제를 많아야 5개.
 *      (흔한 주제는 덜, 드문 주제는 더 무겁게 — 많이 나오는 낱말일수록 그 경의 주제일 가능성이 크다)
 * - 자동으로 단 것이라 빠지거나 넘치는 것이 있다 (화면에 알린다).
 * - 결과: public/data/topics.json  { topics: [{id, ko, pali, count}], suttas: { 경: [주제 id …] } }
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { normalizeWord } from "../src/lib/pali";
import { SOURCE_ROOT } from "./paths";

interface Topic {
  id: string;
  ko: string;
  pali: string;
  /** 낱말 첫머리 (= 로 시작하면 그 낱말 그대로만) */
  stems: string[];
}
// prettier-ignore
const TOPICS: Topic[] = [
  { id: "metta", ko: "자애", pali: "mettā", stems: ["mett"] },
  { id: "karuna", ko: "연민", pali: "karuṇā", stems: ["karuṇ"] },
  { id: "mudita", ko: "더불어 기뻐함", pali: "muditā", stems: ["mudit"] },
  { id: "upekkha", ko: "평온", pali: "upekkhā", stems: ["upekkh"] },
  { id: "jhana", ko: "선정", pali: "jhāna", stems: ["jhān", "paṭhamajjhān", "dutiyajjhān", "tatiyajjhān", "catutthajjhān"] },
  { id: "samadhi", ko: "삼매", pali: "samādhi", stems: ["samādh"] },
  { id: "sati", ko: "마음챙김", pali: "sati", stems: ["=sati", "=sato", "=satiṃ", "=satimā", "satimant", "satisampajañ", "satindriy", "satisambojjh"] },
  { id: "satipatthana", ko: "사념처", pali: "satipaṭṭhāna", stems: ["satipaṭṭhān", "kāyānupass", "vedanānupass", "cittānupass", "dhammānupass"] },
  { id: "anapana", ko: "들숨날숨", pali: "ānāpānasati", stems: ["ānāpān", "assasām", "passasām", "assasati", "passasati"] },
  { id: "sampajanna", ko: "알아차림", pali: "sampajañña", stems: ["sampajān", "sampajañ"] },
  { id: "sacca", ko: "사성제", pali: "ariyasacca", stems: ["ariyasacc", "dukkhasamuday", "dukkhanirodh"] },
  { id: "magga", ko: "팔정도", pali: "ariya aṭṭhaṅgika magga", stems: ["aṭṭhaṅgik", "sammādiṭṭh", "sammāsaṅkapp", "sammāvāc", "sammākammant", "sammāājīv", "sammāvāyām", "sammāsat", "sammāsamādh"] },
  { id: "paticca", ko: "연기", pali: "paṭiccasamuppāda", stems: ["paṭiccasamuppād", "idappaccayat", "avijjāpaccayā", "jātipaccayā", "taṇhāpaccayā"] },
  { id: "khandha", ko: "오온", pali: "khandha", stems: ["khandh", "upādānakkhandh"] },
  { id: "ayatana", ko: "여섯 감각 장소", pali: "saḷāyatana", stems: ["saḷāyatan", "ajjhattikāyatan", "bāhirāyatan", "cakkhuviññāṇ", "cakkhusamphass"] },
  { id: "dhatu", ko: "요소", pali: "dhātu", stems: ["dhātu", "pathavīdhāt", "āpodhāt", "tejodhāt", "vāyodhāt"] },
  { id: "tilakkhana", ko: "무상·고·무아", pali: "anicca dukkha anattā", stems: ["anicc", "anatt", "=netaṃ"] },
  { id: "nibbana", ko: "열반", pali: "nibbāna", stems: ["nibbān", "parinibbā", "nibbut"] },
  { id: "kamma", ko: "업과 과보", pali: "kamma", stems: ["=kamma", "=kammaṃ", "=kammāni", "=kammena", "=kammassa", "kammassak", "kammavipāk", "kammadāyād", "=vipāko", "vipākaṃ"] },
  { id: "sila", ko: "계", pali: "sīla", stems: ["sīl", "pāṇātipāt", "adinnādān", "musāvād", "surāmeraya"] },
  { id: "dana", ko: "보시", pali: "dāna", stems: ["=dānaṃ", "=dāna", "=dānāni", "=dānena", "dānapati", "dāyak", "=deti", "=denti", "dakkhiṇ"] },
  { id: "saddha", ko: "믿음", pali: "saddhā", stems: ["saddh"] },
  { id: "viriya", ko: "정진", pali: "vīriya", stems: ["vīriy", "=padhāna", "sammappadhān", "ātapp", "āraddhavīriy"] },
  { id: "panna", ko: "지혜", pali: "paññā", stems: ["paññ"] },
  { id: "bojjhanga", ko: "칠각지", pali: "bojjhaṅga", stems: ["bojjhaṅg", "sambojjhaṅg"] },
  { id: "indriya", ko: "다섯 기능", pali: "indriya", stems: ["indriy", "saddhindriy", "paññindriy"] },
  { id: "bala", ko: "다섯 힘", pali: "bala", stems: ["=balāni", "saddhābal", "vīriyabal", "satibal", "samādhibal", "paññābal"] },
  { id: "iddhipada", ko: "성취 수단", pali: "iddhipāda", stems: ["iddhipād"] },
  { id: "abhinna", ko: "신통과 최상의 지혜", pali: "abhiññā", stems: ["chaḷabhiñ", "iddhividh", "dibbacakkh", "dibbasot", "pubbenivās", "cetopariy", "āsavakkhay"] },
  { id: "nivarana", ko: "다섯 장애", pali: "nīvaraṇa", stems: ["nīvaraṇ", "kāmacchand", "thinamiddh", "uddhaccakukkucc", "vicikicch"] },
  { id: "kama", ko: "감각적 욕망", pali: "kāma", stems: ["kāmaguṇ", "=kāmesu", "=kāmā", "=kāme", "kāmarāg", "kāmasukh"] },
  { id: "tanha", ko: "갈애", pali: "taṇhā", stems: ["taṇh"] },
  { id: "avijja", ko: "무명", pali: "avijjā", stems: ["avijj"] },
  { id: "kilesa", ko: "탐욕·성냄·어리석음", pali: "lobha dosa moha", stems: ["lobh", "=rāgo", "=doso", "=moho", "rāgakkhay", "dosakkhay", "mohakkhay", "akusalamūl", "kusalamūl"] },
  { id: "kodha", ko: "분노와 악의", pali: "kodha byāpāda", stems: ["kodh", "byāpād", "upanāh", "=kujjh", "akkodh"] },
  { id: "vedana", ko: "느낌", pali: "vedanā", stems: ["vedan", "sukhavedan", "dukkhavedan"] },
  { id: "vinnana", ko: "의식", pali: "viññāṇa", stems: ["viññāṇ"] },
  { id: "citta", ko: "마음", pali: "citta", stems: ["=citta", "=cittaṃ", "=cittena", "=cittassa", "=citte", "cetovimutt", "cittasamādh"] },
  { id: "samsara", ko: "윤회", pali: "saṃsāra", stems: ["saṃsār", "anamatagg", "punabbhav", "=jāti", "jātijarāmaraṇ"] },
  { id: "niraya", ko: "지옥과 악처", pali: "niraya apāya", stems: ["niray", "apāy", "vinipāt", "duggat", "tiracchānayon", "pettivisay"] },
  { id: "deva", ko: "천신과 하늘", pali: "devatā", stems: ["devat", "devaputt", "devalok", "sagga", "=devā", "tāvatiṃs", "sugatiṃ"] },
  { id: "mara", ko: "마라", pali: "māra", stems: ["=māro", "=māra", "=māraṃ", "=mārassa", "pāpimant", "=pāpima"] },
  { id: "brahma", ko: "범천", pali: "brahmā", stems: ["=brahmā", "brahmalok", "brahmavihār", "brahmuno", "sahampat"] },
  { id: "sakka", ko: "제석천", pali: "sakka", stems: ["devānamind", "=vāsava", "=maghavā", "=vāsavo", "sakkassa"] },
  { id: "bhikkhuni", ko: "비구니", pali: "bhikkhunī", stems: ["bhikkhunī", "bhikkhuniy", "bhikkhunis", "=bhikkhuni", "bhikkhunupassay"] },
  { id: "gihi", ko: "재가자의 삶", pali: "gahapati upāsaka", stems: ["upāsak", "gahapat", "gihī", "=gihi", "agāramajjh", "kulaputt"] },
  { id: "pabbajja", ko: "출가", pali: "pabbajjā", stems: ["pabbaj", "anagāriy", "agārasmā"] },
  { id: "sangha", ko: "승가", pali: "saṅgha", stems: ["saṅgh", "sāvakasaṅgh"] },
  { id: "marana", ko: "죽음", pali: "maraṇa", stems: ["maraṇ", "maraṇasat", "kālakat", "=mato", "=mataṃ"] },
  { id: "gilana", ko: "병과 간병", pali: "gilāna", stems: ["gilān", "=ābādhiko", "=bāḷhagilāno", "gilānupaṭṭhāk"] },
  { id: "punna", ko: "공덕", pali: "puñña", stems: ["puññ"] },
  { id: "vaca", ko: "바른 말", pali: "vācā", stems: ["musāvād", "pisuṇ", "pharus", "samphappalāp", "subhāsit"] },
  { id: "ariya", ko: "성자의 단계", pali: "sotāpanna … arahant", stems: ["sotāpann", "sotāpatt", "sakadāgām", "anāgām", "arahatt", "arahant", "=arahaṃ"] },
  { id: "asubha", ko: "부정관과 몸", pali: "asubha kāyagatāsati", stems: ["asubh", "kāyagat", "paṭikkūl"] },
  { id: "sunnata", ko: "공", pali: "suññatā", stems: ["suññat", "=suñña", "=suññaṃ", "animitt", "appaṇihit"] },
  { id: "piti", ko: "기쁨과 행복", pali: "pīti sukha", stems: ["pīti", "pāmojj", "=sukhaṃ", "somanass"] },
  { id: "buddha", ko: "부처님", pali: "buddha tathāgata", stems: ["tathāgat", "sammāsambuddh", "bodhisatt", "abhisambujjh"] },
  { id: "ditthi", ko: "견해", pali: "diṭṭhi", stems: ["diṭṭhi", "diṭṭhigat", "micchādiṭṭh", "sassatavād", "ucchedavād", "sakkāyadiṭṭh"] },
  { id: "asava", ko: "번뇌", pali: "āsava", stems: ["āsav", "anāsav", "kiles"] },
];

/** 상윳따 묶음 → 그 묶음의 모든 경에 붙는 주제 */
// prettier-ignore
const SAMYUTTA: Record<string, string[]> = {
  sn4: ["mara"], sn5: ["bhikkhuni"], sn6: ["brahma"], sn11: ["sakka"], sn12: ["paticca"], sn13: ["ariya"], sn14: ["dhatu"],
  sn15: ["samsara"], sn18: ["tilakkhana"], sn22: ["khandha"], sn23: ["khandha"], sn24: ["ditthi"], sn25: ["tilakkhana"], sn26: ["tilakkhana"],
  sn27: ["kilesa"], sn28: ["jhana"], sn34: ["jhana", "samadhi"], sn35: ["ayatana"], sn36: ["vedana"], sn38: ["nibbana"], sn40: ["jhana"],
  sn43: ["nibbana"], sn45: ["magga"], sn46: ["bojjhanga"], sn47: ["satipatthana"], sn48: ["indriya"], sn49: ["viriya"], sn50: ["bala"],
  sn51: ["iddhipada"], sn53: ["jhana"], sn54: ["anapana"], sn55: ["ariya"], sn56: ["sacca"],
};

const MAX_TAGS = 5;

// ── 경 목록과 원문 ──
const index = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "public/data/sutta-index.json"),
    "utf8",
  ),
) as { id: string }[];
const msFiles = new Map<string, string>();
(function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith("_root-pli-ms.json"))
      msFiles.set(name.replace("_root-pli-ms.json", ""), p);
  }
})(path.join(SOURCE_ROOT, "sutta_pitaka"));

const matchers = TOPICS.map((t) => ({
  exact: new Set(
    t.stems
      .filter((s) => s.startsWith("="))
      .map((s) => normalizeWord(s.slice(1))),
  ),
  prefix: t.stems
    .filter((s) => !s.startsWith("="))
    .map((s) => normalizeWord(s)),
}));
const counts = new Map<string, { words: number; c: number[] }>();
const df = new Array(TOPICS.length).fill(0);
for (const { id } of index) {
  const file = msFiles.get(id);
  if (!file) continue;
  const text = Object.entries(
    JSON.parse(readFileSync(file, "utf8")) as Record<string, string>,
  )
    .filter(([k]) => !/:0(\.|$)/.test(k))
    .map(([, v]) => v)
    .join(" ")
    .replace(/<[^>]+>/g, " ");
  const words = text
    .split(/[^\p{L}\p{M}]+/u)
    .map(normalizeWord)
    .filter(Boolean);
  const c = TOPICS.map((_, i) => {
    const m = matchers[i];
    let n = 0;
    for (const w of words)
      if (m.exact.has(w) || m.prefix.some((p) => w.startsWith(p))) n++;
    return n;
  });
  c.forEach((n, i) => n > 0 && df[i]++);
  counts.set(id, { words: words.length, c });
}
const N = counts.size;
const idf = df.map((d) => Math.log((N + 1) / (d + 1)) + 1);

const suttas: Record<string, string[]> = {};
const tally = new Map<string, number>();
for (const [id, { words, c }] of counts) {
  const forced = SAMYUTTA[id.match(/^(sn\d+)\./)?.[1] ?? ""] ?? [];
  // 긴 경일수록 우연히 나오는 낱말이 많다 — 길이의 제곱근으로 나눈다
  const scored = c
    .map((n, i) => ({ i, n, s: (n / Math.sqrt(Math.max(words, 50))) * idf[i] }))
    .filter(({ n, s }) => n >= (words < 150 ? 1 : 2) && s >= 0.35)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_TAGS)
    .map(({ i }) => TOPICS[i].id);
  const tags = [...new Set([...forced, ...scored])].slice(
    0,
    MAX_TAGS + forced.length,
  );
  if (tags.length) {
    suttas[id] = tags;
    for (const t of tags) tally.set(t, (tally.get(t) ?? 0) + 1);
  }
}
const out = {
  topics: TOPICS.map((t) => ({
    id: t.id,
    ko: t.ko,
    pali: t.pali,
    count: tally.get(t.id) ?? 0,
  })),
  suttas,
};
writeFileSync(
  path.join(process.cwd(), "public/data/topics.json"),
  JSON.stringify(out),
);
console.log(
  `주제 ${TOPICS.length}개 · 주제를 단 경 ${Object.keys(suttas).length.toLocaleString()}개 / ${N.toLocaleString()}개`,
);
for (const id of [
  "sn56.11",
  "mn10",
  "dn22",
  "an3.65",
  "sn22.59",
  "mn21",
  "snp1.8",
  "mn135",
  "dn16",
  "sn1.1",
]) {
  console.log(
    `  ${id}: ${(suttas[id] ?? []).map((t) => `#${TOPICS.find((x) => x.id === t)!.ko}`).join(" ")}`,
  );
}
console.log(out.topics.map((t) => `${t.ko} ${t.count}`).join(" · "));
