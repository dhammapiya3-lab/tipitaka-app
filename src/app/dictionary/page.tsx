import type { Metadata } from "next";
import { Suspense } from "react";
import { DictionaryView } from "@/components/dictionary/dictionary-view";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "사전" };

export default function DictionaryPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="사전" description="DPD · PTS · Tipiṭaka 미얀마 사전" />
      {/* 찾는 단어(?q=)는 브라우저에서 읽으므로 정적 빌드에서는 Suspense 로 감싼다 */}
      <Suspense>
        <DictionaryView />
      </Suspense>
    </div>
  );
}
