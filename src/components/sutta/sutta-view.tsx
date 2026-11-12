"use client";

import { ArrowLeft, Check, ChevronLeft, ChevronRight, CloudOff, Info, Printer } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import {
  WordDock,
  WordSheet,
  type AnalysisEditions,
  type WordTarget,
} from "@/components/dictionary/word-sheet";
import { EmptyState } from "@/components/shared/empty-state";
import { DESKTOP_QUERY, useMediaQuery } from "@/components/shared/use-media-query";
import { MemoDialog } from "@/components/sutta/memo-dialog";
import { SegmentRow, type SentenceActions } from "@/components/sutta/segment-row";
import { TextSettingsSheet } from "@/components/sutta/text-settings-sheet";
import { TocSheet, type TocItem } from "@/components/sutta/toc-sheet";
import { useReaderKeys } from "@/components/sutta/use-reader-keys";
import { useAnalysisKeys, useSuttaNotes, useSuttaTexts } from "@/components/sutta/use-sutta-content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PALI_EDITION } from "@/lib/constants";
import { suttaHref, suttaLabel } from "@/lib/format";
import { sentenceCopyText, wordsOf } from "@/lib/reader";
import {
  alignEditions,
  paragraphOf,
  pickEditions,
  plainText,
  rowKind,
  toggleEdition,
  unitOf,
  type AlignedRow,
} from "@/lib/segments";
import { cn } from "@/lib/utils";
import { useBookmarksStore } from "@/store/bookmarks";
import { useReadingStore } from "@/store/reading";
import { useSettingsStore } from "@/store/settings";
import type { AnalysisKind, Edition, SuttaText } from "@/types";

export interface SuttaLink {
  id: string;
  title: string;
}

/** 화면 위 고정 칸(맨 위 띠) 높이 — 이보다 아래에 있는 첫 문장을 "읽는 곳"으로 본다 */
const TOP_OFFSET = 80;

