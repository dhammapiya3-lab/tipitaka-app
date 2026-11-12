"use client";

import { useEffect } from "react";
import { useBookmarksStore } from "@/store/bookmarks";
import { useReadingStore } from "@/store/reading";
import { useRecentStore } from "@/store/recent";
import { useSettingsStore } from "@/store/settings";

/** 화면이 뜬 뒤 이 기기에 저장된 읽기 설정·북마크·이어 읽기·최근 찾은 단어를 불러온다. */
export function SettingsHydrator() {
  useEffect(() => {
    void useSettingsStore.persist.rehydrate();
    void useBookmarksStore.persist.rehydrate();
    void useReadingStore.persist.rehydrate();
    void useRecentStore.persist.rehydrate();
  }, []);
  return null;
}
