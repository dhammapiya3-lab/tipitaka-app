import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** 최근에 사전에서 찾은 단어를 몇 개까지 기억할지 */
const MAX_RECENT = 30;

interface RecentState {
  /** 최근 찾은 단어 (최근 것이 앞) */
  words: string[];
  add: (word: string) => void;
  clear: () => void;
}

/** 이 기기에만 저장한다. 저장값은 화면이 뜬 뒤 불러온다(SettingsHydrator). */
export const useRecentStore = create<RecentState>()(
  persist(
    (set) => ({
      words: [],
      add: (word) =>
        set(({ words }) => {
          const w = word.trim();
          if (!w) return { words };
          return { words: [w, ...words.filter((x) => x !== w)].slice(0, MAX_RECENT) };
        }),
      clear: () => set({ words: [] }),
    }),
    {
      name: "recent-words",
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
    },
  ),
);
