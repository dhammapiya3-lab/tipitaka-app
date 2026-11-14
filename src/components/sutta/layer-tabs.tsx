"use client";

import { startTransition, useOptimistic } from "react";
import type { CommentaryLayer } from "@/types";
import { cn } from "@/lib/utils";

export type Layer = "sutta" | CommentaryLayer;

export interface LayerTabsState {
  /** 경 · 주석서 · 복주석서 (하나만 볼 때) */
  layer: Layer;
  /** 주석 나란히 보기 중인가 */
  parallel: boolean;
  /** 나란히 볼 칸 */
  cols: Layer[];
  /** 주석 낱말 밑줄이 보이는가 (켜져 있고 빠알리 원문이 보일 때) */
  wordLinks: boolean;
}

const LABELS: [Layer, string][] = [
  ["sutta", "경"],
  ["attha", "주석서"],
  ["tika", "복주석서"],
];

/**
 * 경 · 주석서 · 복주석서 · 주석 낱말 · 주석 나란히 보기 단추 줄.
 * 누르면 이 단추 줄만 곧바로 바뀌고(useOptimistic), 긴 경의 본문은 뒤에서 다시 그린다(startTransition)
 * — 대념처경처럼 긴 경에서 단추가 늦게 바뀌고, 그사이 다시 누르면 안 눌린 것처럼 보이던 것.
 */
export function LayerTabs({
  state,
  commentary,
  commentaryOnly = false,
  isDesktop,
  className,
  onChange,
}: {
  state: LayerTabsState;
  /** 이 경에 있는 주석 층 */
  commentary: CommentaryLayer[];
  /** 주석 문헌(청정도론) — 본문 칸 단추를 '주석서'로 부르고, 따로 없는 주석서 칸 단추는 뺀다 */
  commentaryOnly?: boolean;
  isDesktop: boolean;
  className?: string;
  /** 바뀐 뒤의 상태 (화면 전체에 반영하는 일은 부모가 한다) */
  onChange: (next: LayerTabsState) => void;
}) {
  const [shown, setShown] = useOptimistic(state);
  const act = (next: LayerTabsState) =>
    startTransition(() => {
      setShown(next);
      onChange(next);
    });
  /** 나란히 보기의 칸 켜고 끄기 — 한 칸만 남으면 나란히 보기를 끝내고 그 칸 하나를 본다 */
  const toggleCol = (c: Layer): LayerTabsState => {
    if (!shown.cols.includes(c)) return { ...shown, cols: [...shown.cols, c] };
    const left = shown.cols.filter(
      (x) => x !== c && (x === "sutta" || commentary.includes(x)),
    );
    if (left.length >= 2)
      return { ...shown, cols: shown.cols.filter((x) => x !== c) };
    return { ...shown, parallel: false, layer: left[0] ?? "sutta" };
  };
  const tabClass = (on: boolean) =>
    cn(
      "flex-1 rounded-lg py-2 text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      on
        ? "bg-primary text-primary-foreground"
        : "border bg-card text-muted-foreground",
    );
  return (
    <div className={className} role="tablist" aria-label="본문 종류">
      {LABELS.filter(([id]) => !commentaryOnly || id !== "sutta").map(
        ([id, label]) =>
          shown.parallel ? (
            // 나란히 보기에서는 탭이 칸 고르기가 된다 (둘 이상)
            <button
              key={id}
              type="button"
              aria-pressed={shown.cols.includes(id)}
              disabled={id !== "sutta" && !commentary.includes(id)}
              title={`${label} 칸 ${shown.cols.includes(id) ? "끄기" : "켜기"}`}
              onClick={() => act(toggleCol(id))}
              className={cn(
                tabClass(shown.cols.includes(id)),
                "disabled:opacity-40",
              )}
            >
              {shown.cols.includes(id) ? "✓ " : ""}
              {label}
            </button>
          ) : (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={shown.layer === id}
              onClick={() => act({ ...shown, layer: id })}
              className={tabClass(shown.layer === id)}
            >
              {label}
            </button>
          ),
      )}
      {isDesktop && commentary.length > 0 ? (
        <button
          type="button"
          aria-pressed={shown.wordLinks}
          onClick={() => act({ ...shown, wordLinks: !shown.wordLinks })}
          title="빠알리 원문에서 주석이 풀이한 낱말에 점선 밑줄 (누르면 그 풀이)"
          className={cn(
            "ml-auto shrink-0 rounded-xl border px-4 text-sm font-bold transition-colors",
            shown.wordLinks
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "bg-card text-muted-foreground hover:bg-gray-50",
          )}
        >
          {shown.wordLinks ? "✓ " : ""}
          주석 낱말
        </button>
      ) : null}
      {isDesktop && commentary.length > 0 ? (
        <button
          type="button"
          aria-pressed={shown.parallel}
          onClick={() =>
            act({ ...shown, layer: "sutta", parallel: !shown.parallel })
          }
          title="경 · 주석서 · 복주석서를 문단마다 나란히 봅니다"
          className={cn(
            "shrink-0 rounded-xl border px-4 text-sm font-bold transition-colors",
            shown.parallel
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "bg-card text-muted-foreground hover:bg-gray-50",
          )}
        >
          {shown.parallel ? "✓ " : ""}주석 나란히 보기
        </button>
      ) : null}
    </div>
  );
}
