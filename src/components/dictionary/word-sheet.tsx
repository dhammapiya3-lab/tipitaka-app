"use client";

import { BookA, Search, X } from "lucide-react";
import { useState } from "react";
import { NissayaPanel } from "@/components/dictionary/nissaya-panel";
import { DictionaryPicker, WordLookupResult } from "@/components/dictionary/word-lookup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Edition } from "@/types";

/** 사전 창에 띄울 것: 누른 단어와 그 단어가 있는 문장 번호 */
export interface WordTarget {
  word: string;
  rowKey: string;
}

type Tab = "dictionary" | "nissaya";

/**
 * 경 읽기에서 빠알리 단어를 누르면 열리는 창 — 좁은 화면용 (조회 드로어).
 * 넓은 화면에서는 WordDock 이 본문 옆에 붙어, 창을 연 채로 다른 단어를 누를 수 있다.
 * 사전 탭과, 이 경에 대역이 있으면 대역 탭이 있다(원래 앱의 문장 창과 같은 구성).
 */
export function WordSheet({
  target,
  suttaId,
  nissayaEditions,
  onClose,
}: {
  target: WordTarget | null;
  suttaId: string;
  nissayaEditions: Edition[];
  onClose: () => void;
}) {
  return (
    <Sheet open={target !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent side="right" className="w-[min(560px,92vw)] gap-0 p-0 sm:max-w-none">
        {target ? (
          <WordPanelBody
            key={`${target.rowKey} ${target.word}`}
            target={target}
            suttaId={suttaId}
            nissayaEditions={nissayaEditions}
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
  nissayaEditions,
  onClose,
}: {
  target: WordTarget;
  suttaId: string;
  nissayaEditions: Edition[];
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="사전"
      className="sticky top-30 flex h-[calc(100vh-8.5rem)] w-[400px] shrink-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-xs"
    >
      <WordPanelBody
        key={`${target.rowKey} ${target.word}`}
        target={target}
        suttaId={suttaId}
        nissayaEditions={nissayaEditions}
        onClose={onClose}
      />
    </aside>
  );
}

/** onClose 가 있으면 붙박이 칸(WordDock), 없으면 드로어(Sheet) 안에서 그린다 */
function WordPanelBody({
  target,
  suttaId,
  nissayaEditions,
  onClose,
}: {
  target: WordTarget;
  suttaId: string;
  nissayaEditions: Edition[];
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("dictionary");
  const [query, setQuery] = useState(target.word);
  const [searched, setSearched] = useState(target.word);

  /** 대역의 단어를 누르면 사전 탭으로 돌아가 그 단어를 찾는다 */
  function searchWord(word: string) {
    setQuery(word);
    setSearched(word);
    setTab("dictionary");
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "dictionary", label: "사전" },
    ...(nissayaEditions.length > 0 ? [{ id: "nissaya" as const, label: "대역" }] : []),
  ];

  return (
    <>
      {onClose ? (
        <div className="flex items-center gap-3 border-b p-4">
          <PanelTitle searched={searched} docked />
          <Button variant="ghost" size="icon" className="ml-auto" aria-label="사전 닫기" onClick={onClose}>
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <SheetHeader className="flex-row items-center gap-3 border-b p-4 pr-12">
          <PanelTitle searched={searched} />
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
          <WordLookupResult word={searched} onSearch={searchWord} />
        ) : (
          <NissayaPanel
            suttaId={suttaId}
            rowKey={target.rowKey}
            editions={nissayaEditions}
            onWord={searchWord}
          />
        )}
      </div>
    </>
  );
}

function PanelTitle({ searched, docked = false }: { searched: string; docked?: boolean }) {
  const titleClass = "truncate text-lg leading-[26px] font-bold tracking-tight";
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
        <BookA className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        {docked ? (
          <h2 lang="pi" className={titleClass}>
            {searched}
          </h2>
        ) : (
          <SheetTitle lang="pi" className={titleClass}>
            {searched}
          </SheetTitle>
        )}
        <p className="t-meta">
          {docked ? "본문의 다른 단어를 누르면 바로 다시 찾습니다." : "아래 칸에 다른 형태를 넣어 다시 찾을 수 있습니다."}
        </p>
      </div>
    </>
  );
}
