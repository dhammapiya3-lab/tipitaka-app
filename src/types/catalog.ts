/** 경전 목록의 경 하나 */
export interface CatalogSutta {
  /** 주소에 쓰는 번호 (예: dn22, sn1.1) */
  id: string;
  /** 원래 앱 자료의 번호 (예: dn.22) */
  sourceId: string;
  name: string;
  nameKo: string | null;
  /** 본문이 있는 판본 id. 비어 있으면 "준비 중" */
  editions: string[];
  /** 번역자 각주가 있는 판본 id */
  noteEditions: string[];
  /** 대역이 있는 판본 id */
  nissaya: string[];
  /** 문법분석이 있는 판본 id */
  grammar: string[];
  /** 이어 붙인 주석서(attha)·복주석서(tika). 없으면 비워 둔다 */
  commentary?: CommentaryLayer[];
}

/** 경에 이어 붙인 풀이 문헌: 주석서(Aṭṭhakathā) · 복주석서(Ṭīkā) */
export type CommentaryLayer = "attha" | "tika";

/**
 * 경 읽기 화면이 쓰는 가벼운 목록 (public/data/sutta-index.json).
 * 경 화면은 페이지 하나(/sutta/?id=…)가 이 목록에서 경을 찾아 그린다 — 경마다 페이지를 미리 만들면
 * 파일 수가 호스팅 한도(Cloudflare 2만 개)를 넘기 때문이다. 본문이 있는 경만, 목록 순서대로.
 */
export interface SuttaIndexEntry extends CatalogSutta {
  /** VRI 본문(t)·주석(c) 이 든 묶음 파일 번호 (public/data/vri/t-<n>.json, c-<n>.json) */
  vri?: { t: number; c: number | null };
  /** 니까야 id (dn·mn·sn·an·kn) — 이전·다음 경은 같은 니까야 안에서 */
  nikaya: string;
  /** 경 화면 위 위치 줄: 니까야 이름과 그 아래 묶음들 (품·상윳따 …) */
  trail: {
    nikayaName: string;
    groups: { id: string; label: string }[];
    /** 니까야 목록이 묶음별 페이지로 나뉘면 맨 아래 묶음에 링크를 건다 */
    groupPages: boolean;
  };
}

/** 품·상윳따·책처럼 경을 묶는 단위. 니까야마다 깊이가 다르다. */
export interface CatalogNode {
  id: string;
  name: string | null;
  nameKo: string | null;
  description: string | null;
  range: string | null;
  children: CatalogNode[];
  suttas: CatalogSutta[];
}

export interface Nikaya {
  id: string;
  name: string;
  nameKo: string;
  /** 한 줄 설명 (긴 경전 모음 …) */
  description: string | null;
  /** ⓘ 단추로 여는 소개 글 */
  introduction: string | null;
  nodes: CatalogNode[];
}

export interface Catalog {
  nikayas: Nikaya[];
}
