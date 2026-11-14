/**
 * 책 쪽 번호 — 인쇄본의 쪽이 바뀌는 곳(또는 판본의 문단 번호)을 문장·주석 줄 옆에 작게 보인다.
 * 자료: VRI 원문(XML)의 쪽 표시 P·M·T·V (content/vri-pages.json) + 수따센따 참조 번호 (content/sc-refs.json)
 */

/** 화면에 보이는 쪽 표시 하나 — 글자와, 마우스를 올리면 뜨는 설명 */
export interface PageMark {
  label: string;
  title: string;
}

/** 고를 수 있는 판본 (텍스트 설정의 '책 쪽 번호') — 차례대로 */
export const PAGE_EDITIONS: { ed: string; label: string; title: string }[] = [
  { ed: "P", label: "PTS", title: "PTS(Pali Text Society) 인쇄본 — 권·쪽" },
  { ed: "pts-cs", label: "PTS 문단", title: "PTS본 문단(절) 번호" },
  { ed: "M", label: "미얀마 6차", title: "미얀마 제6차 결집 인쇄본 — 권.쪽" },
  {
    ed: "V",
    label: "VRI 인쇄본",
    title: "VRI(위빳사나 연구소) 인쇄본 — 권.쪽",
  },
  { ed: "T", label: "태국", title: "태국 인쇄본 — 권.쪽" },
  {
    ed: "sya",
    label: "태국 시암본",
    title: "태국 시암본 (Syāmaraṭṭha, 2538/1995) — 권.쪽",
  },
  {
    ed: "cck",
    label: "태국 쭐라쫌끌라오본",
    title: "태국 쭐라쫌끌라오본 (Chulachomklao, 1893) — 권.쪽",
  },
  {
    ed: "mc",
    label: "태국 마하쭐라본",
    title: "태국 마하쭐라본 (Mahācūḷā) — 권.쪽",
  },
  {
    ed: "dr",
    label: "태국 다이야랏타본",
    title: "태국 다이야랏타본 (Dayyaraṭṭha) — 권.쪽",
  },
  {
    ed: "bj",
    label: "스리랑카 BJT",
    title: "스리랑카 붓다자얀띠본 (Buddha Jayanti Tripiṭaka) — 권.쪽",
  },
  {
    ed: "ndp",
    label: "인도 날란다본",
    title: "인도 날란다 데바나가리본 (Nālandā, 1957–62) — 권.쪽",
  },
  {
    ed: "nya",
    label: "냐나몰리 문단",
    title: "냐나몰리 스님의 맛지마 니까야 번역 문단 번호",
  },
];

const SHORT: Record<string, string> = {
  M: "Mya",
  T: "Thai",
  V: "VRI",
  sya: "Syā",
  cck: "Cck",
  mc: "Mc",
  dr: "Dr",
  bj: "BJT",
  ndp: "NDP",
};

const ROMAN = ["", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];

/**
 * 쪽 표시 하나의 글자와 설명.
 * key: 문장 번호(경 본문) 또는 c:<책>:<문단>:<줄>(주석서·복주석서), ed: 판, n: 권.쪽(VRI) 또는 번호(수따센따)
 */
export function pageMark(
  suttaId: string,
  key: string,
  ed: string,
  n: string,
): PageMark {
  const title = PAGE_EDITIONS.find((e) => e.ed === ed)?.title ?? ed;
  if (ed === "pts-cs") return { label: `PTS §${n}`, title };
  if (ed === "nya") return { label: `Ñāṇ §${n}`, title };
  if (ed in SHORT && !"MTV".includes(ed))
    return { label: `${SHORT[ed]} ${n}`, title };
  const [vol, page] = n.split(".");
  const pg = String(Number(page));
  if (ed === "P") {
    // 주석서·복주석서 줄(c:<책>:…)의 PTS 쪽은 그 주석서 이름으로 (Spk iii 296), 경은 학계에서 쓰는 꼴로 (S v 421)
    const commBook = key.startsWith("c:")
      ? key.split(":")[1].replace(/-(?:i|ii|iii|iv|v|vi)$/, "")
      : null;
    const nikaya = suttaId.match(/^(dn|mn|sn|an)/)?.[1];
    const label = commBook
      ? `PTS ${commBook} ${ROMAN[Number(vol)] ?? vol} ${pg}`
      : `PTS ${nikaya ? `${nikaya[0].toUpperCase()} ${ROMAN[Number(vol)] ?? vol} ` : `${Number(vol)}.`}${pg}`;
    return { label, title: `${title}${commBook ? ` (${commBook})` : ""}` };
  }
  return { label: `${SHORT[ed] ?? ed} ${Number(vol)}.${pg}`, title };
}
