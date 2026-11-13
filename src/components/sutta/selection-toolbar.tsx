"use client";

import { Bookmark, BookmarkCheck, Copy, Eraser, Highlighter, NotebookPen, Share2, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { HIGHLIGHT_CLASS, type HighlightColor } from "@/store/highlights";

/** 고른 글이 한 문장 칸 안이면 그 칸과 글자 범위 (밑줄은 한 칸 안에서만 긋는다) */
export interface CellRange {
  editionId: string;
  key: string;
  start: number;
  end: number;
  text: string;
}

const COLORS: { color: HighlightColor; label: string; dot: string }[] = [
  { color: "yellow", label: "노랑", dot: "bg-yellow-300" },
  { color: "green", label: "초록", dot: "bg-green-300" },
  { color: "blue", label: "파랑", dot: "bg-sky-300" },
  { color: "pink", label: "분홍", dot: "bg-pink-300" },
];

/** 칸 안에서 node·offset 자리가 몇 번째 글자인지 (각주 번호 [data-note] 는 세지 않는다) */
function offsetIn(cell: Element, node: Node, offset: number): number {
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest("[data-note]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let count = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n === node) return count + offset;
    // node 가 요소면(드물게) 그 안의 글자 앞까지
    if (node.nodeType !== Node.TEXT_NODE && node.contains(n)) return count;
    count += n.textContent?.length ?? 0;
  }
  return count;
}

/** 고른 글 중 본문 문장 칸의 글만 (문단 번호·배지 같은 화면 글자는 뺀다). 칸마다 줄을 나눈다 */
export function selectedCellText(root: Element, range: Range): string {
  const out: string[] = [];
  for (const cell of root.querySelectorAll("[data-cell]")) {
    if (!range.intersectsNode(cell)) continue;
    const r = range.cloneRange();
    if (!cell.contains(range.startContainer)) r.setStart(cell, 0);
    if (!cell.contains(range.endContainer)) r.setEnd(cell, cell.childNodes.length);
    const t = r.toString().trim();
    if (t) out.push(t);
  }
  return out.length ? out.join("\n") : range.toString().trim();
}

/** 고른 범위에 걸친 문장 칸들의 판본 id (나온 차례대로, 겹치지 않게) */
export function editionsIn(root: Element, range: Range): string[] {
  const ids: string[] = [];
  for (const cell of root.querySelectorAll("[data-cell]")) {
    if (!range.intersectsNode(cell)) continue;
    const id = (cell.getAttribute("data-cell") ?? "").split("|")[0];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** 고른 범위가 걸친 첫 문장 칸의 문장 번호 */
function firstKeyIn(root: Element, range: Range): string | null {
  for (const cell of root.querySelectorAll("[data-cell]")) {
    if (range.intersectsNode(cell)) return (cell.getAttribute("data-cell") ?? "").split("|")[1] || null;
  }
  return null;
}

/**
 * 본문에서 글을 고르면 그 위(휴대폰은 아래)에 뜨는 막대 — 복사 · 공유 · 밑줄(형광펜).
 * 여러 문장·문단을 한꺼번에 골라 복사·공유할 수 있다. 밑줄은 한 문장 안에서 긋는다.
 */
export function SelectionToolbar({
  container,
  onCopy,
  onShare,
  onHighlight,
  isSaved,
  onBookmark,
  onMemo,
  onListen,
}: {
  /** 이 안에서 고른 글만 (본문 article) */
  container: () => HTMLElement | null;
  /** editionIds: 고른 글이 걸친 판본들 (번역자 표시용) */
  onCopy: (text: string, editionIds: string[]) => void;
  onShare: (text: string, editionIds: string[]) => void;
  onHighlight: (range: CellRange, color: HighlightColor) => void;
  /** key: 고른 글이 시작하는 문장 */
  isSaved: (key: string) => boolean;
  onBookmark: (key: string) => void;
  onMemo: (key: string) => void;
  /** 소리로 읽기를 못 쓰는 브라우저면 없음 */
  onListen?: (key: string) => void;
}) {
  const [sel, setSel] = useState<{
    x: number;
    y: number;
    below: boolean;
    text: string;
    cell: CellRange | null;
    editions: string[];
    key: string | null;
  } | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    const update = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const s = window.getSelection();
        const root = container();
        if (!s || s.isCollapsed || s.rangeCount === 0 || !root) return setSel(null);
        const range = s.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) return setSel(null);
        const text = selectedCellText(root, range);
        if (!text) return setSel(null);
        const rect = range.getBoundingClientRect();
        const el = (n: Node | null) => (n instanceof Element ? n : n?.parentElement ?? null);
        const a = el(range.startContainer)?.closest("[data-cell]");
        const b = el(range.endContainer)?.closest("[data-cell]");
        let cell: CellRange | null = null;
        if (a && a === b) {
          const [editionId, key] = (a.getAttribute("data-cell") ?? "").split("|");
          const start = offsetIn(a, range.startContainer, range.startOffset);
          const end = offsetIn(a, range.endContainer, range.endOffset);
          if (end > start) cell = { editionId, key, start, end, text: s.toString() };
        }
        // 휴대폰은 브라우저 자체 메뉴가 위에 떠서 아래에 둔다
        const touch = window.matchMedia("(pointer: coarse)").matches;
        const below = touch || rect.top < 90;
        setSel({
          x: rect.left + rect.width / 2,
          y: below ? rect.bottom + 10 : rect.top - 10,
          below,
          text,
          cell,
          editions: editionsIn(root, range),
          key: firstKeyIn(root, range),
        });
      }, 120);
    };
    document.addEventListener("selectionchange", update);
    return () => {
      document.removeEventListener("selectionchange", update);
      window.clearTimeout(timer);
    };
  }, [container]);

  if (!sel) return null;
  const done = () => {
    window.getSelection()?.removeAllRanges();
    setSel(null);
  };
  const button = "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold hover:bg-gray-100 dark:hover:bg-muted";
  return (
    <div
      role="toolbar"
      aria-label="고른 글"
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-50 flex max-w-[calc(100vw-12px)] -translate-x-1/2 flex-wrap items-center justify-center gap-0.5 rounded-xl border bg-card p-1 shadow-lg print:hidden"
      style={{
        left: Math.min(Math.max(sel.x, Math.min(300, window.innerWidth / 2)), window.innerWidth - Math.min(300, window.innerWidth / 2)),
        top: sel.y,
        transform: `translate(-50%, ${sel.below ? "0" : "-100%"})`,
      }}
    >
      <button type="button" className={button} onClick={() => (onCopy(sel.text, sel.editions), done())}>
        <Copy className="size-3.5" aria-hidden />
        복사
      </button>
      <button type="button" className={button} onClick={() => (onShare(sel.text, sel.editions), done())}>
        <Share2 className="size-3.5" aria-hidden />
        공유
      </button>
      {sel.key ? (
        <>
          <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
          <button type="button" className={button} onClick={() => (onBookmark(sel.key!), done())}>
            {isSaved(sel.key) ? (
              <BookmarkCheck className="size-3.5 text-primary" aria-hidden />
            ) : (
              <Bookmark className="size-3.5" aria-hidden />
            )}
            {isSaved(sel.key) ? "책갈피 지우기" : "책갈피"}
          </button>
          <button type="button" className={button} onClick={() => (onMemo(sel.key!), done())}>
            <NotebookPen className="size-3.5" aria-hidden />
            메모
          </button>
          {onListen ? (
            <button type="button" className={button} onClick={() => (onListen(sel.key!), done())}>
              <Volume2 className="size-3.5" aria-hidden />
              여기서부터 듣기
            </button>
          ) : null}
        </>
      ) : null}
      {sel.cell ? (
        <>
          <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
          <Highlighter className="ml-1 size-3.5 text-muted-foreground" aria-hidden />
          {COLORS.map((c) => (
            <button
              key={c.color}
              type="button"
              title={`${c.label} 형광펜`}
              aria-label={`${c.label} 형광펜`}
              onClick={() => (onHighlight(sel.cell!, c.color), done())}
              className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-muted"
            >
              <span className={cn("block size-4 rounded-full ring-1 ring-black/10", c.dot)} />
            </button>
          ))}
          <button
            type="button"
            title="밑줄"
            onClick={() => (onHighlight(sel.cell!, "underline"), done())}
            className={cn(button, "px-2")}
          >
            <span className={HIGHLIGHT_CLASS.underline}>밑줄</span>
          </button>
        </>
      ) : null}
    </div>
  );
}

