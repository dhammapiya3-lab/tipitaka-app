"use client";

import { useEffect, useRef } from "react";

/** 키보드로 읽기 — 경 읽기 화면에서만 쓰는 단축키 */
export interface ReaderKeyHandlers {
  /** 다음(+1)·이전(-1) 문장 고르기 */
  moveSentence: (step: 1 | -1) => void;
  /** 고른 문장이 있으면 단어를 옮기고 true, 없으면 false (그때는 앞뒤 경으로 간다) */
  moveWord: (step: 1 | -1) => boolean;
  lookup: () => void;
  bookmark: () => void;
  copy: () => void;
  escape: () => void;
  prevSutta: () => void;
  nextSutta: () => void;
}

/** 글을 쓰는 중이거나 창·메뉴가 열려 있으면 단축키를 쓰지 않는다 */
export function isTypingOrDialog(target: EventTarget | null): boolean {
  const el = target instanceof HTMLElement ? target : null;
  if (el?.closest("input, textarea, select, [contenteditable=true]")) return true;
  return Boolean(document.querySelector("[role=dialog], [role=menu]"));
}

/**
 * j/k 문장, ←/→ 단어(문장을 골랐을 때) 또는 앞뒤 경, Enter 사전, b 책갈피, c 복사, Esc 그만.
 */
export function useReaderKeys(handlers: ReaderKeyHandlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const h = ref.current;
      if (e.key === "Escape") {
        h.escape();
        return;
      }
      if (isTypingOrDialog(e.target)) return;
      const actions: Record<string, () => void> = {
        j: () => h.moveSentence(1),
        k: () => h.moveSentence(-1),
        ArrowRight: () => {
          if (!h.moveWord(1)) h.nextSutta();
        },
        ArrowLeft: () => {
          if (!h.moveWord(-1)) h.prevSutta();
        },
        Enter: h.lookup,
        b: h.bookmark,
        c: h.copy,
      };
      const action = actions[e.key];
      if (!action) return;
      e.preventDefault();
      action();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
