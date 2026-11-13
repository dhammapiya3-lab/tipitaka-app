"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { suttaHref, suttaLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SuttaLink {
  id: string;
  title: string;
}

const card =
  "group flex min-w-0 flex-1 flex-col gap-1 rounded-2xl border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-hover";

/** 경 맨 아래: 이전 경 · 다음 경 (제목까지 보이는 큰 단추) */
export function SuttaEndNav({
  prev,
  next,
}: {
  prev: SuttaLink | null;
  next: SuttaLink | null;
}) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="이전 경 · 다음 경" className="flex gap-3 print:hidden">
      {prev ? (
        <Link href={suttaHref(prev.id)} className={card}>
          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
            <ChevronLeft className="size-4" aria-hidden />
            이전 경 읽기
          </span>
          <span className="truncate text-sm">
            <span className="mr-1.5 text-xs text-faint">
              {suttaLabel(prev.id)}
            </span>
            {prev.title}
          </span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
      {next ? (
        <Link
          href={suttaHref(next.id)}
          className={cn(card, "items-end text-right")}
        >
          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
            다음 경 읽기
            <ChevronRight className="size-4" aria-hidden />
          </span>
          <span className="max-w-full truncate text-sm">
            <span className="mr-1.5 text-xs text-faint">
              {suttaLabel(next.id)}
            </span>
            {next.title}
          </span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  );
}
