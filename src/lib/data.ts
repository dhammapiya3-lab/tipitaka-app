/**
 * 빌드 때 읽는 목록 자료의 유일한 진입점 (서버 컴포넌트 전용).
 * src/data/*.json 은 `pnpm build:content` 가 만든다.
 */
import catalogJson from "@/data/catalog.json";
import editionsJson from "@/data/editions.json";
import { INLINE_SUTTA_LIMIT } from "@/lib/constants";
import { catalogSchema, editionsSchema } from "@/lib/schemas";
import type { CatalogNode, CatalogSutta, Edition, Nikaya } from "@/types";

export const catalog = catalogSchema.parse(catalogJson);
export const editions: Edition[] = editionsSchema.parse(editionsJson);

/** 묶음 안의 모든 경 (하위 묶음 포함) */
export function collect(node: CatalogNode): CatalogSutta[] {
  return [...node.suttas, ...node.children.flatMap(collect)];
}

export function getNikaya(id: string): Nikaya | undefined {
  return catalog.nikayas.find((n) => n.id === id);
}

/** 목록을 묶음별 페이지로 나누는 니까야인지 */
export function splitsIntoGroups(nikaya: Nikaya): boolean {
  return nikaya.nodes.flatMap(collect).length > INLINE_SUTTA_LIMIT;
}

/** 경을 직접 담은 묶음(맨 아래 묶음)과 그 위 묶음들 */
export function getLeafGroups(
  nikaya: Nikaya,
): { node: CatalogNode; parents: CatalogNode[] }[] {
  const walk = (
    node: CatalogNode,
    parents: CatalogNode[],
  ): { node: CatalogNode; parents: CatalogNode[] }[] =>
    node.suttas.length > 0
      ? [{ node, parents }]
      : node.children.flatMap((child) => walk(child, [...parents, node]));
  return nikaya.nodes.flatMap((node) => walk(node, []));
}

/** 경전 목록 카드 오른쪽의 범위 (원래 앱과 같다): 디가·맛지마는 경 번호, 상윳따는 상윳따 번호, 앙굿따라는 법수 */
function nikayaRange(n: Nikaya, total: number): string | null {
  if (n.id === "dn" || n.id === "mn") return `1–${total}`;
  if (n.id === "sn") return `1–${n.nodes.flatMap((v) => v.children).length}`;
  if (n.id === "an") return `1–${n.nodes.length}`;
  return null;
}

/** 니까야별 경 수와 본문이 있는 경 수 */
/** 5부 니까야만 (주석 문헌인 청정도론은 경전 화면의 "주석 문헌"에 따로) */
const NIKAYA_IDS = new Set(["dn", "mn", "sn", "an", "kn"]);

export function getNikayaSummaries() {
  return catalog.nikayas
    .filter((n) => NIKAYA_IDS.has(n.id))
    .map((n) => {
      const suttas = n.nodes.flatMap(collect);
      return {
        nikaya: n,
        total: suttas.length,
        readable: suttas.filter((s) => s.editions.length > 0).length,
        range: nikayaRange(n, suttas.length),
      };
    });
}

/** 목록 순서대로 모든 경 */
export const allSuttas: CatalogSutta[] = catalog.nikayas.flatMap((n) =>
  n.nodes.flatMap(collect),
);

const suttaById = new Map(allSuttas.map((s) => [s.id, s]));
const editionById = new Map(editions.map((e) => [e.id, e]));

export function getSutta(id: string): CatalogSutta | undefined {
  return suttaById.get(id);
}

/** 본문이 있는 법구경 품 (dhp1-20 → 1~20번 게송) — 오늘의 게송용 */
export function getDhpVaggas(): { id: string; from: number; to: number }[] {
  return getReadableSuttas().flatMap((s) => {
    const m = s.id.match(/^dhp(\d+)-(\d+)$/);
    return m ? [{ id: s.id, from: Number(m[1]), to: Number(m[2]) }] : [];
  });
}

/** 본문이 있는 경 — 정적 빌드로 주소를 만드는 대상 */
export function getReadableSuttas(): CatalogSutta[] {
  return allSuttas.filter((s) => s.editions.length > 0);
}

export function getEdition(id: string): Edition | undefined {
  return editionById.get(id);
}

const nikayaBySutta = new Map(
  catalog.nikayas.flatMap((n) =>
    n.nodes.flatMap(collect).map((s) => [s.id, n.id] as const),
  ),
);

/** 같은 니까야 안에서 본문이 있는 앞·뒤 경 (본문 없는 경은 건너뛴다) */
export function getAdjacentSuttas(id: string): {
  prev: CatalogSutta | null;
  next: CatalogSutta | null;
} {
  const nikaya = nikayaBySutta.get(id);
  const list = getReadableSuttas().filter(
    (s) => nikayaBySutta.get(s.id) === nikaya,
  );
  const i = list.findIndex((s) => s.id === id);
  return { prev: list[i - 1] ?? null, next: list[i + 1] ?? null };
}

/** 한국어 번역 판본이 있는지 */
export function hasKorean(s: CatalogSutta): boolean {
  return s.editions.some((id) => editionById.get(id)?.language === "ko");
}

/** 니까야 하나에서 한국어 번역이 있는 경 (목록 순서대로) */
export function getKoreanSuttas(nikayaId: string): CatalogSutta[] {
  const nikaya = getNikaya(nikayaId);
  return nikaya ? nikaya.nodes.flatMap(collect).filter(hasKorean) : [];
}

/** 홈의 "지금 읽을 수 있는 경" — 니까야별 한국어 번역 경 수 */
export function getKoreanSummaries(): { nikaya: Nikaya; count: number }[] {
  return catalog.nikayas
    .filter((n) => NIKAYA_IDS.has(n.id))
    .map((n) => ({ nikaya: n, count: getKoreanSuttas(n.id).length }));
}

/** 이 경의 한국어 번역 판본 수 */
export function koreanEditionCount(s: CatalogSutta): number {
  return s.editions.filter((id) => editionById.get(id)?.language === "ko")
    .length;
}

/**
 * 니까야의 한국어 번역 경을 책·묶음별로 — 상윳따는 상윳따(둘째 단계), 나머지는 맨 위 묶음
 * (디가·맛지마의 품, 앙굿따라의 법수, 쿳다까의 책: 담마빠다·숫따니빠따 …)
 */
export function getKoreanGroups(
  nikayaId: string,
): {
  id: string;
  label: string;
  pali: string | null;
  suttas: CatalogSutta[];
}[] {
  const nikaya = getNikaya(nikayaId);
  if (!nikaya) return [];
  const groupNodes =
    nikaya.id === "sn" ? nikaya.nodes.flatMap((n) => n.children) : nikaya.nodes;
  return groupNodes
    .map((node) => ({
      id: node.id,
      label: node.nameKo ?? node.name ?? node.id,
      pali: node.name,
      suttas: collect(node).filter(hasKorean),
    }))
    .filter((g) => g.suttas.length > 0);
}
