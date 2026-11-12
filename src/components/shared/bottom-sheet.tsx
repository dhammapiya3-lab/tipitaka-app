"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";

/** 원래 앱의 아래에서 올라오는 창 — 둥근 위 모서리, 제목 + ✕, 옅은 부제, 스크롤되는 본문 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  subtitleLang,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: ReactNode;
  subtitleLang?: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto max-h-[90vh] w-full max-w-md gap-0 overflow-hidden rounded-t-3xl border-0 bg-card p-0"
      >
        <div className="shrink-0 border-b px-6 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold">{title}</SheetTitle>
            <SheetClose
              render={
                <button
                  type="button"
                  aria-label="닫기"
                  className="rounded-full p-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              }
            >
              <X className="size-6 text-muted-foreground" aria-hidden />
            </SheetClose>
          </div>
          {subtitle ? (
            <p lang={subtitleLang} className="mt-1 text-sm text-faint">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 text-base">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
