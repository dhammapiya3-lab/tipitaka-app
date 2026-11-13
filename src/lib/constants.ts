import type { DictionaryId } from "@/types";

/** 서비스 이름 — 사이드바·<title>·홈 제목이 전부 이 값을 쓴다. */
export const SERVICE_NAME = "초기불교경전";
/** 이름 아래 둘째 줄 (사이드바·홈). 빠알리 표기라 화면에서는 lang="pi" 로 그린다. */
export const SERVICE_TAGLINE = "Theravāda Tipiṭaka";

/** 빠알리 원문 판본 id */
export const PALI_EDITION = "pli-ms";
/** 처음 열 때 보여 줄 판본: 빠알리 원문 + 한국어 번역 하나 */
export const DEFAULT_EDITIONS = [PALI_EDITION, "kor-kimjaeseong-calmvoice"];

/** 처음 쓸 사전: DPD + K-PTS 한국어 (PTS·미얀마 사전은 사전 선택에서 켠다) */
export const DEFAULT_DICTIONARIES: DictionaryId[] = ["dpd", "kpts"];
export const DICTIONARY_ORDER: DictionaryId[] = ["dpd", "kpts", "pts", "peu", "mm"];
export const DICTIONARY_LABELS: Record<DictionaryId, string> = {
  dpd: "Digital Pāḷi Dictionary",
  kpts: "K-PTS 빠알리–한국어",
  pts: "PTS Pali–English",
  mm: "Tipiṭaka Pāḷi–Myanmar",
  peu: "Pali English Ultimate",
};

/** 본문 글자 크기(px) — 원래 앱과 같이 12~24, 처음 16 */
export const FONT_SIZES = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24] as const;
export const DEFAULT_FONT_SIZE = 16;
/** 줄 간격 — 원래 앱과 같이 1.25~2.5 (0.25씩), 처음 1.75 */
export const LINE_HEIGHTS = [1.25, 1.5, 1.75, 2, 2.25, 2.5] as const;
export const DEFAULT_LINE_HEIGHT = 1.75;

export const LANGUAGE_LABELS = { pli: "빠알리어", ko: "한국어", en: "영어" } as const;
/** 판본 칩에 붙이는 짧은 언어 표시 */
export const LANGUAGE_SHORT = { pli: "빠", ko: "한", en: "영" } as const;

/**
 * 경이 이보다 많은 니까야는 목록 한 페이지에 다 싣지 않고 묶음(상윳따·품)별 페이지로 나눈다.
 * (쿳다까 니까야를 한 페이지에 실으면 3MB 가 넘는다)
 */
export const INLINE_SUTTA_LIMIT = 200;

/**
 * 본문이 없는 경·묶음에 붙이는 class — 경전 목록의 "읽을 수 있는 경만 보기"(ReadableFilter)를 켜면 가려진다.
 * (서버 컴포넌트에서도 쓰므로 "use client" 파일이 아닌 여기에 둔다)
 */
export const HIDE_WHEN_ONLY_READABLE = "group-data-[only=true]/catalog:hidden";

/** 이용 조건을 모를 때 보여 주는 글자 */
export const LICENSE_UNKNOWN = "확인 중";
