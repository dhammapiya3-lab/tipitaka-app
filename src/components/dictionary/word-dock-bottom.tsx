"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ANALYSIS_LABEL, AnalysisPanel } from "@/components/dictionary/analysis-panel";
import { DictionaryPicker, WordLookupResult } from "@/components/dictionary/word-lookup";
import {
  ClickablePali,
  usePaliText,
  type AnalysisEditions,
  type WordTarget,
} from "@/components/dictionary/word-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MIN_HEIGHT = 180;

/**
 * 컴퓨터 화면: Digital Pāḷi Reader 처럼 화면 아래에 붙는 풀이 칸.
 * 왼쪽에 누른 문장과 대역·문법분석, 가운데·오른쪽에 켜 둔 사전들을 한꺼번에 보여 준다.
 * 위쪽 손잡이를 끌어 높이를 바꾼다. 본문에서 다른 단어를 누르면 내용만 바뀐다.
 */
export function WordBottomDock({
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
  const [height, setHeight] = useState(() =>
    typeof window === "undefined" ? 380 : Math.round(window.innerHeight * 0.42),
  );
  const [query, setQuery] = useState(target.word ?? "");
  const [searched, setSearched] = useState(target.word ?? "");
  const [lastTarget, setLastTarget] = useState(target);
  // 본문에서 다른 단어·문장을 누르면 찾는 단어를 바꾼다
  if (lastTarget !== target) {
    setLastTarget(target);
    if (target.word) {
      setQuery(target.word);
      setSearched(target.word);
    }
  }

  const drag = useRef<{ y: number; h: number } | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      const next = drag.current.h + (drag.current.y - e.clientY);
      // 화면 맨 위 바로 아래까지 끌어 올릴 수 있다
      setHeight(Math.max(MIN_HEIGHT, Math.min(window.innerHeight - 8, next)));
    };
    const up = () => {
      drag.current = null;
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const kinds = (["nissaya", "grammar"] as const).filter((k) => analysisEditions[k].length > 0);
  const showAnalysis = target.keys.length > 0 && kinds.length > 0;
  const heading = searched || target.title || "빠알리어 분석";
  const pali = usePaliText(suttaId, target.keys, target.pali);

  return (
    <>
      {/* 아래 칸에 가려지지 않게 본문 끝에 같은 높이만큼 빈 자리 */}
      <div aria-hidden style={{ height }} />
      <section
        aria-label="풀이"
        className="fixed right-0 bottom-0 left-0 z-40 flex flex-col border-t bg-card shadow-[0_-8px_24px_rgba(0,0,0,0.08)] lg:left-60 print:hidden"
        style={{ height }}
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="풀이 칸 높이 조절"
          title="끌어서 높이 조절"
          onPointerDown={(e) => {
            drag.current = { y: e.clientY, h: height };
            document.body.style.userSelect = "none";
          }}
          className="flex h-3.5 shrink-0 cursor-ns-resize items-center justify-center hover:bg-gray-50"
        >
          <span className="h-1 w-12 rounded-full bg-gray-300" />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b px-6 pb-2.5">
          <h2 lang={searched ? "pi" : undefined} className="max-w-[16rem] truncate font-pali text-lg font-bold">
            {heading}
          </h2>
          <form
            className="relative w-64"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) setSearched(query.trim());
            }}
          >
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              lang="pi"
              value={query}
              placeholder="찾을 단어"
              onChange={(e) => setQuery(e.target.value)}
              aria-label="찾을 단어"
              className="h-9 pl-9"
            />
          </form>
          <DictionaryPicker />
          <Button variant="ghost" size="icon" className="ml-auto" aria-label="풀이 칸 닫기" onClick={onClose}>
            <X aria-hidden />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 gap-4 px-6 py-3">
          {showAnalysis ? (
            <div className="flex w-[38%] min-w-0 shrink-0 flex-col gap-3 overflow-y-auto pr-1">
              {pali ? (
                <p
                  lang="pi"
                  className="rounded-xl border border-amber-200 bg-amber-50 p-3 font-pali font-bold whitespace-pre-line text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
                >
                  <ClickablePali
                    text={pali}
                    onWord={(w) => {
                      setQuery(w);
                      setSearched(w);
                    }}
                  />
                </p>
              ) : null}
              {kinds.map((kind) => (
                <div key={kind} className="flex flex-col gap-2">
                  <h3 className="text-xs font-bold text-primary">{ANALYSIS_LABEL[kind]}</h3>
                  <AnalysisPanel
                    key={`${kind} ${target.keys.join(",")}`}
                    kind={kind}
                    suttaId={suttaId}
                    keys={target.keys}
                    editions={analysisEditions[kind]}
                    onWord={(w) => {
                      setQuery(w);
                      setSearched(w);
                    }}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <div className="min-w-0 flex-1 overflow-y-auto">
            {searched ? (
              <WordLookupResult
                word={searched}
                onSearch={(w) => {
                  setQuery(w);
                  setSearched(w);
                }}
                columns
              />
            ) : (
              <p className="t-sub py-8 text-center">빠알리 단어를 누르거나 위 칸에 찾을 단어를 넣으면 사전이 나옵니다.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