export function SuttaView({
  suttaId,
  suttaTitle,
  editions,
  noteEditions,
  analysisEditions,
  prev,
  next,
}: {
  suttaId: string;
  suttaTitle: string;
  /** 이 경에 있는 판본 (빠알리 → 한국어 → 영어 순) */
  editions: Edition[];
  noteEditions: string[];
  /** 대역·문법분석이 있는 판본 */
  analysisEditions: AnalysisEditions;
  prev: SuttaLink | null;
  next: SuttaLink | null;
}) {
  const router = useRouter();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const preferred = useSettingsStore((s) => s.editions);
  const setEditions = useSettingsStore((s) => s.setEditions);

  const availableIds = useMemo(() => editions.map((e) => e.id), [editions]);
  const shownIds = pickEditions(editions, preferred);
  const shown = editions.filter((e) => shownIds.includes(e.id));

  const { texts, error, retry } = useSuttaTexts(suttaId, shownIds);
  const { notes, load: loadNotes } = useSuttaNotes(suttaId);
  const [openNotes, setOpenNotes] = useState<ReadonlySet<string>>(new Set());
  /** 사전 창에 띄울 빠알리 단어와 그 문장 */
  const [word, setWord] = useState<WordTarget | null>(null);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const analysisIds = useMemo(
    () => ({
      nissaya: analysisEditions.nissaya.map((e) => e.id),
      grammar: analysisEditions.grammar.map((e) => e.id),
    }),
    [analysisEditions],
  );
  const analysisKeys = useAnalysisKeys(suttaId, analysisIds);
  /** 마지막으로 본 풀이(대역·문법분석) — 문장을 누르면 이것부터 연다 */
  const [lastKind, setLastKind] = useState<AnalysisKind>("nissaya");
  /** 키보드로 고른 문장과 그 안의 빠알리 단어 순번 */
  const [active, setActive] = useState<{ key: string; word: number } | null>(null);
  /** 메모를 쓰는 문장 */
  const [memoRow, setMemoRow] = useState<AlignedRow | null>(null);
  /** 문단 보기: 이 문단 하나만 크게 보고 이전·다음 문단으로 넘긴다. null 이면 경 전체를 이어서 읽기 */
  const [focus, setFocus] = useState<string | null>(null);
  /** 문단 보기를 마치면 돌아갈 문단 */
  const returnTo = useRef<string | null>(null);

  const bookmarks = useBookmarksStore((s) => s.items);
  const toggleBookmark = useBookmarksStore((s) => s.toggle);
  const setMemo = useBookmarksStore((s) => s.setMemo);
  const mine = new Map(bookmarks.filter((b) => b.suttaId === suttaId).map((b) => [b.key, b]));
  const saveReading = useReadingStore((s) => s.save);

  const loaded = shown.flatMap((e) => (texts[e.id] ? [texts[e.id]] : []));
  const rows = alignEditions(
    Object.fromEntries(loaded.map((t) => [t.editionId, t.segments])),
  ).filter((row) => rowKind(row.key, suttaId) !== "hidden");
  const textRows = rows.filter((row) => rowKind(row.key, suttaId) === "text");
  const toc = tocItems(rows, loaded, suttaId);
  const waiting = loaded.length === 0 && !error;

  // 본문이 늦게 그려지므로, 주소의 #문장번호(북마크·목차·검색 링크)로 한 번만 이동한다.
  const scrolled = useRef(false);
  useEffect(() => {
    if (waiting || scrolled.current) return;
    scrolled.current = true;
    const target = decodeURIComponent(window.location.hash.slice(1));
    if (target) document.getElementById(target)?.scrollIntoView();
  }, [waiting]);

  // 이어 읽기: 스크롤이 멈추면 화면 맨 위 문장을 기억한다.
  const rowKeys = textRows.map((r) => r.key).join(",");
  useEffect(() => {
    if (!rowKeys) return;
    const keys = rowKeys.split(",");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const remember = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const key =
          keys.find((k) => (document.getElementById(k)?.getBoundingClientRect().bottom ?? 0) > TOP_OFFSET) ??
          keys[0];
        saveReading({ suttaId, suttaTitle, key });
      }, 600);
    };
    remember();
    window.addEventListener("scroll", remember, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", remember);
    };
  }, [rowKeys, suttaId, suttaTitle, saveReading]);

  /** 북마크·메모에 남길 문장: 번역이 있으면 첫 번역, 없으면 원문 (복사를 막아 둔 번역은 쓰지 않는다) */
  function baseOf(row: AlignedRow) {
    const usable = shown.filter((e) => e.allowCopy);
    const order = [...usable.filter((e) => e.language !== "pli"), ...usable];
    const cell = order.map((e) => row.cells[e.id]).find(Boolean);
    return { suttaId, key: row.key, suttaTitle, snippet: cell ? plainText(cell.parts) : "" };
  }

  const rowLabel = (key: string) =>
    `${suttaLabel(key.slice(0, key.indexOf(":")))}:${key.slice(key.indexOf(":") + 1)}`;

  // ── 대역·문법분석: 문단 배지와 문장 누르기 ───────────────────────
  /** 문단 번호 → 그 문단의 본문 문장 번호들 (차례대로) */
  const paragraphs = new Map<string, string[]>();
  for (const row of textRows) {
    const p = paragraphOf(row.key, suttaId);
    paragraphs.set(p, [...(paragraphs.get(p) ?? []), row.key]);
  }
  const paragraphList = [...paragraphs.keys()];
  const focusIndex = focus ? paragraphList.indexOf(focus) : -1;
  function openParagraph(p: string) {
    setFocus(p);
    returnTo.current = paragraphs.get(p)?.[0] ?? null;
    window.scrollTo({ top: 0 });
  }
  function closeParagraph() {
    setFocus(null);
  }
  /** 이 문장들 가운데 풀이가 있는 종류 (게송 첫 줄에 게송 전체를 넣은 판본도 있어 게송 단위로도 본다) */
  function kindsFor(keys: string[]): AnalysisKind[] {
    const units = new Set(keys.map((k) => unitOf(k, suttaId)));
    return (["nissaya", "grammar"] as const).filter((kind) =>
      [...analysisKeys[kind]].some((k) => keys.includes(k) || (units.has(unitOf(k, suttaId)) && unitOf(k, suttaId) !== null)),
    );
  }
  function paliOf(keys: string[]): string {
    const root = texts[PALI_EDITION];
    if (!root) return "";
    return root.segments
      .filter((seg) => keys.includes(seg.key))
      .map((seg) => plainText(seg.parts))
      .join("\n");
  }
  function openAnalysis(keys: string[], kind: AnalysisKind, title: string) {
    setLastKind(kind);
    setWord({ word: null, rowKey: keys[0], keys, tab: kind, title, pali: paliOf(keys) });
  }
  /** 문장을 누르면 그 문장 하나의 대역·문법분석 (풀이가 있는 문장만) */
  function onSentence(row: AlignedRow) {
    const kinds = kindsFor([row.key]);
    if (kinds.length === 0) return;
    const kind = kinds.includes(lastKind) ? lastKind : kinds[0];
    openAnalysis([row.key], kind, rowLabel(row.key));
  }
  function paragraphTitle(paragraph: string): string {
    return paragraph.includes(":") ? `${rowLabel(paragraph)} 문단` : `${unitLabel(paragraph)} 게송`;
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error("복사하지 못했습니다. 브라우저가 클립보드 사용을 막았을 수 있습니다.");
    }
  }

  function actionsFor(row: AlignedRow): SentenceActions {
    const url = `${window.location.origin}${suttaHref(suttaId, row.key)}`;
    return {
      saved: mine.has(row.key),
      memo: mine.get(row.key)?.memo || null,
      onBookmark: () => toggleBookmark(baseOf(row)),
      onMemo: () => setMemoRow(row),
      onCopyLink: () => copy(url, "문장 링크를 복사했습니다."),
      onCopyText: () => {
        const { text, skipped } = sentenceCopyText(row, shown, `${rowLabel(row.key)} ${suttaTitle}`, url);
        void copy(
          text,
          skipped.length
            ? `복사했습니다. (${skipped.join(", ")} 번역은 복사를 막아 두어 뺐습니다)`
            : "원문과 번역을 복사했습니다.",
        );
      },
    };
  }

  function toggleNote(editionId: string, key: string, mark: string) {
    const id = `${editionId} ${key} ${mark}`;
    if (!openNotes.has(id)) loadNotes(editionId);
    setOpenNotes((prevSet) => {
      const nextSet = new Set(prevSet);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });
  }

  // 문단 보기를 마치면 보던 문단으로 돌아간다
  useEffect(() => {
    if (focus !== null || !returnTo.current) return;
    document.getElementById(returnTo.current)?.scrollIntoView({ block: "start" });
    returnTo.current = null;
  }, [focus]);

  // ── 키보드로 읽기 ───────────────────────────────────────────
  const activeRow = active ? textRows.find((r) => r.key === active.key) : undefined;
  const paliWords = activeRow?.cells[PALI_EDITION] ? wordsOf(activeRow.cells[PALI_EDITION].parts) : [];
  useReaderKeys({
    moveSentence: (step) => {
      if (textRows.length === 0) return;
      let i = textRows.findIndex((r) => r.key === active?.key);
      if (i < 0) {
        // 처음에는 지금 화면에 보이는 첫 문장부터
        i = textRows.findIndex((r) => (document.getElementById(r.key)?.getBoundingClientRect().bottom ?? 0) > TOP_OFFSET);
        i = Math.max(0, step === 1 ? i - 1 : i);
      }
      const nextRow = textRows[Math.min(textRows.length - 1, Math.max(0, i + step))];
      setActive({ key: nextRow.key, word: 0 });
      document.getElementById(nextRow.key)?.scrollIntoView({ block: "center" });
    },
    moveWord: (step) => {
      if (!active) return false;
      setActive({ key: active.key, word: Math.min(Math.max(0, active.word + step), Math.max(0, paliWords.length - 1)) });
      return true;
    },
    lookup: () => {
      const w = paliWords[active?.word ?? 0];
      if (active && w) {
        setWord({ word: w, rowKey: active.key, keys: [active.key], tab: "dictionary", title: "", pali: "" });
      }
    },
    bookmark: () => {
      if (activeRow) {
        const saved = mine.has(activeRow.key);
        toggleBookmark(baseOf(activeRow));
        toast.success(saved ? "북마크를 지웠습니다." : "북마크했습니다.");
      }
    },
    copy: () => {
      if (activeRow) actionsFor(activeRow).onCopyText();
    },
    escape: () => {
      if (word) setWord(null);
      else setActive(null);
    },
    prevSutta: () => {
      if (prev) router.push(suttaHref(prev.id));
    },
    nextSutta: () => {
      if (next) router.push(suttaHref(next.id));
    },
  });

  const columns = shown.length;
  const articleStyle: CSSProperties = { fontSize, lineHeight };

  return (
    <div className="flex flex-col gap-4">
      {/* 함께 볼 판본 · 번역자 소개 · 목차 · 인쇄 · 텍스트 설정 (인쇄할 때는 뺀다) */}
      <section
        aria-label="함께 볼 판본"
        className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 rounded-xl bg-card px-3 pt-2 pb-3 shadow-card ring-1 ring-foreground/5 print:hidden"
      >
        <div className="flex items-center gap-1 pl-1">
          <span className="t-sub">
            함께 볼 판본 <b className="text-brand-ink">{shown.length}</b>
          </span>
          <Link
            href="/about#editions"
            className="t-sub ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2 outline-none hover:bg-hover hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Info className="size-4" aria-hidden />
            번역자 소개
          </Link>
          <TocSheet items={toc} />
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            aria-label="인쇄"
            onClick={() => window.print()}
          >
            <Printer aria-hidden />
          </Button>
          <TextSettingsSheet />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="판본 선택">
          {editions.map((edition) => {
            const on = shownIds.includes(edition.id);
            return (
              <button
                key={edition.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setEditions(toggleEdition(availableIds, preferred, shownIds, edition.id))
                }
                className={cn(
                  "inline-flex h-9 items-center gap-1 rounded-full border px-3.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  on
                    ? "border-primary/25 bg-brand-soft pl-2.5 font-bold text-brand-ink"
                    : "border-line-strong bg-card font-medium text-muted-foreground hover:bg-hover",
                )}
              >
                {on ? <Check className="size-3.5" strokeWidth={2.6} aria-hidden /> : null}
                {edition.label}
              </button>
            );
          })}
        </div>
      </section>

      {focus ? (
        <div className="mx-auto flex w-full max-w-[720px] items-center gap-3 print:hidden">
          <Button variant="outline" size="sm" onClick={closeParagraph}>
            <ArrowLeft aria-hidden />
            전체 보기
          </Button>
          <span className="t-sub ml-auto">
            문단 {focusIndex + 1} / {paragraphList.length}
          </span>
        </div>
      ) : null}

      {error ? (
        <EmptyState
          icon={CloudOff}
          title="본문을 불러오지 못했습니다"
          description={`${error}. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.`}
          action={<Button onClick={retry}>다시 시도</Button>}
        />
      ) : null}

      {/* 넓은 화면에서 사전을 열면 본문 옆에 붙인다 (창을 연 채로 다른 단어를 누를 수 있게) */}
      <div className="flex items-start gap-6">
        <article
          className={cn(
            "mx-auto flex w-full min-w-0 flex-1 flex-col gap-4 print:max-w-none",
            columns > 1 ? "max-w-[1200px]" : "max-w-[720px]",
          )}
          style={articleStyle}
        >
          {columns > 1 ? (
            <div className="hidden gap-6 pl-8 md:grid print:grid" style={gridStyle(columns)}>
              {shown.map((e) => (
                <p key={e.id} className={cn("t-meta", !e.allowCopy && "print:invisible")}>
                  {e.label}
                </p>
              ))}
            </div>
          ) : null}

          {waiting
            ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)
            : (focus ? rows.filter((r) => paragraphOf(r.key, suttaId) === focus && rowKind(r.key, suttaId) === "text") : rows).map((row, i, list) => {
                // 법구경처럼 경 안에 게송이 있으면, 게송이 바뀌는 첫 줄 위에 번호를 단다.
                const unit = unitOf(row.key, suttaId);
                const prevUnit = i > 0 ? unitOf(list[i - 1].key, suttaId) : null;
                const kind = rowKind(row.key, suttaId);
                // 문단 첫 문장에 그 문단의 대역·문법분석 배지를 단다
                const paragraph = kind === "text" ? paragraphOf(row.key, suttaId) : null;
                const paragraphKeys = paragraph ? (paragraphs.get(paragraph) ?? []) : [];
                const badges =
                  paragraph && paragraphKeys[0] === row.key
                    ? kindsFor(paragraphKeys).map((k) => ({
                        kind: k,
                        onClick: () => openAnalysis(paragraphKeys, k, paragraphTitle(paragraph)),
                      }))
                    : [];
                const hasAnalysis = kind === "text" && kindsFor([row.key]).length > 0;
                return (
                  <SegmentRow
                    key={row.key}
                    row={row}
                    heading={kind === "heading"}
                    unitLabel={unit && unit !== prevUnit ? unitLabel(unit) : null}
                    active={active?.key === row.key}
                    activeWord={active?.key === row.key ? active.word : null}
                    actions={kind === "text" ? actionsFor(row) : undefined}
                    shown={shown}
                    texts={texts}
                    noteEditions={noteEditions}
                    notes={notes}
                    openNotes={openNotes}
                    onNote={toggleNote}
                    onWord={(w) =>
                      setWord({ word: w, rowKey: row.key, keys: [row.key], tab: "dictionary", title: "", pali: "" })
                    }
                    badges={badges}
                    paragraphMark={
                      paragraph && paragraphKeys[0] === row.key && !focus ? paragraphMark(paragraph) : null
                    }
                    onParagraph={paragraph ? () => openParagraph(paragraph) : undefined}
                    onSentence={hasAnalysis ? () => onSentence(row) : undefined}
                  />
                );
              })}
          {focus ? (
            <nav
              aria-label="문단 이동"
              className="sticky bottom-20 z-10 mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2.5 rounded-2xl bg-background/95 py-2 backdrop-blur lg:bottom-4 print:hidden"
            >
              <Button
                variant="outline"
                className="h-14 rounded-2xl text-base"
                disabled={focusIndex <= 0}
                onClick={() => openParagraph(paragraphList[focusIndex - 1])}
              >
                <ChevronLeft aria-hidden />
                이전 문단
              </Button>
              <Button
                className="h-14 rounded-2xl text-base font-bold"
                disabled={focusIndex >= paragraphList.length - 1}
                onClick={() => openParagraph(paragraphList[focusIndex + 1])}
              >
                다음 문단
                <ChevronRight aria-hidden />
              </Button>
            </nav>
          ) : null}
        </article>
        {isDesktop && word ? (
          <div className="contents print:hidden">
            <WordDock
              target={word}
              suttaId={suttaId}
              analysisEditions={analysisEditions}
              onClose={() => setWord(null)}
            />
          </div>
        ) : null}
      </div>
      {!isDesktop ? (
        <WordSheet
          target={word}
          suttaId={suttaId}
          analysisEditions={analysisEditions}
          onClose={() => setWord(null)}
        />
      ) : null}

      <MemoDialog
        open={memoRow !== null}
        label={memoRow ? rowLabel(memoRow.key) : ""}
        initial={memoRow ? (mine.get(memoRow.key)?.memo ?? "") : ""}
        onSave={(memo) => {
          if (memoRow) setMemo(baseOf(memoRow), memo);
          toast.success(memo.trim() ? "메모를 저장했습니다." : "메모를 지웠습니다.");
        }}
        onClose={() => setMemoRow(null)}
      />

      <nav
        className={cn(
          "mx-auto mt-6 flex w-full max-w-[720px] justify-between gap-3 border-t pt-6 print:hidden",
          focus && "hidden",
        )}
        aria-label="앞뒤 경"
      >
        {prev ? (
          <Button variant="outline" nativeButton={false} render={<Link href={suttaHref(prev.id)} />}>
            <ChevronLeft aria-hidden />
            {prev.title}
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button variant="outline" nativeButton={false} render={<Link href={suttaHref(next.id)} />}>
            {next.title}
            <ChevronRight aria-hidden />
          </Button>
        ) : null}
      </nav>
    </div>
  );
}

