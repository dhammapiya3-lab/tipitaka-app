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
  nodes: CatalogNode[];
}

export interface Catalog {
  nikayas: Nikaya[];
}
