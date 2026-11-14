"use client";

import {
  Bookmark,
  Headphones,
  MoreHorizontal,
  NotebookPen,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import {
  InlineText,
  type InlineHighlight,
} from "@/components/sutta/inline-text";
import type { NotesState } from "@/components/sutta/use-sutta-content";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlignedRow } from "@/lib/segments";
import type { PageMark } from "@/lib/page-marks";
import { cn } from "@/lib/utils";
import type { Edition, Footnote, Language, SuttaText } from "@/types";

const LANG_ATTR: Record<Language, string> = { pli: "pi", ko: "ko", en: "en" };

/** 문장 메뉴에서 할 수 있는 일 (본문 줄에만 있다) */
export interface SentenceActions {
  saved: boolean;
  memo: string | null;
  onBookmark: () => void;
  onMemo: () => void;
  onCopyLink: () => void;
  onCopyText: () => void;
  /** 이 문장부터 소리로 듣기 */
  onListen?: () => void;
}

/** 누른 곳이 단어·각주 버튼·링크가 아니고, 글자를 끌어 고르는 중도 아닐 때만 문장 누르기로 본다 */
function isPlainClick(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || target.closest("[data-word], button, a"))
    return false;
  const selection = window.getSelection();
  return !selection || selection.isCollapsed;
}

/** 판본 배지 색 — 원래 앱처럼 한국어는 호박색, 빠알리는 짙은 회색, 영어는 회색 */
function badgeColor(language: Language): string {
  if (language === "ko") return "bg-primary";
  if (language === "pli") return "bg-gray-600";
  return "bg-gray-500";
}

/**
 * 문장 한 줄 (문단 카드 안) — 원래 앱과 같은 모양.
 * 판본이 하나면 글만, 여럿이면 판본마다 배지(한) M) …)를 달아 위아래로 번갈아 보이고 아래에 가는 선.
 * 넓은 화면에서는 판본을 나란히 놓는다(새로 더한 기능).
 */
