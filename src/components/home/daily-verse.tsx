"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSuttaText } from "@/lib/content";
import { PALI_EDITION } from "@/lib/constants";
import { dailyNumber, suttaHref } from "@/lib/format";
import { plainText, rowKind } from "@/lib/segments";
import { useSettingsStore } from "@/store/settings";
import type { Edition, SuttaText } from "@/types";

/** 법구경 품 하나 (dhp1-20 → 1~20번 게송) */
export interface DhpVagga {
  id: string;
  from: number;
  to: number;
}

interface Verse {
  number: number;
  vaggaId: string;
  title: string;
  lines: string[];
  paliLines: string[];
  editionLabel: string;
}

function verseLines(text: SuttaText, number: number, vaggaId: string) {
  const prefix = `dhp${number}:`;
  const own = text.segments.filter((s) => s.key.startsWith(prefix));
  return {
    title: plainText(own.find((s) => rowKind(s.key, vaggaId) === "heading")?.parts ?? []),
    lines: own
      .filter((s) => rowKind(s.key, vaggaId) === "text")
      .map((s) => plainText(s.parts))
      .filter(Boolean),
  };
}

/**
 * 오늘의 게송 — 법구경 423게송 중 날짜마다 하나(같은 날에는 같은 게송).
 * 번역은 읽기 화면에서 고른 한국어 판본을 먼저 쓴다.
 */
export function DailyVerse({ vaggas, editions }: { vaggas: DhpVagga[]; editions: Edition[] }) {
  const preferred = useSettingsStore((s) => s.editions);
  const [verse, setVerse] = useState<Verse | "error" | null>(null);
  const korean = editions.filter((e) => e.language === "ko");
  const translation = korean.find((e) => preferred.includes(e.id)) ?? korean[0];

  useEffect(() => {
    const total = Math.max(...vaggas.map((v) => v.to));
    const number = dailyNumber(new Date(), total);
    const vagga = vaggas.find((v) => number >= v.from && number <= v.to);
    if (!vagga || !translation) return;
    let cancelled = false;
    Promise.all([fetchSuttaText(vagga.id, translation.id), fetchSuttaText(vagga.id, PALI_EDITION)])
      .then(([ko, pli]) => {
        if (cancelled) return;
        const kor = verseLines(ko, number, vagga.id);
        setVerse({
          number,
          vaggaId: vagga.id,
          title: kor.title,
          lines: kor.lines,
          paliLines: verseLines(pli, number, vagga.id).lines,
          editionLabel: translation.label,
        });
      })
      .catch(() => {
        if (!cancelled) setVerse("error");
      });
    return () => {
      cancelled = true;
    };
  }, [vaggas, translation]);

  if (!translation || verse === "error") return null;

  const card = "block w-full rounded-2xl border bg-card p-6 text-left shadow-sm transition-shadow hover:shadow-md";
  if (verse === null) {
    return (
      <div className={card}>
        <p className="mb-3 text-base font-bold">오늘의 게송</p>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    );
  }
  // 원래 앱처럼 카드 전체를 누르면 그 게송이 있는 품으로 간다
  return (
    <Link
      href={suttaHref(verse.vaggaId, `dhp${verse.number}:1`)}
      className={`${card} outline-none focus-visible:ring-3 focus-visible:ring-ring/50`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-base font-bold">오늘의 게송</h2>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
      </div>
      <div>
        {verse.lines.map((line, i) => (
          <p key={i} className="text-base leading-relaxed text-gray-800 dark:text-foreground">
            {line}
          </p>
        ))}
      </div>
      <div lang="pi" className="mt-2">
        {verse.paliLines.map((line, i) => (
          <p key={i} className="text-xs leading-relaxed text-faint">
            {line}
          </p>
        ))}
      </div>
      <p className="mt-3 text-xs font-bold text-primary">
        — 법구경 (Dhammapada) Dhp.{verse.number}
        <span className="ml-1 font-medium text-muted-foreground">· {verse.editionLabel}</span>
      </p>
    </Link>
  );
}
