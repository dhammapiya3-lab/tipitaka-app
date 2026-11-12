import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** 빈 상태 — 아이콘 + 한 줄 제목 + 한 줄 안내 + (있으면) 행동 버튼 하나 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="font-semibold">{title}</p>
      {description ? <p className="t-sub max-w-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