export function SegmentRow({
  row,
  heading,
  active,
  activeWord,
  actions,
  shown,
  texts,
  noteEditions,
  notes,
  openNotes,
  onNote,
  onWord,
  onSentence,
  columns = false,
  linked,
  onLinked,
  highlightsFor,
  onHighlight,
  bookmarked = false,
  pageMarks,
}: {
  /** 이 문장에서 인쇄본 쪽이 바뀌면 그 쪽 번호들 (예: "PTS S v 421") */
  pageMarks?: PageMark[];
  /** 판본별 밑줄 */
  highlightsFor?: (editionId: string) => InlineHighlight[];
  onHighlight?: (id: string, target: HTMLElement) => void;
  /** 책갈피한 문장이면 왼쪽에 표시 */
  bookmarked?: boolean;
  /** 이 문장에서 주석과 이어진 낱말인지 / 누를 때 */
  linked?: (word: string) => boolean;
  onLinked?: (word: string) => void;
  /** 넓은 화면에서 판본을 칸으로 나란히 (배지 대신 카드 위 판본 이름) */
  columns?: boolean;
  row: AlignedRow;
  heading: boolean;
  /** (쓰지 않음 — 게송 번호는 문단 카드 머리에) */
  unitLabel?: string | null;
  unit?: string | null;
  /** 키보드로 고른 문장인지 */
  active: boolean;
  /** 키보드로 고른 빠알리 단어 순번 */
  activeWord: number | null;
  actions?: SentenceActions;
  shown: Edition[];
  texts: Record<string, SuttaText>;
  noteEditions: string[];
  notes: Record<string, NotesState>;
  openNotes: ReadonlySet<string>;
  onNote: (editionId: string, key: string, mark: string) => void;
  /** 빠알리 원문의 단어를 누를 때 */
  onWord: (word: string) => void;
  /** 문장을 누를 때 (대역·문법분석·사전 창) */
  onSentence?: () => void;
}) {
  const compare = shown.length > 1;

  return (
    <div
      id={row.key}
      className={cn(
        "group/row relative flex scroll-mt-32 gap-1 break-inside-avoid",
        compare && !columns && "py-1",
        active &&
          "-mx-2 rounded-lg bg-brand-softer px-2 ring-2 ring-primary/30",
      )}
    >
      {bookmarked ? (
        // 책갈피한 문장 — 왼쪽 여백에 작은 리본
        <Bookmark
          className="absolute top-2.5 -left-4 size-3.5 fill-amber-500 text-amber-500 print:hidden"
          aria-label="책갈피"
        />
      ) : null}
      {pageMarks?.length ? (
        // 인쇄본 쪽이 바뀌는 문장 — 오른쪽 위에 작게
        <span className="pointer-events-none absolute -top-1.5 right-7 flex gap-1 font-sans text-[10px] leading-none text-faint select-none">
          {pageMarks.map((m) => (
            <span
              key={m.label}
              title={m.title}
              className="pointer-events-auto cursor-help rounded bg-gray-100 px-1 py-0.5 dark:bg-muted"
            >
              {m.label}
            </span>
          ))}
        </span>
      ) : null}
      <div
        className={cn("min-w-0 flex-1", onSentence && "cursor-pointer")}
        onClick={
          onSentence ? (e) => isPlainClick(e.target) && onSentence() : undefined
        }
      >
        <div
          className={cn(
            (columns || compare) && "print:grid print:grid-cols-[var(--cols)]",
            columns &&
              "grid grid-cols-[var(--cols)] gap-x-6 border-t border-gray-100 dark:border-border",
          )}
          style={
            {
              "--cols": `repeat(${shown.length}, minmax(0, 1fr))`,
            } as CSSProperties
          }
        >
          {shown.map((edition) => {
            const segment = row.cells[edition.id];
            if (!texts[edition.id])
              return <Skeleton key={edition.id} className="my-2 h-5" />;
            if (!segment) return <div key={edition.id} />;
            const isPali = edition.language === "pli";
            const marks = new Set(
              segment.parts.flatMap((p) =>
                p.type === "note" &&
                openNotes.has(`${edition.id} ${row.key} ${p.mark}`)
                  ? [p.mark]
                  : [],
              ),
            );
            const text = (
              <p
                data-cell={`${edition.id}|${row.key}`}
                className={cn(
                  // 원래 앱처럼 원문·번역 모두 명조(.pali)로
                  "rounded font-pali whitespace-pre-line wrap-anywhere text-gray-800 transition-colors hover:bg-gray-50 dark:text-foreground dark:hover:bg-muted",
                  compare && !columns ? "py-0.5" : "py-2",
                  heading && "font-bold",
                  // 원래 앱이 복사를 막은 번역(법현 스님)은 글자 선택을 막는다
                  !edition.allowCopy && "select-none",
                )}
              >
                <InlineText
                  parts={segment.parts}
                  variants={isPali}
                  openMarks={marks}
                  onWord={isPali ? onWord : undefined}
                  highlights={highlightsFor?.(edition.id)}
                  onHighlight={onHighlight}
                  linked={isPali ? linked : undefined}
                  onLinked={isPali ? onLinked : undefined}
                  activeWord={isPali && active ? activeWord : null}
                  onNote={
                    noteEditions.includes(edition.id)
                      ? (mark) => onNote(edition.id, row.key, mark)
                      : undefined
                  }
                />
                {segment.unsure ? (
                  <span
                    className="ml-1.5 inline-block rounded border border-dashed border-primary/60 px-1 align-middle font-sans text-[10px] font-bold text-primary select-none"
                    title="VRI 원문의 이 줄에는 다음 문장 내용까지 함께 들어 있을 수 있어요. 두 판본의 글이 조금 달라 정확한 자리에서 나누지 못했습니다."
                    aria-label="다음 문장 내용까지 함께 있음"
                  >
                    ↓ 합침
                  </span>
                ) : null}
              </p>
            );
            return (
              <div
                key={edition.id}
                lang={LANG_ATTR[edition.language]}
                // 복사를 막아 둔 번역(법현 스님)은 인쇄에서 빼고, 복사 단축키로도 가져가지 못하게 한다
                className={cn(!edition.allowCopy && "print:invisible")}
                onCopy={
                  edition.allowCopy ? undefined : (e) => e.preventDefault()
                }
              >
                {compare && !columns ? (
                  <div className="flex items-start gap-2 py-1">
                    <span className="mt-0.5 inline-flex h-7 shrink-0 items-center">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center rounded px-1.5 py-0.5 font-sans text-[10px] font-bold text-white",
                          badgeColor(edition.language),
                        )}
                        title={edition.label}
                      >
                        {edition.badge})
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">{text}</div>
                  </div>
                ) : (
                  text
                )}
                {[...marks].map((mark) => (
                  <NoteBox
                    key={mark}
                    mark={mark}
                    state={notes[edition.id]}
                    rowKey={row.key}
                  />
                ))}
              </div>
            );
          })}
        </div>
        {actions?.memo ? (
          <p className="mt-2 mb-1 rounded-lg border-l-2 border-primary bg-surface-2 px-3 py-2 text-[0.85em] whitespace-pre-line">
            <NotebookPen
              className="mr-1 inline size-3.5 text-primary"
              aria-label="메모"
            />
            {actions.memo}
          </p>
        ) : null}
        {compare && !columns ? (
          <div className="mt-1 border-b border-gray-100 dark:border-border" />
        ) : null}
      </div>
      {/* 문장 메뉴(책갈피·메모·복사) — 새로 더한 기능. 인쇄할 때는 뺀다 */}
      <div className="w-6 shrink-0 pt-2 print:hidden">
        {actions ? <SentenceMenu actions={actions} /> : null}
      </div>
    </div>
  );
}

