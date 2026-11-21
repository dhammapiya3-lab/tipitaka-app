"use client";

import { Check, CircleCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useReadStore } from "@/store/read";

/** 경 목록 줄의 동그라미 — 눌러서 다 읽음 표시·해제 */
export function ReadCheck({
  suttaId,
  label,
}: {
  suttaId: string;
  label: string;
}) {
  const at = useReadStore((s) => s.items[suttaId]);
  const toggle = useReadStore((s) => s.toggle);
  return (
    <button
      type="button"
      aria-pressed={Boolean(at)}
      aria-label={
        at ? `${label} 다 읽음 표시 지우기` : `${label} 다 읽음으로 표시`
      }
      title={
        at ? `다 읽음 · ${formatDate(at)} (누르면 지움)` : "다 읽음으로 표시"
      }
      onClick={() => toggle(suttaId)}
      className={cn(
        "-m-1 flex size-7 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full transition-colors",
          at
            ? "bg-primary text-primary-foreground"
            : "border border-gray-300 text-transparent hover:border-primary dark:border-border",
        )}
      >
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
      </span>
    </button>
  );
}

/** 경 본문 맨 끝의 큰 단추 — [다 읽음으로 표시] ↔ [다 읽음 · 날짜] */
export function ReadMarkButton({ suttaId }: { suttaId: string }) {
  const at = useReadStore((s) => s.items[suttaId]);
  const toggle = useReadStore((s) => s.toggle);
  return (
    <div className="flex flex-col items-center gap-1.5 print:hidden">
      <button
        type="button"
        aria-pressed={Boolean(at)}
        onClick={() => toggle(suttaId)}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          at
            ? "border-primary bg-primary text-primary-foreground"
            : "border-primary bg-card text-primary hover:bg-amber-50 dark:hover:bg-muted",
        )}
      >
        {at ? (
          <Check className="size-4" aria-hidden />
        ) : (
          <CircleCheck className="size-4" aria-hidden />
        )}
        {at ? `다 읽음 · ${formatDate(at)}` : "다 읽음으로 표시"}
      </button>
      {at ? (
        <span className="text-xs text-faint">다시 누르면 표시를 지웁니다</span>
      ) : null}
    </div>
  );
}
