"use client";

import { ListTree } from "lucide-react";
import { useState } from "react";
import { InlineText } from "@/components/sutta/inline-text";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { InlinePart } from "@/types";

export interface TocItem {
  key: string;
  parts: InlinePart[];
}

/** 목차 — 단락 제목 줄(.0)로 만든다. 누르면 그 단락으로 이동한다. */
export function TocSheet({ items }: { items: TocItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" aria-label="목차" />}>
        <ListTree aria-hidden />
        <span className="hidden sm:inline">목차</span>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(400px,92vw)]">
        <SheetHeader>
          <SheetTitle className="text-lg leading-[26px] font-bold tracking-tight">목차</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-0.5 overflow-y-auto px-2 pb-4" aria-label="목차">
          {items.map((item) => (
            <a
              key={item.key}
              href={`#${item.key}`}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-hover"
            >
              <InlineText parts={item.parts.filter((p) => p.type !== "note")} />
            </a>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
