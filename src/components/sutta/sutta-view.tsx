"use client";

import { BookA, BookOpen, ChevronLeft, ChevronRight, CloudOff, List, Type } from "lucide-react";
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
import { BarButton, Breadcrumb, SubBar } from "@/components/layout/app-bar";
import { MemoDialog } from "@/components/sutta/memo-dialog";
import { SegmentRow, type SentenceActions } from "@/components/sutta/segment-row";
import {
  EditionBadges,
  EditionInfoSheet,
  EditionPickerSheet,
  TextSettingsSheet,
  TocSheet,
  type TocEntry,
} from "@/components/sutta/reader-sheets";
import { orderEditions } from "@/components/suttas/sutta-row";
import { ANALYSIS_LABEL } from "@/components/dictionary/analysis-panel";
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
import type { AnalysisKind, Edition } from "@/types";

export interface SuttaLink {
  id: string;
  title: string;
}

/** 머리에 쓰는 경 정보 — 제목·부제·위치 줄·← 단추가 갈 곳 */
export interface SuttaHead {
  title: string;
  titleLang?: string;
  crumbs: { label: string; href?: string }[];
  backHref: string;
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
  head,
}: {
  head: SuttaHead;
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
  // 화면에는 원래 앱처럼 한국어 → 빠알리 → 영어 순서로
  const shown = orderEditions(editions.filter((e) => shownIds.includes(e.id)));

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
  /** 경 · 주석서 · 복주석서 */
  const [layer, setLayer] = useState<"sutta" | "attha" | "tika">("sutta");
  /** 열려 있는 아래 창 */
  const [sheet, setSheet] = useState<"editions" | "toc" | "text" | null>(null);
  const [infoEdition, setInfoEdition] = useState<Edition | null>(null);

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
    window.scrollTo({ top: 0 });
  }
  /** 문단 보기를 마치면 보던 문단으로 돌아간다 (전체가 다시 그려진 다음 프레임에) */
  function closeParagraph() {
    const target = focus ? `section-${focus}` : null;
    setFocus(null);
    if (target) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: "start" })),
      );
    }
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

  const articleStyle: CSSProperties = { fontSize, lineHeight };

  // 단락 제목(.0 줄)을 그 다음 문단에 붙인다 — 문단 카드 위 제목과 목차, 문단 보기의 제목에 쓴다
  const headingOf = new Map<string, string>();
  {
    let pending: string | null = null;
    for (const row of rows) {
      if (rowKind(row.key, suttaId) === "heading") {
        const cell = [...shown.filter((e) => e.language !== "pli"), ...shown]
          .map((e) => row.cells[e.id])
          .find(Boolean);
        pending = cell ? plainText(cell.parts) : pending;
      } else if (pending) {
        headingOf.set(paragraphOf(row.key, suttaId), pending);
        pending = null;
      }
    }
  }
  const toc: TocEntry[] = paragraphList.map((p) => ({
    paragraph: p,
    label: paragraphMark(p),
    title: headingOf.get(p),
  }));
  const rowByKey = new Map(rows.map((r) => [r.key, r]));
  const firstTranslation = shown.find((e) => e.language !== "pli");

  function paragraphCard(p: string, inFocus: boolean) {
    const keys = paragraphs.get(p) ?? [];
    const kinds = kindsFor(keys);
    const header = (
      <>
        <h3 className="text-sm font-bold">{paragraphMark(p)}</h3>
        <div className="flex items-center gap-1.5 print:hidden">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              title={`${ANALYSIS_LABEL[k]} 보기`}
              onClick={(e) => {
                e.stopPropagation();
                openAnalysis(keys, k, paragraphTitle(p));
              }}
              className={cn(
                "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                k === "nissaya"
                  ? "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300"
                  : "bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-300",
              )}
            >
              {ANALYSIS_LABEL[k]}
            </button>
          ))}
        </div>
      </>
    );
    return (
      <div key={p} id={`section-${p}`} className="scroll-mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm break-inside-avoid">
        {inFocus ? (
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 pt-4 pb-2 dark:border-border">
            {header}
          </div>
        ) : (
          // 원래 앱처럼 문단 머리를 누르면 그 문단부터 한 문단씩 본다
          <div
            role="button"
            tabIndex={0}
            title="이 문단부터 한 문단씩 보기"
            onClick={() => openParagraph(p)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openParagraph(p);
              }
            }}
            className="flex cursor-pointer items-center justify-between gap-3 border-b border-gray-100 px-5 pt-4 pb-2 transition-colors outline-none hover:bg-gray-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border dark:hover:bg-muted"
          >
            {header}
          </div>
        )}
        <div className={inFocus ? "px-5 py-4" : "px-5 py-3"}>
          {keys.map((key) => {
            const row = rowByKey.get(key);
            if (!row) return null;
            const unit = unitOf(row.key, suttaId);
            return (
              <SegmentRow
                key={row.key}
                row={row}
                heading={false}
                unitLabel={null}
                active={active?.key === row.key}
                activeWord={active?.key === row.key ? active.word : null}
                actions={actionsFor(row)}
                shown={shown}
                texts={texts}
                noteEditions={noteEditions}
                notes={notes}
                openNotes={openNotes}
                onNote={toggleNote}
                onWord={(w) =>
                  setWord({ word: w, rowKey: row.key, keys: [row.key], tab: "dictionary", title: "", pali: "" })
                }
                onSentence={() => onSentence(row)}
                unit={unit}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const tabClass = (on: boolean) =>
    cn(
      "flex-1 rounded-lg py-2 text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      on ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground",
    );
  const navButton =
    "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-bold text-primary transition-colors hover:bg-brand-soft disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="flex flex-col">
      <SubBar
        title={focus ? (headingOf.get(focus) ?? paragraphMark(focus)) : head.title}
        titleLang={focus ? undefined : head.titleLang}
        subtitle={focus ? undefined : firstTranslation?.label}
        backHref={focus ? undefined : head.backHref}
        onBack={focus ? closeParagraph : undefined}
        actions={
          <>
            <BarButton label="판본 선택" onClick={() => setSheet("editions")}>
              <BookOpen aria-hidden />
            </BarButton>
            {focus ? null : (
              <BarButton label="목차" onClick={() => setSheet("toc")}>
                <List aria-hidden />
              </BarButton>
            )}
            <BarButton label="텍스트 설정" onClick={() => setSheet("text")}>
              <Type aria-hidden />
            </BarButton>
            <BarButton label="사전" href="/dictionary">
              <BookA aria-hidden />
            </BarButton>
          </>
        }
      >
        <Breadcrumb items={head.crumbs} />
        <EditionBadges editions={shown} onInfo={setInfoEdition} />
      </SubBar>

      <div className="mx-auto w-full max-w-[1200px]">
        <div className="mx-auto flex max-w-3xl gap-2 px-4 py-3 print:hidden" role="tablist" aria-label="본문 종류">
          {(
            [
              ["sutta", "경"],
              ["attha", "주석서"],
              ["tika", "복주석서"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={layer === id} onClick={() => setLayer(id)} className={tabClass(layer === id)}>
              {label}
            </button>
          ))}
        </div>

        {layer !== "sutta" ? (
          <p className="px-6 py-12 text-center text-sm text-faint">
            {layer === "attha" ? "주석서(Aṭṭhakathā)" : "복주석서(Ṭīkā)"} 콘텐츠 준비 중입니다.
          </p>
        ) : (
          <>
            {/* 이전 · 다음 — 문단 보기에서는 문단, 아니면 경 */}
            <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2 print:hidden">
              {focus ? (
                <>
                  <button type="button" className={navButton} disabled={focusIndex <= 0} onClick={() => openParagraph(paragraphList[focusIndex - 1])}>
                    <ChevronLeft className="size-4" aria-hidden />
                    이전
                  </button>
                  <span className="text-xs text-faint">
                    {focusIndex + 1} / {paragraphList.length}
                  </span>
                  <button
                    type="button"
                    className={navButton}
                    disabled={focusIndex >= paragraphList.length - 1}
                    onClick={() => openParagraph(paragraphList[focusIndex + 1])}
                  >
                    다음
                    <ChevronRight className="size-4" aria-hidden />
                  </button>
                </>
              ) : (
                <>
                  {prev ? (
                    <Link href={suttaHref(prev.id)} className={navButton} title={prev.title}>
                      <ChevronLeft className="size-4" aria-hidden />
                      이전
                    </Link>
                  ) : (
                    <span className={cn(navButton, "opacity-30")}>
                      <ChevronLeft className="size-4" aria-hidden />
                      이전
                    </span>
                  )}
                  {next ? (
                    <Link href={suttaHref(next.id)} className={navButton} title={next.title}>
                      다음
                      <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  ) : (
                    <span className={cn(navButton, "opacity-30")}>
                      다음
                      <ChevronRight className="size-4" aria-hidden />
                    </span>
                  )}
                </>
              )}
            </div>

            {error ? (
              <EmptyState
                icon={CloudOff}
                title="본문을 불러오지 못했습니다"
                description={`${error}. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.`}
                action={<Button onClick={retry}>다시 시도</Button>}
              />
            ) : null}

            {/* 넓은 화면에서 사전을 열면 본문 옆에 붙인다 (창을 연 채로 다른 단어를 누를 수 있게) */}
            <div className="flex items-start gap-6 px-4 pt-2 pb-6">
              <article className="mx-auto flex w-full max-w-3xl min-w-0 flex-1 flex-col gap-4 print:max-w-none" style={articleStyle}>
                {waiting
                  ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)
                  : focus
                    ? paragraphCard(focus, true)
                    : paragraphList.map((p) => (
                        <div key={p} className="flex flex-col gap-2">
                          {headingOf.get(p) ? (
                            // 이야기·단락 제목 — 가운데 호박색 글자, 양옆에 옅은 선
                            <h2 className="flex items-center gap-3 px-2 pt-3 pb-1 font-sans">
                              <span aria-hidden className="h-px min-w-6 flex-1 bg-amber-200 dark:bg-amber-900" />
                              <span className="max-w-[80%] text-center text-[0.9em] font-bold tracking-wide text-balance break-keep text-amber-800 dark:text-amber-300">
                                {headingOf.get(p)}
                              </span>
                              <span aria-hidden className="h-px min-w-6 flex-1 bg-amber-200 dark:bg-amber-900" />
                            </h2>
                          ) : null}
                          {paragraphCard(p, false)}
                        </div>
                      ))}
              </article>
              {isDesktop && word ? (
                <div className="contents print:hidden">
                  <WordDock target={word} suttaId={suttaId} analysisEditions={analysisEditions} onClose={() => setWord(null)} />
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      {!isDesktop ? (
        <WordSheet target={word} suttaId={suttaId} analysisEditions={analysisEditions} onClose={() => setWord(null)} />
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

      <EditionPickerSheet
        open={sheet === "editions"}
        onOpenChange={(o) => setSheet(o ? "editions" : null)}
        editions={editions}
        shownIds={shownIds}
        onToggle={(id) => setEditions(toggleEdition(availableIds, preferred, shownIds, id))}
      />
      <TocSheet
        open={sheet === "toc"}
        onOpenChange={(o) => setSheet(o ? "toc" : null)}
        title={head.title}
        items={toc}
        onPick={(p) => {
          setSheet(null);
          document.getElementById(`section-${p}`)?.scrollIntoView({ block: "start" });
        }}
      />
      <TextSettingsSheet open={sheet === "text"} onOpenChange={(o) => setSheet(o ? "text" : null)} />
      <EditionInfoSheet open={infoEdition !== null} onOpenChange={(o) => !o && setInfoEdition(null)} edition={infoEdition} />
    </div>
  );
}

/** 문단 번호 표시: sn56.11:2 → 2, sn56.11:2.3 → 2.3, 게송(dhp5) → Dhp 5 */
function paragraphMark(paragraph: string): string {
  const colon = paragraph.indexOf(":");
  // 게송(dhp5)은 원래 앱처럼 번호만
  return colon >= 0 ? paragraph.slice(colon + 1) : paragraph.replace(/^[a-z-]+/, "");
}

/** 게송 번호 표시: dhp5 → Dhp 5 */
function unitLabel(unit: string): string {
  return unit.replace(/^([a-z-]+)/, (letters) => `${letters[0].toUpperCase()}${letters.slice(1)} `);
}
