"use client";

import { BookOpenCheck, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatDate, suttaHref } from "@/lib/format";
import { useReadingStore } from "@/store/reading";

/** 홈의 "이어 읽기" — 마지막으로 읽던 경과 문장으로 바로 간다. 읽은 적이 없으면 보이지 않는다. */
export function ContinueReading() {
  const last = useReadingStore((s) => s.last);
  if (!last) return null;
  return (
    <Link
      href={suttaHref(last.suttaId, last.key)}
      className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-card ring-1 ring-foreground/5 outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
        <BookOpenCheck className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="t-meta">이어 읽기 · {formatDate(last.at)}</span>
        <span className="truncate font-semibold">{last.suttaTitle}</span>
      </span>
      <span className="t-meta shrink-0">{last.key.slice(last.key.indexOf(":") + 1)}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
