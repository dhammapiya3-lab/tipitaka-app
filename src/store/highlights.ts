import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "underline";

/** 밑줄·형광펜 — 문장(key) 안의 판본(editionId) 글자 범위 [start, end) */
export interface Highlight {
  id: string;
  suttaId: string;
  suttaTitle: string;
  editionId: string;
  key: string;
  start: number;
  end: number;
  color: HighlightColor;
  /** 밑줄 친 글 (내 서재에 보인다) */
  text: string;
  savedAt: string;
}

interface HighlightsState {
  items: Highlight[];
  add: (h: Omit<Highlight, "id" | "savedAt">) => void;
  remove: (id: string) => void;
  recolor: (id: string, color: HighlightColor) => void;
}

/** 밑줄 — 이 기기에만 저장한다(localStorage). 저장값은 화면이 뜬 뒤 불러온다(SettingsHydrator). */
export const useHighlightsStore = create<HighlightsState>()(
  persist(
    (set) => ({
      items: [],
      add: (h) =>
        set(({ items }) => {
          // 같은 문장·판본에서 겹치는 밑줄은 새 것으로 바꾼다
          const rest = items.filter(
            (x) =>
              !(x.suttaId === h.suttaId && x.editionId === h.editionId && x.key === h.key && x.start < h.end && h.start < x.end),
          );
          const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
          return { items: [{ ...h, id, savedAt: new Date().toISOString() }, ...rest] };
        }),
      remove: (id) => set(({ items }) => ({ items: items.filter((x) => x.id !== id) })),
      recolor: (id, color) => set(({ items }) => ({ items: items.map((x) => (x.id === id ? { ...x, color } : x)) })),
    }),
    {
      name: "highlights",
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
      partialize: ({ items }) => ({ items }),
    },
  ),
);

/** 화면에 칠할 색 (tailwind 클래스) */
export const HIGHLIGHT_CLASS: Record<HighlightColor, string> = {
  yellow: "bg-yellow-200/80 dark:bg-yellow-500/40",
  green: "bg-green-200/80 dark:bg-green-500/40",
  blue: "bg-sky-200/80 dark:bg-sky-500/40",
  pink: "bg-pink-200/80 dark:bg-pink-500/40",
  underline: "underline decoration-red-500 decoration-2 underline-offset-4",
};
