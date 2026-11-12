"use client";

import { BookA, Search, X } from "lucide-react";
import { useState } from "react";
import { ANALYSIS_LABEL, AnalysisPanel } from "@/components/dictionary/analysis-panel";
import { DictionaryPicker, WordLookupResult } from "@/components/dictionary/word-lookup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AnalysisKind, Edition } from "@/types";

export type PanelTab = "dictionary" | AnalysisKind;

/**
 * 풀이 창에 띄울 것.
 *   단어를 누름   → word 와 그 문장, 사전 탭
 *   문장을 누름   → 그 문장 하나, 대역·문법분석 탭
 *   문단 배지     → 문단의 모든 문장, 그 배지의 탭
 */
export interface WordTarget {
  /** 사전에서 찾을 단어. 문장·문단을 눌렀으면 null */
  word: string | null;
  /** 창을 연 문장(문단이면 첫 문장) — 다시 그릴 때의 열쇠 */
  rowKey: string;
  /** 대역·문법분석을 보여 줄 문장 번호들 */
  keys: string[];
  tab: PanelTab;
  /** 단어가 없을 때 제목 (예: "SN 56.11:1 문단") */
  title: string;
  /** 고른 곳의 빠알리 원문 (대역·문법분석 위에 보여 준다) */
  pali: string;
}

/** 이 경에서 대역·문법분석이 있는 판본 */
export type AnalysisEditions = Record<AnalysisKind, Edition[]>;

/**
 * 경 읽기에서 빠알리 단어를 누르면 열리는 창 — 좁은 화면용 (조회 드로어).
 * 넓은 화면에서는 WordDock 이 본문 옆에 붙어, 창을 연 채로 다른 단어를 누를 수 있다.
 * 사전 탭과, 이 경에 대역이 있으면 대역 탭이 있다(원래 앱의 문장 창과 같은 구성).
 */
export function WordSheet({
  target,
  suttaId,
  analysisEditions,
  onClose,
}: {
  target: WordTarget | null;
  suttaId: string;
  analysisEditions: AnalysisEditions;
  onClose: () => void;
}) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent side="right" className="w-[min(560px,92vw)] gap-0 p-0 sm:max-w-none">
        {target ? (
          <WordPanelBody
            key={`${target.rowKey} ${target.word} ${target.tab} ${target.keys.length}`}
            target={target}
            suttaId={suttaId}
            analysisEditions={analysisEditions}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** 넓은 화면: 본문 옆에 붙는 사전 칸 (화면을 가리지 않는다) */
export function WordDock({
  target,
  suttaId,
  analysisEditions,
  onClose,
}: {
  target: WordTarget;
  suttaId: string;
  analysisEditions: AnalysisEditions;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="풀이"
      className="sticky top-30 flex h-[calc(100vh-8.5rem)] w-[400px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-xs"
    >
      <WordPanelBody
        key={`${target.rowKey} ${target.word} ${target.tab} ${target.keys.length}`}
        target={target}
        suttaId={suttaId}
        analysisEditions={analysisEditions}
        onClose={onClose}
      />
    </aside>
  );
}

/** onClose 가 있으면 붙박이 칸(WordDock), 없으면 드로어(Sheet) 안에서 그린다 */
function WordPanelBody({
  target,
  suttaId,
  analysisEditions,
  onClose,
}: {
  target: WordTarget;
  suttaId: string;
  analysisEditions: AnalysisEditions;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<PanelTab>(target.tab);
  const [query, setQuery] = useState(target.word ?? "");
  const [searched, setSearched] = useState(target.word ?? "");

  /** 대역·문법분석의 단어를 누르면 사전 탭으로 돌아가 그 단어를 찾는다 */
  function searchWord(word: string) {
    setQuery(word);
    setSearched(word);
    setTab("dictionary");
  }

  const tabs: { id: PanelTab; label: string }[] = [
    ...(["nissaya", "grammar"] as const)
      .filter((kind) => analysisEditions[kind].length > 0)
      .map((kind) => ({ id: kind, label: ANALYSIS_LABEL[kind] })),
    { id: "dictionary", label: "사전" },
  ];
  const heading = searched || target.title;

  return (
    <>
      {onClose ? (
        <div className="flex items-center gap-3 border-b p-4">
          <PanelTitle heading={heading} isWord={Boolean(searched)} docked />
          <Button variant="ghost" size="icon" className="ml-auto" aria-label="풀이 창 닫기" onClick={onClose}>
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <SheetHeader className="flex-row items-center gap-3 border-b p-4 pr-12">
          <PanelTitle heading={heading} isWord={Boolean(searched)} />
        </SheetHeader>
      )}
      <div className="flex flex-col gap-3 border-b p-4">
        {tabs.length > 1 ? (
          <div className="flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="보기">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "h-8 flex-1 rounded-md text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  tab === t.id
                    ? "bg-card font-semibold text-primary shadow-sm"
                    : "font-medium text-muted-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : null}
        {tab === "dictionary" ? (
          <>
            <form
              className="relative"
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) setSearched(query.trim());
              }}
            >
              <Search
                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                lang="pi"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="찾을 단어"
                className="pl-9"
              />
            </form>
            <DictionaryPicker />
          </>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "dictionary" ? (
          searched ? (
            <WordLookupResult word={searched} onSearch={searchWord} />
          ) : (
            <p className="t-sub py-8 text-center">위 칸에 찾을 빠알리 단어를 넣으세요.</p>
          )
        ) : (
          <>
            {target.pali ? (
              <p lang="pi" className="mb-3 font-pali whitespace-pre-line text-muted-foreground">
                {target.pali}
              </p>
            ) : null}
            <AnalysisPanel
              key={tab}
              kind={tab}
              suttaId={suttaId}
              keys={target.keys}
              editions={analysisEditions[tab]}
              onWord={searchWord}
            />
          </>
        )}
      </div>
    </>
  );
}

function PanelTitle({
  heading,
  isWord,
  docked = false,
}: {
  heading: string;
  isWord: boolean;
  docked?: boolean;
}) {
  const titleClass = "truncate text-lg leading-[26px] font-bold tracking-tight";
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
        <BookA className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        {docked ? (
          <h2 lang={isWord ? "pi" : undefined} className={titleClass}>
            {heading}
          </h2>
        ) : (
          <SheetTitle lang={isWord ? "pi" : undefined} className={titleClass}>
            {heading}
          </SheetTitle>
        )}
        <p className="t-meta">
          {!isWord
            ? "단어를 누르면 사전에서 찾습니다."
            : docked
              ? "본문의 다른 단어를 누르면 바로 다시 찾습니다."
              : "아래 칸에 다른 형태를 넣어 다시 찾을 수 있습니다."}
        </p>
      </div>
    </>
  );
}
