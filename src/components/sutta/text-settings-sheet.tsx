"use client";

import { Minus, Plus, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { FONT_SIZES, LINE_HEIGHT_LABELS, LINE_HEIGHTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings";

export function TextSettingsSheet() {
  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const setLineHeight = useSettingsStore((s) => s.setLineHeight);
  const reset = useSettingsStore((s) => s.reset);
  const sizeIndex = FONT_SIZES.findIndex((s) => s === fontSize);

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm" aria-label="텍스트 설정" />}>
        <Type aria-hidden />
        <span className="hidden sm:inline">텍스트</span>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(360px,92vw)]">
        <SheetHeader>
          <SheetTitle className="text-lg leading-[26px] font-bold tracking-tight">
            텍스트 설정
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4">
          <section className="flex flex-col gap-2">
            <h3 className="t-sub font-semibold">글자 크기: {fontSize}px</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="글자 작게"
                disabled={sizeIndex <= 0}
                onClick={() => setFontSize(FONT_SIZES[sizeIndex - 1])}
              >
                <Minus aria-hidden />
              </Button>
              <div className="flex-1 text-center" style={{ fontSize }}>
                가 Ā
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label="글자 크게"
                disabled={sizeIndex >= FONT_SIZES.length - 1}
                onClick={() => setFontSize(FONT_SIZES[sizeIndex + 1])}
              >
                <Plus aria-hidden />
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="t-sub font-semibold">줄 간격: {LINE_HEIGHT_LABELS[lineHeight]}</h3>
            <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="줄 간격">
              {LINE_HEIGHTS.map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-pressed={h === lineHeight}
                  onClick={() => setLineHeight(h)}
                  className={cn(
                    "h-8 flex-1 rounded-md text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    h === lineHeight
                      ? "bg-card font-semibold text-primary shadow-sm"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  {LINE_HEIGHT_LABELS[h]}
                </button>
              ))}
            </div>
          </section>

          <Button variant="outline" onClick={reset}>
            기본값으로
          </Button>
          <p className="t-meta">설정은 이 기기에만 저장됩니다.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
