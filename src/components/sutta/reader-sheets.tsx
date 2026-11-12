"use client";

import { Check, Printer } from "lucide-react";
import Link from "next/link";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import { editionBadgeClass, orderEditions } from "@/components/suttas/sutta-row";
import { FONT_SIZES, LINE_HEIGHTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings";
import type { Edition, Language } from "@/types";

const LANGUAGE_NAME: Record<Language, string> = { ko: "한국어", pli: "빠알리어", en: "영어" };

type SheetProps = { open: boolean; onOpenChange: (open: boolean) => void };

/** 판본 선택 — 언어별로 묶어 여러 개를 고르면 문장마다 번갈아 비교한다 (원래 앱과 같다) */
export function EditionPickerSheet({
  open,
  onOpenChange,
  editions,
  shownIds,
  onToggle,
}: SheetProps & { editions: Edition[]; shownIds: string[]; onToggle: (id: string) => void }) {
  const groups = (["ko", "pli", "en"] as const)
    .map((lang) => ({ lang, items: editions.filter((e) => e.language === lang) }))
    .filter((g) => g.items.length > 0);
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="판본 선택"
      subtitle="여러 판본을 선택하면 문장별로 비교할 수 있습니다"
    >
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.lang}>
            <h3 className="mb-2 px-2 text-sm font-bold">{LANGUAGE_NAME[g.lang]}</h3>
            <div className="flex flex-col gap-2">
              {g.items.map((e) => {
                const on = shownIds.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onToggle(e.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-4 py-3 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      on ? "bg-primary text-primary-foreground" : "bg-gray-50 text-secondary-foreground hover:bg-gray-100 dark:bg-muted",
                    )}
                  >
                    <span className="text-left text-sm font-bold">{e.label}</span>
                    {on ? <Check className="size-4" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

/** 판본 배지를 누르면 — 판본 정보 */
export function EditionInfoSheet({ open, onOpenChange, edition }: SheetProps & { edition: Edition | null }) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="판본 정보">
      {edition ? (
        <div className="flex flex-col gap-5 py-1">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold text-white",
                editionBadgeClass(edition),
              )}
            >
              {edition.badge})
            </span>
            <div>
              <p className="text-base font-semibold">{edition.label}</p>
              <p className="mt-0.5 text-xs text-faint">{LANGUAGE_NAME[edition.language]}</p>
            </div>
          </div>
          <div className="border-t" />
          {edition.allowCopy ? null : (
            <p className="text-sm leading-relaxed text-secondary-foreground">
              이 번역은 저작권자의 뜻에 따라 복사·인쇄할 수 없습니다.
            </p>
          )}
          <Link href="/about#editions" className="text-sm font-bold text-primary hover:underline">
            모든 판본의 출처와 저작권 보기 →
          </Link>
        </div>
      ) : null}
    </BottomSheet>
  );
}

export interface TocEntry {
  paragraph: string;
  label: string;
  title?: string;
}

/** 목차 — 문단 번호(와 단락 제목). 누르면 그 문단으로 */
export function TocSheet({
  open,
  onOpenChange,
  title,
  items,
  onPick,
}: SheetProps & { title: string; items: TocEntry[]; onPick: (paragraph: string) => void }) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="목차" subtitle={title}>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <button
            key={item.paragraph}
            type="button"
            onClick={() => onPick(item.paragraph)}
            className="w-full rounded-xl border bg-gray-50 px-4 py-3 text-left transition-colors outline-none hover:border-amber-200 hover:bg-amber-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-muted"
          >
            <span className="text-sm text-secondary-foreground">
              {item.label}
              {item.title ? <span className="ml-2 font-medium">{item.title}</span> : null}
            </span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

/** 텍스트 설정 — 글자 크기·줄 간격 (원래 앱과 같은 범위) + 인쇄 */
export function TextSettingsSheet({ open, onOpenChange }: SheetProps) {
  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const setLineHeight = useSettingsStore((s) => s.setLineHeight);
  const style = { fontSize, lineHeight };
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="텍스트 설정">
      <div className="flex flex-col gap-6">
        <div>
          <label htmlFor="font-size" className="mb-3 block text-sm font-bold">
            글자 크기: {fontSize}px
          </label>
          <input
            id="font-size"
            type="range"
            min={FONT_SIZES[0]}
            max={FONT_SIZES.at(-1)}
            step={1}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="mt-1 flex justify-between text-xs text-faint">
            <span>{FONT_SIZES[0]}px</span>
            <span>{FONT_SIZES.at(-1)}px</span>
          </div>
        </div>
        <div>
          <label htmlFor="line-height" className="mb-3 block text-sm font-bold">
            줄 간격: {lineHeight}
          </label>
          <input
            id="line-height"
            type="range"
            min={LINE_HEIGHTS[0]}
            max={LINE_HEIGHTS.at(-1)}
            step={0.25}
            value={lineHeight}
            onChange={(e) => setLineHeight(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="mt-1 flex justify-between text-xs text-faint">
            <span>좁게</span>
            <span>넓게</span>
          </div>
        </div>
        <div className="rounded-xl border bg-gray-50 p-4 dark:bg-muted">
          <p lang="pi" className="font-pali" style={style}>
            Manopubbaṅgamā dhammā, manoseṭṭhā manomayā;
          </p>
          <p className="mt-2 font-pali text-muted-foreground" style={style}>
            마음이 모든 법의 선두이며, 마음이 으뜸이고, 마음으로 이루어진다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-bold text-secondary-foreground hover:bg-muted"
        >
          <Printer className="size-4" aria-hidden />이 경 인쇄하기
        </button>
      </div>
    </BottomSheet>
  );
}

/** 머리 아래 판본 배지 줄 (누르면 판본 정보) */
export function EditionBadges({ editions, onInfo }: { editions: Edition[]; onInfo: (e: Edition) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 print:hidden">
      {orderEditions(editions).map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => onInfo(e)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white active:opacity-75",
            editionBadgeClass(e),
          )}
        >
          {e.badge}) {e.label}
        </button>
      ))}
    </div>
  );
}
