"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ANALYSIS_LABEL, AnalysisPanel } from "@/components/dictionary/analysis-panel";
import { DictionaryPicker, WordLookupResult } from "@/components/dictionary/word-lookup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fetchSuttaText } from "@/lib/content";
import { splitWords } from "@/lib/pali";
import { plainText } from "@/lib/segments";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings";
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
      <SheetContent side="bottom" className="mx-auto max-h-[85vh] w-full max-w-md gap-0 overflow-hidden rounded-t-3xl border-0 p-0 lg:max-h-[90vh] lg:max-w-4xl">
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

/** onClose 가 있으면 붙박이 칸(WordDock·경 읽기 오른쪽 칸), 없으면 드로어(Sheet) 안에서 그린다 */
export function WordPanelBody({
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
  const heading = searched || target.title || "빠알리어 분석";
  const pali = usePaliText(suttaId, target.keys, target.pali);
  const panelFontSize = useSettingsStore((s) => s.panelFontSize);

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
          <div className="flex gap-2" role="tablist" aria-label="보기">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
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
      {/* 풀이 창 글자 크기 (텍스트 설정) — 창 안 전체를 같은 비율로 키운다 */}
      <div className="flex-1 overflow-y-auto p-4" style={{ zoom: panelFontSize / 16 }}>
        {tab === "dictionary" ? (
          searched ? (
            <WordLookupResult word={searched} onSearch={searchWord} />
          ) : (
            <p className="t-sub py-8 text-center">위 칸에 찾을 빠알리 단어를 넣으세요.</p>
          )
        ) : (
          <>
            {pali ? (
              <p
                lang="pi"
                className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 font-pali font-bold whitespace-pre-line text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
              >
                <ClickablePali text={pali} onWord={searchWord} />
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
  const titleClass = "truncate text-sm font-bold";
  return (
    <>
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

/** 문장 상자 안의 빠알리 — 단어를 누르면 사전에서 찾는다 */
export function ClickablePali({ text, onWord }: { text: string; onWord: (word: string) => void }) {
  return splitWords(text).map((piece, i) =>
    piece.word ? (
      <span
        key={i}
        role="button"
        tabIndex={0}
        onClick={() => onWord(piece.text)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onWord(piece.text);
          }
        }}
        className="cursor-pointer rounded-sm hover:bg-amber-200/60 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
      >
        {piece.text}
      </span>
    ) : (
      piece.text
    ),
  );
}

/**
 * 문장 상자에 보일 빠알리 원문 — 화면에 빠알리 판본을 띄우지 않았으면(번역만 볼 때) 마하상기띠본을 받아서 채운다.
 */
export function usePaliText(suttaId: string, keys: string[], given: string): string {
  const keyList = keys.join("|");
  const [state, setState] = useState<{ for: string; text: string } | null>(null);
  useEffect(() => {
    if (given || !keyList) return;
    let alive = true;
    const wanted = keyList.split("|");
    fetchSuttaText(suttaId, "pli-ms")
      .then((t) => {
        if (!alive) return;
        const text = t.segments
          .filter((seg) => wanted.includes(seg.key))
          .map((seg) => plainText(seg.parts))
          .join("\n");
        setState({ for: `${suttaId}|${keyList}`, text });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [suttaId, keyList, given]);
  if (given) return given;
  return state?.for === `${suttaId}|${keyList}` ? state.text : "";
}
