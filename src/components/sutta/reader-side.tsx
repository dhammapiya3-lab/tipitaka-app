"use client";

import { MousePointerClick } from "lucide-react";
import { WordPanelBody, type AnalysisEditions, type WordTarget } from "@/components/dictionary/word-sheet";
import type { TocEntry } from "@/components/sutta/reader-sheets";
import { cn } from "@/lib/utils";

/**
 * 넓은 화면 경 읽기의 오른쪽 칸 — 위아래로 내려도 그 자리에 붙어 있다.
 * 평소에는 이 경의 목차(지금 읽는 문단은 호박색), 문장·단어·배지를 누르면 같은 자리가 대역·문법분석·사전.
 */
export function ReaderSide({
  panel,
  onPanel,
  toc,
  current,
  onPick,
  word,
  suttaId,
  analysisEditions,
  onCloseWord,
}: {
  panel: "toc" | "analysis";
  onPanel: (panel: "toc" | "analysis") => void;
  toc: TocEntry[];
  current: string | null;
  onPick: (paragraph: string) => void;
  word: WordTarget | null;
  suttaId: string;
  analysisEditions: AnalysisEditions;
  onCloseWord: () => void;
}) {
  const tab = (id: "toc" | "analysis", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={panel === id}
      onClick={() => onPanel(id)}
      className={cn(
        "flex-1 rounded-lg py-2 text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        panel === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
  return (
    <aside
      aria-label="목차와 풀이"
      className="sticky top-4 flex h-[calc(100vh-2rem)] w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm print:hidden"
    >
      <div className="flex shrink-0 gap-1.5 p-3" role="tablist" aria-label="오른쪽 칸">
        {tab("toc", "목차")}
        {tab("analysis", "풀이")}
      </div>
      {panel === "toc" ? (
        <nav aria-label="목차" className="min-h-0 flex-1 overflow-y-auto pb-3">
          <p className="px-4 pb-2 text-xs text-faint">문단 {toc.length}개</p>
          {toc.map((item) => {
            const on = item.paragraph === current;
            return (
              <button
                key={item.paragraph}
                type="button"
                aria-current={on ? "location" : undefined}
                onClick={() => onPick(item.paragraph)}
                className={cn(
                  "flex w-full gap-2.5 border-l-2 px-3.5 py-2 text-left text-sm transition-colors outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50",
                  on ? "border-primary bg-brand-soft font-bold text-foreground" : "border-transparent text-secondary-foreground",
                )}
              >
                <span className={cn("w-9 shrink-0 font-pali", on ? "text-primary" : "text-faint")}>{item.label}</span>
                <span className="min-w-0 break-keep">{item.title ?? ""}</span>
              </button>
            );
          })}
        </nav>
      ) : word ? (
        <div className="flex min-h-0 flex-1 flex-col border-t">
          <WordPanelBody
            key={`${word.rowKey} ${word.word} ${word.tab} ${word.keys.length}`}
            target={word}
            suttaId={suttaId}
            analysisEditions={analysisEditions}
            onClose={onCloseWord}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <MousePointerClick className="size-6 text-faint" aria-hidden />
          <p className="text-sm text-muted-foreground">
            문장이나 빠알리 단어, <b className="text-violet-700">문법분석</b>·<b className="text-sky-700">대역</b> 배지를 누르면
            여기에 풀이가 나옵니다.
          </p>
        </div>
      )}
    </aside>
  );
}
