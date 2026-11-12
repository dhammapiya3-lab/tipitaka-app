import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Nikaya } from "@/types";

export interface NikayaSummary {
  nikaya: Nikaya;
  total: number;
  readable: number;
  /** 오른쪽 호박색 범위 표시 (1–34 …) */
  range: string | null;
}

/** 원래 앱의 목록 카드 — 동그란 호박색 표시 + 이름 + 빠알리 이름 + 한 줄 설명 + 범위 */
export function ListCard({
  badge,
  title,
  pali,
  description,
  range,
  href,
  trailing,
  small = false,
  className,
}: {
  badge: ReactNode;
  title: ReactNode;
  pali?: string | null;
  description?: ReactNode;
  range?: string | null;
  href?: string;
  trailing?: ReactNode;
  small?: boolean;
  className?: string;
}) {
  const body = (
    <div className="flex items-center gap-3">
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ${small ? "size-10 text-xs" : "size-12 text-sm"} font-bold`}
      >
        {badge}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-baseline gap-x-1.5">
          <h3 className="text-base font-bold">{title}</h3>
          {pali ? (
            <span lang="pi" className="text-xs text-faint">
              {pali}
            </span>
          ) : null}
        </div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {range ? <span className="text-sm font-bold text-primary">{range}</span> : null}
        {trailing ?? <ChevronRight className="size-5 text-faint" aria-hidden />}
      </div>
    </div>
  );
  const cls = `block rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${className ?? ""}`;
  return href ? (
    <Link href={href} className={`${cls} outline-none focus-visible:ring-3 focus-visible:ring-ring/50`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** 5부 니까야 카드 */
export function NikayaCards({ items }: { items: NikayaSummary[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map(({ nikaya, range }) => (
        <ListCard
          key={nikaya.id}
          href={`/suttas/${nikaya.id}`}
          badge={nikaya.id.toUpperCase()}
          title={nikaya.nameKo}
          pali={nikaya.name}
          description={nikaya.description}
          range={range}
        />
      ))}
    </div>
  );
}
