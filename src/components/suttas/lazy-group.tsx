"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SuttaRow, type SuttaRowData } from "@/components/suttas/sutta-row";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSuttaIndex } from "@/lib/content";
import { cn } from "@/lib/utils";

/**
 * 경이 많은 니까야(상윳따·앙굿따라·쿳다까)의 맨 아래 묶음 — 펼칠 때 경 목록을 불러온다.
 * 경 수천 개를 처음부터 다 실으면 목록 페이지가 무거워지기 때문 (MASTER-PLAN.md 파일 수·무게).
 */
export function LazyGroup({
  nikaya,
  groupId,
  header,
  nested,
  className,
}: {
  nikaya: string;
  groupId: string;
  header: ReactNode;
  /** 위 묶음 안에 들어 있으면 원래 앱처럼 왼쪽을 조금 들인다 */
  nested: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [suttas, setSuttas] = useState<SuttaRowData[] | "error" | null>(null);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && suttas === null) {
      fetchSuttaIndex()
        .then((index) =>
          setSuttas(
            index.filter(
              (s) =>
                s.nikaya === nikaya && s.trail.groups.at(-1)?.id === groupId,
            ),
          ),
        )
        .catch(() => setSuttas("error"));
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className={cn(
          "block rounded-2xl border bg-card p-4 text-left shadow-sm transition-shadow outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50",
          nested ? "ml-4 w-[calc(100%-1rem)]" : "w-full",
        )}
      >
        <div className="flex items-center gap-3">
          {header}
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-faint transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </div>
      </button>
      {open ? (
        <div className={cn("mt-2 flex flex-col gap-2", nested && "ml-4")}>
          {suttas === null ? (
            <>
              <Skeleton className="ml-4 h-12 rounded-2xl" />
              <Skeleton className="ml-4 h-12 rounded-2xl" />
            </>
          ) : suttas === "error" ? (
            <p className="ml-4 text-sm text-muted-foreground">
              목록을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.
            </p>
          ) : (
            suttas.map((s) => <SuttaRow key={s.id} sutta={s} />)
          )}
        </div>
      ) : null}
    </div>
  );
}
