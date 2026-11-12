import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** 마지막으로 읽던 곳 — 홈의 "이어 읽기" */
export interface ReadingPosition {
  suttaId: string;
  suttaTitle: string;
  /** 화면 맨 위에 있던 문장 번호 */
  key: string;
  /** 읽은 때 (ISO 문자열) */
  at: string;
}

interface ReadingState {
  last: ReadingPosition | null;
  save: (position: Omit<ReadingPosition, "at">) => void;
}

/** 이 기기에만 저장한다. 저장값은 화면이 뜬 뒤 불러온다(SettingsHydrator). */
export const useReadingStore = create<ReadingState>()(
  persist(
    (set) => ({
      last: null,
      save: (position) => set({ last: { ...position, at: new Date().toISOString() } }),
    }),
    {
      name: "reading-position",
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
    },
  ),
);