/** 문장 왼쪽 칸의 메뉴. 책갈피한 문장은 채운 책갈피로 보인다. */
function SentenceMenu({ actions }: { actions: SentenceActions }) {
  const { saved } = actions;
  const item = (icon: ReactNode, label: string, onClick: () => void) => (
    <DropdownMenuItem onClick={onClick}>
      {icon}
      {label}
    </DropdownMenuItem>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={saved ? "문장 메뉴 (책갈피 있음)" : "문장 메뉴"}
            className={cn(
              saved
                ? "text-primary"
                : "text-muted-foreground/40 hover:text-muted-foreground",
            )}
          />
        }
      >
        {saved ? (
          <Bookmark className="size-4 fill-current" aria-hidden />
        ) : (
          <MoreHorizontal className="size-4" aria-hidden />
        )}
      </DropdownMenuTrigger>
      {/* 메뉴가 짧으니 높이를 줄이지 않는다 — 둘레 칸(overflow-hidden) 때문에 쓸 수 있는 높이가 작게 잡히면 빈 막대처럼 보였다 */}
      <DropdownMenuContent align="start" className="max-h-none w-48">
        {actions.onListen
          ? item(
              <Headphones aria-hidden />,
              "여기서부터 듣기",
              actions.onListen,
            )
          : null}
        {item(
          <Bookmark className={cn(saved && "fill-current")} aria-hidden />,
          saved ? "책갈피 지우기" : "책갈피",
          actions.onBookmark,
        )}
        {item(
          <NotebookPen aria-hidden />,
          actions.memo ? "메모 고치기" : "메모 남기기",
          actions.onMemo,
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NoteBox({
  mark,
  rowKey,
  state,
}: {
  mark: string;
  rowKey: string;
  state: NotesState | undefined;
}) {
  let body: ReactNode = "각주를 불러오는 중입니다…";
  if (state?.status === "error")
    body = `각주를 불러오지 못했습니다. ${state.message}`;
  if (state?.status === "ready") {
    const note: Footnote | undefined = state.notes.notes.find(
      (n) => n.key === rowKey && n.mark === mark,
    );
    body = note ? <InlineText parts={note.parts} /> : "각주 내용이 없습니다.";
  }
  return (
    <aside
      className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[length:var(--note-fs,0.85em)] whitespace-pre-line text-muted-foreground"
      aria-label={`각주 ${mark}`}
    >
      <span className="mr-1 font-semibold text-primary">{mark})</span>
      {body}
    </aside>
  );
}
