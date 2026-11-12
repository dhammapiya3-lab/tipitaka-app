import type { Metadata } from "next";
import { BookmarksView } from "@/components/bookmarks/bookmarks-view";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "내 서재" };

export default function BookmarksPage() {
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
      <PageHeader title="내 서재" description="책갈피와 메모 — 이 기기의 브라우저에만 저장됩니다." />
      <BookmarksView />
    </div>
  );
}
