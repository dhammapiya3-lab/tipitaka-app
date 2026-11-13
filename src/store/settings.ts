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
  /** 각주(·주석 펼침) 글자 크기 px */
  noteFontSize: number;
  /** 풀이 창(문법분석·대역·사전) 글자 크기 px */
  panelFontSize: number;
  setNoteFontSize: (size: number) => void;
  setPanelFontSize: (size: number) => void;
  /** 읽을 때 고른 판본 (경마다 있는 판본만 골라 쓴다) */
  editions: string[];
  /** 단어를 찾을 사전 */
  dictionaries: DictionaryId[];
  /** 경전 목록에서 본문이 있는 경만 보기 */
  onlyReadable: boolean;
  /** 컴퓨터에서 판본 여럿을 볼 때: 옆으로 나란히(side) · 문장마다 번갈아(alternate) */
  compareMode: "side" | "alternate";
  /** 문장 옆에 보일 책 쪽 번호 — P: PTS, M: 미얀마 6차 결집본, T: 태국본, V: VRI 인쇄본 */
  pageEditions: string[];
  setPageEditions: (eds: string[]) => void;
  /** 주석과 이어진 낱말에 밑줄 (누르면 그 주석 줄) */
  wordLinks: boolean;
  /** 빠알리 원문의 이본 표기 [..] 감추기 */
  hideVariants: boolean;
  setHideVariants: (on: boolean) => void;
  setWordLinks: (on: boolean) => void;
  /** 복주석서가 여럿인 경(디가: 옛·새 복주석서)에서 볼 책 — null 이면 모두, 아니면 책 차례(0: 옛, 1: 새) */
  tikaBook: number | null;
  setTikaBook: (book: number | null) => void;
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
      noteFontSize: 17,
      panelFontSize: 20,
      setNoteFontSize: (size) =>
        set({ noteFontSize: clampTo(FONT_SIZES, size) }),
      setPanelFontSize: (size) =>
        set({ panelFontSize: clampTo(FONT_SIZES, size) }),
      editions: DEFAULT_EDITIONS,
      dictionaries: DEFAULT_DICTIONARIES,
      onlyReadable: false,
      compareMode: "side",
      wordLinks: false,
      hideVariants: false,
      setHideVariants: (on) => set({ hideVariants: on }),
      tikaBook: null,
      setTikaBook: (book) => set({ tikaBook: book }),
      pageEditions: [],
      setPageEditions: (eds) => set({ pageEditions: eds }),
      setWordLinks: (on) => set({ wordLinks: on }),
      setCompareMode: (mode) => set({ compareMode: mode }),
      setOnlyReadable: (on) => set({ onlyReadable: on }),
      setFontSize: (size) => set({ fontSize: clampTo(FONT_SIZES, size) }),
      setLineHeight: (height) =>
        set({ lineHeight: clampTo(LINE_HEIGHTS, height) }),
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
          noteFontSize: 17,
          panelFontSize: 20,
          editions: DEFAULT_EDITIONS,
        }),
    }),
    {
      name: "reader-settings",
      storage: createJSONStorage(() => window.localStorage),
      // 1: 각주 글자 기본 14 → 17, 풀이 창 16 → 20 — 예전 기본값 그대로인 사람만 새 기본값으로
      version: 1,
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        if (version < 1) {
          if (s.noteFontSize === 14 || s.noteFontSize === undefined)
            s.noteFontSize = 17;
          if (s.panelFontSize === 16 || s.panelFontSize === undefined)
            s.panelFontSize = 20;
        }
        return s as unknown as SettingsState;
      },
      skipHydration: true,
      partialize: ({
        fontSize,
        lineHeight,
        noteFontSize,
        panelFontSize,
        editions,
        dictionaries,
        onlyReadable,
        compareMode,
        pageEditions,
        tikaBook,
        hideVariants,
      }) => ({
        tikaBook,
        hideVariants,
        pageEditions,
        noteFontSize,
        panelFontSize,
        compareMode,
        // 주석 낱말은 저장하지 않는다 — 열 때마다 꺼진 채로 시작하고, 켤 때만 켜진다
        fontSize,
        lineHeight,
        editions,
        dictionaries,
        onlyReadable,
      }),
    },
  ),
);
