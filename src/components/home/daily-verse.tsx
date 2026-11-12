"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>오늘의 게송</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {verse === null ? (
          <>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-1/2" />
          </>
        ) : (
          <>
            <blockquote className="flex flex-col gap-1 text-base leading-7 font-semibold">
              {verse.lines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </blockquote>
            <div lang="pi" className="t-sub flex flex-col">
              {verse.paliLines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="t-meta">
                — 법구경 (Dhammapada) Dhp {verse.number}
                {verse.title ? ` · ${verse.title}` : ""} · {verse.editionLabel}
              </p>
              <Link
                href={suttaHref(verse.vaggaId, `dhp${verse.number}:1`)}
                className="flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline"
              >
                품 전체 읽기
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
