"use client";

import { useHighlightsStore } from "@/store/highlights";
import { useEffect } from "react";
import { useBookmarksStore } from "@/store/bookmarks";
import { useReadingStore } from "@/store/reading";
import { useRecentStore } from "@/store/recent";
import { useSettingsStore } from "@/store/settings";

/** 화면이 뜬 뒤 이 기기에 저장된 읽기 설정·책갈피·이어 읽기·최근 찾은 단어를 불러온다. */
export function SettingsHydrator() {
  useEffect(() => {
    void useSettingsStore.persist.rehydrate();
    void useBookmarksStore.persist.rehydrate();
    void useHighlightsStore.persist.rehydrate();
    void useReadingStore.persist.rehydrate();
    void useRecentStore.persist.rehydrate();
  }, []);
  // 이본 표기 감추기 — 화면 전체(경·주석)에 걸리도록 <html> 에 표시 (globals.css 의 .hide-variants)
  const hideVariants = useSettingsStore((s) => s.hideVariants);
  useEffect(() => {
    document.documentElement.classList.toggle("hide-variants", hideVariants);
  }, [hideVariants]);
  return null;
}
