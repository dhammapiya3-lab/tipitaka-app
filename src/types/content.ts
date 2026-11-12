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

/**
 * 경 읽기 오른쪽 칸의 덧붙임 자료 — 참고 경전 · 해설 법문 · 기타 자료.
 * 원본은 content/extras.json (경 번호 → 자료), `pnpm build:content` 가 검사해 public/data/extras.json 으로 옮긴다.
 */
export interface ExtraItem {
  /** 보이는 제목 */
  title: string;
  /** 한두 줄 설명 (누가·어디서·왜 함께 보면 좋은지) */
  note?: string | null;
  /** 이 사이트 안의 경 번호 (예: sn22.59) — 있으면 그 경으로 간다 */
  suttaId?: string | null;
  /** 밖의 주소 (영상·음성·글) */
  url?: string | null;
  /** 법문하신 분·글쓴이 */
  by?: string | null;
}

export type ExtraKind = "refs" | "talks" | "others";

export type SuttaExtras = Partial<Record<ExtraKind, ExtraItem[]>>;

/**
 * 경 하나에 이어진 주석서·복주석서 (VRI 6차 결집본, E-Piṭaka 의 문단 연결로 이음).
 * 원본은 content/vri/<경>.json (`pnpm import:vri`), `pnpm build:content` 가 public/data/suttas/<경>/<attha|tika>.json 으로 옮긴다.
 */
export interface SuttaCommentary {
  suttaId: string;
  layer: "attha" | "tika";
  /** E-Piṭaka 책 약어 (예: Spk-v) */
  book: string;
  /** 책 이름 (예: Mahāvagga-aṭṭhakathā) */
  bookName: string;
  /** 한국어 번역 파일에 적은 책 제목·한국어 이름 (예: Sāratthappakāsinī · 상윳따 대품 주석서) */
  title: string | null;
  nameKo: string | null;
  paras: {
    /** 책 안의 문단 번호 (예: 882) */
    para: number;
    /** VRI 문단 번호 (있으면) */
    vripara: string | null;
    /** 이 문단이 풀이하는 경의 문단 (예: sn56.11:2) */
    refs: string[];
    lines: InlinePart[][];
    /** 줄마다 풀이하는 경 문단 */
    lineRefs: string[][];
    /** 줄마다 한국어 번역 (없으면 null) */
    ko: (InlinePart[] | null)[];
  }[];
}

/**
 * 판본 정보 창의 소개 글 (원래 앱의 translator_info/<판본>.txt).
 * `pnpm build:content` 가 public/data/edition-info/<판본>.json 으로 옮긴다.
 * 대역·문법분석 소개가 따로 있으면 묶음(group)을 하나 더 둔다.
 */
export interface EditionInfo {
  editionId: string;
  groups: {
    /** 본문(text) · 대역(nissaya) · 문법분석(grammar) 소개 */
    kind: "text" | AnalysisKind;
    sections: { title: string; paragraphs: InlinePart[][] }[];
  }[];
}
