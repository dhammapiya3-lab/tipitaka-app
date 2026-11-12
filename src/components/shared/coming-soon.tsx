import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card } from "@/components/ui/card";

/** 아직 내용이 없는 메뉴(서적·실천·예불) — 자리만 먼저 만들어 둔다 */
export function ComingSoon({
  title,
  description,
  icon,
  note,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  note: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState icon={icon} title="준비 중입니다" description={note} />
      </Card>
    </div>
  );
}
