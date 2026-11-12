export type Language = "pli" | "ko" | "en";

/** 판본 — 빠알리 원문 또는 번역 하나 */
export interface Edition {
  id: string;
  label: string;
  /** 휴대폰처럼 좁은 화면의 판본 칩에 쓰는 짧은 표시 (원래 앱의 badge, 예: M · 김 · S) */
  badge: string;
  language: Language;
  translator: string | null;
  /** 이용 조건. 모르면 null ("확인 중"으로 표시) */
  license: string | null;
  /** 원래 앱이 복사를 막은 판본이면 false (화면에서 글자 선택을 막는다) */
  allowCopy: boolean;
}

/**
 * 문장 안의 글자 조각. 원본의 HTML 태그를 화면에서 해석하지 않도록
 * 변환 단계에서 이 형식으로 바꾼다.
 */
export type InlinePart =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "em"; text: string }
  | { type: "note"; mark: string };

/** 문장 하나. key 는 `dn22:1.2` 형식의 문장 번호 */
export interface Segment {
  key: string;
  parts: InlinePart[];
}

/** 경 하나의 한 판본 본문 */
export interface SuttaText {
  suttaId: string;
  editionId: string;
  segments: Segment[];
}

/** 번역자 각주 하나. mark 는 본문의 각주 번호(예: "42") */
export interface Footnote {
  mark: string;
  key: string;
  parts: InlinePart[];
}

/**
 * 대역(nissaya) — 빠알리 단어를 차례로 풀어 쓴 번역. 한 칸은 "빠알리: 뜻" 줄들(줄바꿈으로 나뉨).
 * 판본에 따라 문장마다 또는 게송 첫 줄에 게송 전체가 들어 있다.
 */
/**
 * 문법분석도 대역과 같은 모양이다 — 한 칸은 "단어: 원형. 품사·격·수. 뜻" 줄들.
 * 대역과 문법분석을 함께 "풀이(analysis)"라 부른다.
 */
export type AnalysisKind = "nissaya" | "grammar";

export interface SuttaNissaya {
  suttaId: string;
  editionId: string;
  entries: Record<string, string>;
}

export interface SuttaNotes {
  suttaId: string;
  editionId: string;
  notes: Footnote[];
}
