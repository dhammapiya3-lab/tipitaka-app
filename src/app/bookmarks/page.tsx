import type { Metadata } from "next";
import { BookmarksView } from "@/components/bookmarks/bookmarks-view";
import { TopLevelPage } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "내 서재" };

export default function BookmarksPage() {
  return (
    <TopLevelPage title="내 서재" description="책갈피와 메모 — 이 기기의 브라우저에만 저장됩니다.">
      <BookmarksView />
    </TopLevelPage>
  );
}