function gridStyle(columns: number): CSSProperties {
  return { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
}

/** 문단 번호 표시: sn56.11:2 → 2, sn56.11:2.3 → 2.3, 게송(dhp5) → Dhp 5 */
function paragraphMark(paragraph: string): string {
  const colon = paragraph.indexOf(":");
  return colon >= 0 ? paragraph.slice(colon + 1) : unitLabel(paragraph);
}

/** 게송 번호 표시: dhp5 → Dhp 5 */
function unitLabel(unit: string): string {
  return unit.replace(/^([a-z-]+)/, (letters) => `${letters[0].toUpperCase()}${letters.slice(1)} `);
}

/** 목차 글자: 번역이 있으면 첫 번역의 단락 제목, 없으면 빠알리 제목 */
function tocItems(rows: AlignedRow[], loaded: SuttaText[], suttaId: string): TocItem[] {
  const order = [
    ...loaded.filter((t) => t.editionId !== PALI_EDITION),
    ...loaded.filter((t) => t.editionId === PALI_EDITION),
  ].map((t) => t.editionId);
  return rows
    .filter((row) => rowKind(row.key, suttaId) === "heading")
    .flatMap((row) => {
      const cell = order.map((id) => row.cells[id]).find(Boolean);
      return cell ? [{ key: row.key, parts: cell.parts }] : [];
    });
}
