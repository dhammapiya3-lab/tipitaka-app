"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";
import { HIDE_WHEN_ONLY_READABLE } from "@/lib/constants";
import { suttaHref, suttaLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Edition } from "@/types";

const EditionsContext = createContext<Edition[]>([]);

/** 경 줄마다 판본 이름을 보여 주려고, 판본 목록을 한 번만 내려 준다 */
export function EditionsProvider({ editions, children }: { editions: Edition[]; children: ReactNode }) {
  return <EditionsContext.Provider value={editions}>{children}</EditionsContext.Provider>;
}

export interface SuttaRowData {
  id: string;
  name: string;
  nameKo: string | null;
  editions: string[];
}

/** 판본 배지 바탕색 — 한국어는 호박색, 빠알리는 짙은 회색, 영어는 청록색 (빠알리와 헷갈리지 않게) */
export function editionBadgeClass(e: Pick<Edition, "language">): string {
  if (e.language === "ko") return "bg-primary";
  if (e.language === "pli") return "bg-gray-600";
  return "bg-teal-700";
}

/** 판본 순서: 한국어 → 빠알리 → 영어 (원래 앱의 경 목록·판본 선택과 같다) */
export function orderEditions<T extends Pick<Edition, "language">>(list: T[]): T[] {
  const rank = { ko: 0, pli: 1, en: 2 } as const;
  return [...list].sort((a, b) => rank[a.language] - rank[b.language]);
}

/**
 * 경 한 줄 — 원래 앱과 같다. 줄을 누르면 경을 열고, 오른쪽 ⌄ 를 누르면 판본 목록이 펼쳐져
 * 판본 하나를 골라 열 수 있다.
 */
export function SuttaRow({ sutta, nested = true }: { sutta: SuttaRowData; nested?: boolean }) {
  const all = useContext(EditionsContext);
  const [open, setOpen] = useState(false);
  const readable = sutta.editions.length > 0;
  const editions = orderEditions(all.filter((e) => sutta.editions.includes(e.id)));
  const korean = editions.some((e) => e.language === "ko");

  const title = (
    <div className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="shrink-0 text-xs font-bold text-primary">{suttaLabel(sutta.id)}</span>
      {sutta.nameKo ? <h4 className="text-sm font-bold">{sutta.nameKo}</h4> : null}
      <span lang="pi" className="text-xs text-faint">
        {sutta.name}
      </span>
    </div>
  );

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md",
        nested && "ml-4",
        // "한글 번역이 있는 경만 보기"를 켜면 한글 번역이 없는 경은 가린다
        !korean && HIDE_WHEN_ONLY_READABLE,
      )}
    >
      <div className="flex items-center gap-3 p-3.5">
        {readable ? (
          <Link href={suttaHref(sutta.id)} className="min-w-0 flex-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            {title}
          </Link>
        ) : (
          <div className="min-w-0 flex-1 opacity-60">{title}</div>
        )}
        {readable ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "판본 목록 닫기" : "판본 목록 열기"}
            onClick={() => setOpen((v) => !v)}
            className="-m-1 shrink-0 rounded-full p-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronDown className={cn("size-4 text-faint transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        ) : (
          <span className="shrink-0 text-xs text-faint">준비 중</span>
        )}
      </div>
      {open ? (
        <div className="border-t border-gray-100 px-3.5 pt-2 pb-3 dark:border-border">
          <div className="flex flex-col gap-1.5">
            {editions.map((e) => (
              <Link
                key={e.id}
                href={`/sutta/?id=${encodeURIComponent(sutta.id)}&ed=${encodeURIComponent(e.id)}`}
                className="flex items-center gap-2 rounded-lg border border-transparent bg-gray-50 px-3 py-2 transition-colors hover:border-amber-200 hover:bg-amber-50 dark:bg-muted"
              >
                <span
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                    editionBadgeClass(e),
                  )}
                >
                  {e.badge})
                </span>
                <span className="text-sm font-medium text-secondary-foreground">{e.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
