import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DictionaryId } from "@/types";
import {
  DEFAULT_DICTIONARIES,
  DEFAULT_EDITIONS,
  DEFAULT_FONT_SIZE,
  DEFAULT_LINE_HEIGHT,
  FONT_SIZES,
  LINE_HEIGHTS,
} from "@/lib/constants";

interface SettingsState {
  fontSize: number;
  lineHeight: number;
  /** 읽을 때 고른 판본 (경마다 있는 판본만 골라 쓴다) */
  editions: string[];
  /** 단어를 찾을 사전 */
  dictionaries: DictionaryId[];
  /** 경전 목록에서 본문이 있는 경만 보기 */
  onlyReadable: boolean;
  /** 컴퓨터에서 판본 여럿을 볼 때: 옆으로 나란히(side) · 문장마다 번갈아(alternate) */
  compareMode: "side" | "alternate";
  /** 주석과 이어진 낱말에 밑줄 (누르면 그 주석 줄) */
  wordLinks: boolean;
  setWordLinks: (on: boolean) => void;
  setCompareMode: (mode: "side" | "alternate") => void;
  setOnlyReadable: (on: boolean) => void;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  setEditions: (ids: string[]) => void;
  toggleDictionary: (id: DictionaryId) => void;
  reset: () => void;
}

const clampTo = (values: readonly number[], value: number) =>
  values.includes(value) ? value : values[Math.floor(values.length / 2)];

/**
 * 읽기 설정 — 이 기기에만 저장한다(localStorage).
 * 저장소가 막힌 브라우저에서는 저장 없이 메모리로만 동작한다.
 * 정적 페이지와 처음 화면이 같도록 저장값은 화면이 뜬 뒤 불러온다(SettingsHydrator).
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      fontSize: DEFAULT_FONT_SIZE,
      lineHeight: DEFAULT_LINE_HEIGHT,
      editions: DEFAULT_EDITIONS,
      dictionaries: DEFAULT_DICTIONARIES,
      onlyReadable: false,
      compareMode: "side",
      wordLinks: true,
      setWordLinks: (on) => set({ wordLinks: on }),
      setCompareMode: (mode) => set({ compareMode: mode }),
      setOnlyReadable: (on) => set({ onlyReadable: on }),
      setFontSize: (size) => set({ fontSize: clampTo(FONT_SIZES, size) }),
      setLineHeight: (height) => set({ lineHeight: clampTo(LINE_HEIGHTS, height) }),
      setEditions: (ids) => set({ editions: ids }),
      // 마지막 사전 하나는 끌 수 없다
      toggleDictionary: (id) =>
        set(({ dictionaries }) => {
          const next = dictionaries.includes(id)
            ? dictionaries.filter((d) => d !== id)
            : [...dictionaries, id];
          return { dictionaries: next.length > 0 ? next : dictionaries };
        }),
      reset: () =>
        set({
          fontSize: DEFAULT_FONT_SIZE,
          lineHeight: DEFAULT_LINE_HEIGHT,
          editions: DEFAULT_EDITIONS,
        }),
    }),
    {
      name: "reader-settings",
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
      partialize: ({ fontSize, lineHeight, editions, dictionaries, onlyReadable, compareMode, wordLinks }) => ({
        compareMode,
        wordLinks,
        fontSize,
        lineHeight,
        editions,
        dictionaries,
        onlyReadable,
      }),
    },
  ),
);
