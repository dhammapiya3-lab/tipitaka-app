"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/store/settings";

/**
 * "한글 번역이 있는 경만 보기" 스위치와 그 아래 목록. (빠알리 원문은 거의 모든 경에 있어서,
 * "본문이 있는 경"으로 거르면 아무것도 가려지지 않았다 — 2026-11-13 한글 번역 기준으로 바꿈)
 * 목록은 미리 만든 페이지라, 켜면 한글 번역이 없는 경·묶음(HIDE_WHEN_ONLY_READABLE)을 가린다.
 */
export function ReadableFilter({ children }: { children: ReactNode }) {
  const onlyReadable = useSettingsStore((s) => s.onlyReadable);
  const setOnlyReadable = useSettingsStore((s) => s.setOnlyReadable);
  return (
    <div className="group/catalog flex flex-col gap-3" data-only={onlyReadable}>
      <Label className="flex w-fit cursor-pointer items-center gap-2 px-2 text-xs text-muted-foreground">
        <Switch checked={onlyReadable} onCheckedChange={setOnlyReadable} />
        한글 번역이 있는 경만 보기
      </Label>
      {children}
    </div>
  );
}
