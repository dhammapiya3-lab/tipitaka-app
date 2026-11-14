import type { Metadata } from "next";
import { Suspense } from "react";
import { TopLevelPage } from "@/components/layout/page-header";
import { SearchView } from "@/components/search/search-view";
import { editions, getReadableSuttas } from "@/lib/data";
import { suttaLabel } from "@/lib/format";

export const metadata: Metadata = { title: "검색" };

export default function SearchPage() {
  const suttas = getReadableSuttas().map((s) => ({
    id: s.id,
    title: s.nameKo ?? s.name,
    name: s.name,
    label: suttaLabel(s.id),
  }));

  return (
    <TopLevelPage
      title="검색"
      description="읽을 수 있는 경의 원문과 번역에서 찾습니다."
    >
      {/* 찾는 말(?q=)은 브라우저에서 읽으므로 정적 빌드에서는 Suspense 로 감싼다 */}
      <Suspense>
        <SearchView suttas={suttas} editions={editions} />
      </Suspense>
    </TopLevelPage>
  );
}
