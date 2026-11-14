"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchTopics, type Topics } from "@/lib/content";

/** 경 화면 위의 ATI 주제 (Access to Insight 주제 색인) — 누르면 그 주제의 경 모음 */
export function TopicChips({ suttaId }: { suttaId: string }) {
  const [topics, setTopics] = useState<Topics | null>(null);
  useEffect(() => {
    let alive = true;
    fetchTopics().then(
      (t) => alive && setTopics(t),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);
  const mine = topics?.suttas[suttaId] ?? [];
  if (!topics || mine.length === 0) return null;
  const byId = new Map(topics.topics.map((t) => [t.id, t]));
  const ids = [...new Set(mine.map((m) => m.t))];
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 print:hidden">
      {ids.map((id) => {
        const t = byId.get(id);
        if (!t) return null;
        const notes = mine.filter((m) => m.t === id && m.n).map((m) => m.n);
        return (
          <Link
            key={id}
            href={`/topics/?t=${id}`}
            title={[t.en, ...notes].join("\n")}
            className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-primary hover:underline"
          >
            #{t.ko}
          </Link>
        );
      })}
    </div>
  );
}
