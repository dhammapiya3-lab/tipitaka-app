import type { Metadata } from "next";
import { Suspense } from "react";
import { TopLevelPage } from "@/components/layout/page-header";
import { TopicsView } from "@/components/topics/topics-view";

export const metadata: Metadata = { title: "주제별 경전" };

export default function TopicsPage() {
  return (
    <TopLevelPage
      title="주제별 경전"
      description="Access to Insight 주제 색인으로 모아 보는 경전"
    >
      {/* 고른 주제(?t=)는 브라우저에서 읽으므로 정적 빌드에서는 Suspense 로 감싼다 */}
      <Suspense>
        <TopicsView />
      </Suspense>
    </TopLevelPage>
  );
}
