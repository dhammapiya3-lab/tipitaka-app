import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatCount } from "@/lib/format";
import type { Nikaya } from "@/types";

export interface NikayaSummary {
  nikaya: Nikaya;
  total: number;
  readable: number;
}

/** 5부 니까야 카드 — 경전 목록과 홈이 같이 쓴다. */
export function NikayaCards({ items }: { items: NikayaSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(({ nikaya, total, readable }) => (
        <Link
          key={nikaya.id}
          href={`/suttas/${nikaya.id}`}
          className="group flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-xs outline-none transition-colors hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-bold text-brand-ink">
            {nikaya.id.toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="t-card">{nikaya.nameKo}</span>
            <span lang="pi" className="t-sub">
              {nikaya.name}
            </span>
            <span className="t-meta mt-1">
              {formatCount(total)}경 · 읽기 {formatCount(readable)}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      ))}
    </div>
  );
}
