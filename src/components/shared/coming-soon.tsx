import type { LucideIcon } from "lucide-react";
import { Screen, SubBar } from "@/components/layout/app-bar";
import { TopLevelPage } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";

/** 아직 내용이 없는 메뉴 — 자리만 먼저 만들어 둔다. top: 아래 메뉴의 한 칸(서적·실천·예불)이면 호박색 띠 */
export function ComingSoon({
  title,
  description,
  icon,
  note,
  top = false,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  note: string;
  top?: boolean;
}) {
  const body = (
    <div className="rounded-2xl border bg-card shadow-sm">
      <EmptyState icon={icon} title="준비 중입니다" description={note} />
    </div>
  );
  if (top) {
    return (
      <TopLevelPage title={title} description={description}>
        {body}
      </TopLevelPage>
    );
  }
  return (
    <>
      <SubBar title={title} subtitle={description} backHref="/" />
      <Screen>{body}</Screen>
    </>
  );
}
