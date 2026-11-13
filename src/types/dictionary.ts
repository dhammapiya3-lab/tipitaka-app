/** 사전 하나의 표시 정보 */
export interface DictionaryInfo {
  id: DictionaryId;
  label: string;
  /** 이용 조건. 모르면 null ("확인 중") */
  license: string | null;
  source: string;
}

/** 표제어 → 뜻풀이 글만 있는 사전 (K-PTS 한국어 · PTS 영어 · 미얀마) */
export type PlainDictionaryId = "kpts" | "pts" | "mm" | "peu" | "cone";
export type DictionaryId = "dpd" | PlainDictionaryId;

/** 조각 사전 안내 파일(index.json) — 어떤 앞부분 조각을 더 잘게 나눴는지 */
export interface DictionaryIndex {
  version: string;
  dictionaries: DictionaryInfo[];
  /** lookup: 변화형→표제어, fold: 자판 글자→실제 글자, 그 밖: 사전별 조각 */
  split: Record<"lookup" | "fold" | PlainDictionaryId, string[]>;
  /** DPD 표제어 조각 하나에 든 id 개수 (id ÷ 이 값 = 조각 번호) */
  dpdShardSize: number;
}

/**
 * DPD 표제어 하나. 글자 속 <b>·<i> 표시는 화면에서 parseInline 으로 안전하게 그린다.
 * 빈 항목은 빈 문자열이다.
 */
export interface DpdEntry {
  id: number;
  lemma: string;
  pos: string;
  /** 문법 (grammar + neg/verb/trans + plus_case) */
  grammar: string;
  meaning1: string;
  meaning2: string;
  meaningLit: string;
  /** 원래 앱의 요약 줄 [ ] 안에 들어가는 짧은 구성 */
  constructionSummary: string;
  construction: string;
  root: string;
  base: string;
  compound: string;
  derivative: string;
  antonym: string;
  synonym: string;
  variant: string;
  commentary: string;
  notes: string;
  sanskrit: string;
  examples: { text: string; source: string }[];
  hasInflections: boolean;
  /** 어형 변화표: 어간 + 변화 유형 (dpd-templates.json 의 표 틀) */
  stem?: string;
  pattern?: string;
  /** DPD 가족 열쇠 — 어근 가족("√mant|ā √mant")·낱말 가족·합성어 가족·숙어·같은 묶음 */
  fam?: DpdFamilyKeys;
}

export type DpdFamilyKind = "root" | "word" | "compound" | "idiom" | "set";
export interface DpdFamilyKeys {
  root?: string;
  word?: string;
  compound?: string[];
  idiom?: string[];
  set?: string[];
}
/** 가족 하나: 머리(어근 뜻 등)와 낱말들 [번호, 표제어, 품사, 뜻] */
export interface DpdFamily {
  head?: string;
  words: [number, string, string, string][];
}
/** 빈도: CST·BJT·SYA·MST(수따센트럴) 판본별 칸 숫자, h = 제목 */
export interface DpdFrequency {
  c: number[];
  b?: number[];
  s?: number[];
  m?: number[];
  h: string;
}
/** 빈도표 한 줄 — 큰 묶음 줄(group) 또는 책 줄(label + 칸들) */
export interface DpdFreqRow {
  group?: string;
  groupSpan?: number;
  label?: string;
  /** gap = 판본 사이 틈, void = 빈 칸 (그 책에는 이 층이 없음) */
  cells: ({ src: "c" | "b" | "s" | "m"; i: number; rs: number } | { gap: true } | { void: true })[];
}

/** DPD 변화 유형별 표 틀: rows[줄][칸] = 어미들. 0번 줄은 머리, 0번 칸은 줄 이름, 홀수 칸이 어미, 짝수 칸은 문법 이름 */
export interface DpdTemplate {
  like: string;
  rows: string[][][];
}

/** PTS·미얀마 사전의 표제어 하나 (같은 표제어의 뜻 여러 개) */
export interface PlainEntry {
  headword: string;
  definitions: string[];
}
