"use client";

import { Bookmark, Copy, Link2, MoreHorizontal, NotebookPen } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { InlineText } from "@/components/sutta/inline-text";
import type { NotesState } from "@/components/sutta/use-sutta-content";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlignedRow } from "@/lib/segments";
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
}

/** 문장 한 줄 — 판본들을 나란히(넓은 화면) 또는 위아래로(휴대폰) */
export function SegmentRow({
  row,
  heading,
  unitLabel,
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
}: {
  row: AlignedRow;
  heading: boolean;
  /** 게송이 바뀌는 첫 줄이면 게송 번호 (Dhp 5) */
  unitLabel: string | null;
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
}) {
  const compare = shown.length > 1;

  return (
    <div
      id={row.key}
      className={cn(
        "-mx-2 flex scroll-mt-32 gap-2 rounded-lg px-2 break-inside-avoid",
        heading && "mt-4",
        active && "bg-brand-softer ring-2 ring-primary/30",
      )}
    >
      {/* 문장 메뉴 칸 — 제목 줄에는 버튼 없이 자리만 맞춘다. 인쇄할 때는 뺀다. */}
      <div className="w-6 shrink-0 pt-[0.15em] print:hidden">
        {actions ? <SentenceMenu actions={actions} /> : null}
      </div>
      <div className="min-w-0 flex-1">
        {unitLabel ? <p className="t-meta mb-1 font-semibold">{unitLabel}</p> : null}
        {/* 모바일은 판본을 위아래로, md 이상은 나란히 */}
        <div
          className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-[var(--cols)] print:grid-cols-[var(--cols)]"
          style={{ "--cols": `repeat(${shown.length}, minmax(0, 1fr))` } as CSSProperties}
        >
          {shown.map((edition) => {
            const segment = row.cells[edition.id];
            if (!texts[edition.id]) return <Skeleton key={edition.id} className="h-5" />;
            if (!segment) return <div key={edition.id} />;
            const isPali = edition.language === "pli";
            const marks = new Set(
              segment.parts.flatMap((p) =>
                p.type === "note" && openNotes.has(`${edition.id} ${row.key} ${p.mark}`)
                  ? [p.mark]
                  : [],
              ),
            );
            return (
              <div key={edition.id} lang={LANG_ATTR[edition.language]}>
                <p
                  className={cn(
                    // 긴 빠알리 복합어도 칸 안에서 줄바꿈
                    "whitespace-pre-line wrap-anywhere",
                    heading ? "text-[1.1em] font-bold" : "",
                    isPali && "font-pali",
                    isPali && compare && "text-muted-foreground",
                    // 원래 앱이 복사를 막은 번역(법현 스님)은 글자 선택을 막는다
                    !edition.allowCopy && "select-none",
                  )}
                >
                  <InlineText
                    parts={segment.parts}
                    openMarks={marks}
                    onWord={isPali ? onWord : undefined}
                    activeWord={isPali && active ? activeWord : null}
                    onNote={
                      noteEditions.includes(edition.id)
                        ? (mark) => onNote(edition.id, row.key, mark)
                        : undefined
                    }
                  />
                </p>
                {[...marks].map((mark) => (
                  <NoteBox key={mark} mark={mark} state={notes[edition.id]} rowKey={row.key} />
                ))}
              </div>
            );
          })}
        </div>
        {actions?.memo ? (
          <p className="mt-2 mb-1 rounded-lg border-l-2 border-primary bg-surface-2 px-3 py-2 text-[0.85em] whitespace-pre-line">
            <NotebookPen className="mr-1 inline size-3.5 text-primary" aria-label="메모" />
            {actions.memo}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** 문장 왼쪽 칸의 메뉴. 북마크한 문장은 채운 책갈피로 보인다. */
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
            aria-label={saved ? "문장 메뉴 (북마크함)" : "문장 메뉴"}
            className={cn(
              saved ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground",
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
      <DropdownMenuContent align="start" className="w-48">
        {item(
          <Bookmark className={cn(saved && "fill-current")} aria-hidden />,
          saved ? "북마크 지우기" : "북마크",
          actions.onBookmark,
        )}
        {item(<NotebookPen aria-hidden />, actions.memo ? "메모 고치기" : "메모 남기기", actions.onMemo)}
        <DropdownMenuSeparator />
        {item(<Link2 aria-hidden />, "문장 링크 복사", actions.onCopyLink)}
        {item(<Copy aria-hidden />, "원문+번역 복사", actions.onCopyText)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NoteBox({
  mark,
  rowKey,
  state,
}: {
  mark: string;
  rowKey: string;
  state: NotesState | undefined;
}) {
  let body: ReactNode = "각주를 불러오는 중입니다…";
  if (state?.status === "error") body = `각주를 불러오지 못했습니다. ${state.message}`;
  if (state?.status === "ready") {
    const note: Footnote | undefined = state.notes.notes.find(
      (n) => n.key === rowKey && n.mark === mark,
    );
    body = note ? <InlineText parts={note.parts} /> : "각주 내용이 없습니다.";
  }
  return (
    <aside
      className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[0.85em] whitespace-pre-line text-muted-foreground"
      aria-label={`각주 ${mark}`}
    >
      <span className="mr-1 font-semibold text-primary">{mark})</span>
      {body}
    </aside>
  );
}
