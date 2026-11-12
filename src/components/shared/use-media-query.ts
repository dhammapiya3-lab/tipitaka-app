"use client";

import { useSyncExternalStore } from "react";

/**
 * 화면 폭 조건이 맞는지 (예: "(min-width: 1024px)").
 * 정적 페이지를 처음 그릴 때는 false 로 두고, 브라우저에서 실제 값으로 바뀐다.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** 사이드바가 보이는 넓은 화면(lg, 1024px 이상) */
export const DESKTOP_QUERY = "(min-width: 1024px)";