/** 이미 그은 밑줄을 누르면 — 색 바꾸기 · 지우기 */
export function HighlightMenu({
  at,
  onColor,
  onRemove,
  onClose,
}: {
  at: { x: number; y: number };
  onColor: (color: HighlightColor) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-highlight-menu]")) onClose();
    };
    const t = window.setTimeout(() => document.addEventListener("mousedown", close), 0);
    window.addEventListener("scroll", onClose, { once: true });
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", onClose);
    };
  }, [onClose]);
  return (
    <div
      data-highlight-menu
      role="toolbar"
      aria-label="밑줄"
      className="fixed z-50 flex items-center gap-0.5 rounded-xl border bg-card p-1 shadow-lg"
      style={{ left: Math.min(Math.max(at.x, 140), window.innerWidth - 140), top: at.y + 8, transform: "translateX(-50%)" }}
    >
      {COLORS.map((c) => (
        <button
          key={c.color}
          type="button"
          aria-label={`${c.label}로 바꾸기`}
          onClick={() => onColor(c.color)}
          className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-muted"
        >
          <span className={cn("block size-4 rounded-full ring-1 ring-black/10", c.dot)} />
        </button>
      ))}
      <button
        type="button"
        onClick={() => onColor("underline")}
        className="rounded-lg px-2 py-1.5 text-xs font-bold hover:bg-gray-100 dark:hover:bg-muted"
      >
        <span className={HIGHLIGHT_CLASS.underline}>밑줄</span>
      </button>
      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
      >
        <Eraser className="size-3.5" aria-hidden />
        지우기
      </button>
    </div>
  );
}
