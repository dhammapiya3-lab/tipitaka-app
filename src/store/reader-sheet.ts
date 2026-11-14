import { create } from "zustand";

/**
 * 경 읽기 화면의 아래 창(판본 선택 · 목차 · 텍스트 설정) 중 열린 것.
 * 경 화면(SuttaView) 상태에 두면 창을 열고 닫을 때마다 긴 경 전체를 다시 그려 단추 반응이 늦어진다
 * (청정도론처럼 1,000줄이 넘는 경) — 그래서 창만 이 값을 읽는다.
 */
export type ReaderSheet = "editions" | "toc" | "text" | null;

export const useReaderSheet = create<{
  sheet: ReaderSheet;
  setSheet: (sheet: ReaderSheet) => void;
}>((set) => ({
  sheet: null,
  setSheet: (sheet) => set({ sheet }),
}));
