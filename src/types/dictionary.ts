/** 사전 하나의 표시 정보 */
export interface DictionaryInfo {
  id: DictionaryId;
  label: string;
  /** 이용 조건. 모르면 null ("확인 중") */
  license: string | null;
  source: string;
}

/** 표제어 → 뜻풀이 글만 있는 사전 (K-PTS 한국어 · PTS 영어 · 미얀마) */
export type PlainDictionaryId = "kpts" | "pts" | "mm";
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
