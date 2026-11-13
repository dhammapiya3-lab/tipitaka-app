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

/** 내 서재의 "이어 읽기" — 최근에 읽던 경을 몇 개까지 기억할지 */
export const MAX_HISTORY = 5;

interface ReadingState {
  last: ReadingPosition | null;
  /** 최근에 읽던 경들 (경마다 마지막 자리 하나, 최근 것이 앞) */
  history: ReadingPosition[];
  save: (position: Omit<ReadingPosition, "at">) => void;
  remove: (suttaId: string) => void;
}

/** 이 기기에만 저장한다. 저장값은 화면이 뜬 뒤 불러온다(SettingsHydrator). */
export const useReadingStore = create<ReadingState>()(
  persist(
    (set) => ({
      last: null,
      history: [],
      save: (position) =>
        set(({ history }) => {
          const now = { ...position, at: new Date().toISOString() };
          return {
            last: now,
            history: [now, ...(history ?? []).filter((h) => h.suttaId !== position.suttaId)].slice(0, MAX_HISTORY),
          };
        }),
      remove: (suttaId) => set(({ history }) => ({ history: history.filter((h) => h.suttaId !== suttaId) })),
    }),
    {
      name: "reading-position",
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
    },
  ),
);
