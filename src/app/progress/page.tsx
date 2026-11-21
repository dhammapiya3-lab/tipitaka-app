import type { Metadata } from "next";
import { TopLevelPage } from "@/components/layout/page-header";
import {
  ProgressView,
  type ProgressNikaya,
} from "@/components/progress/progress-view";
import { catalog, collect, getLeafGroups, hasKorean } from "@/lib/data";
import type { CatalogNode } from "@/types";

export const metadata: Metadata = { title: "읽기 진도표" };

/** 5부 니까야만 (경전 화면의 니까야 카드와 같다) */
const NIKAYA_IDS = new Set(["dn", "mn", "sn", "an", "kn"]);

const nodeName = (n: CatalogNode) => n.nameKo ?? n.name ?? n.id;

/** 니까야 → 맨 위 묶음(품·법수·책) → 맨 아래 묶음 → 본문이 있는 경 */
function progressData(): ProgressNikaya[] {
  return catalog.nikayas
    .filter((n) => NIKAYA_IDS.has(n.id))
    .map((n) => ({
      id: n.id,
      name: n.nameKo,
      groups: n.nodes
        .filter((top) => collect(top).some((s) => s.editions.length > 0))
        .map((top) => ({
          name: nodeName(top),
          leaves: getLeafGroups({ ...n, nodes: [top] })
            .map(({ node }) => ({
              name: nodeName(node),
              suttas: node.suttas
                .filter((s) => s.editions.length > 0)
                .map((s) => [s.id, hasKorean(s)] as [string, boolean]),
            }))
            .filter((leaf) => leaf.suttas.length > 0),
        })),
    }));
}

export default function ProgressPage() {
  return (
    <TopLevelPage
      title="읽기 진도표"
      description="다 읽은 경은 호박색 칸으로 보입니다. 칸을 누르면 그 경으로 갑니다."
    >
      <ProgressView nikayas={progressData()} />
    </TopLevelPage>
  );
}
