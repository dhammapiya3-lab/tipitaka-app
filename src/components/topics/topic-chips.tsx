"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchTopics, type Topics } from "@/lib/content";

/** 경 화면 위의 주제 해시태그 (#자애 #선정 …) — 누르면 그 주제의 경 모음 */
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
  const ids = topics?.suttas[suttaId] ?? [];
  if (!topics || ids.length === 0) return null;
  const byId = new Map(topics.topics.map((t) => [t.id, t]));
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 print:hidden">
      {ids.map((id) => {
        const t = byId.get(id);
        return t ? (
          <Link
            key={id}
            href={`/topics/?t=${id}`}
            title={`${t.pali} — 이 주제의 경 ${t.count}개 보기`}
            className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-primary hover:underline"
          >
            #{t.ko}
          </Link>
        ) : null;
      })}
    </div>
  );
}
