"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { fetchTopics, type Topics } from "@/lib/content";
import { suttaHref } from "@/lib/format";
import type { SearchableSutta } from "@/components/search/search-view";

/** 찾을 말과 주제 이름 맞추기: 앞뒤 공백·#·대소문자·빠알리 점 무시 */
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^#/, "").toLowerCase().trim();

/**
 * 전체 검색 — ATI 주제 이름(한국어·영어·빠알리)에 찾을 말이 들어 있으면, 그 주제로 분류된 경을 함께 보인다.
 * 예: "자애" → #자애 (mettā) 주제의 경들
 */
export function TopicMatches({
  query,
  suttas,
}: {
  query: string;
  suttas: SearchableSutta[];
}) {
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
  const q = fold(query);
  if (!topics || [...q].length < 2) return null;
  const matched = topics.topics.filter(
    (t) => fold(t.ko).includes(q) || fold(t.en).includes(q),
  );
  if (matched.length === 0) return null;
  const byId = new Map(suttas.map((s) => [s.id, s]));
  return (
    <>
      {matched.map((t) => {
        const ids = Object.entries(topics.suttas)
          .filter(([, list]) => list.some((x) => x.t === t.id))
          .map(([id]) => id)
          .filter((id) => byId.has(id))
          .sort(
            (a, b) =>
              suttas.indexOf(byId.get(a)!) - suttas.indexOf(byId.get(b)!),
          );
        return (
          <Card key={t.id} className="gap-0 p-0">
            <Link
              href={`/topics/?t=${t.id}`}
              className="flex items-center gap-2 border-b px-5 py-3 hover:bg-hover"
            >
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-sm font-semibold text-primary">
                #{t.ko}
              </span>
              <span className="t-meta">ATI 주제 · 경 {ids.length}개</span>
            </Link>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-3">
              {ids.slice(0, 30).map((id) => {
                const s = byId.get(id)!;
                return (
                  <li key={id}>
                    <Link
                      href={suttaHref(id)}
                      className="text-sm hover:text-primary hover:underline"
                    >
                      <span className="mr-1 text-xs text-faint">{s.label}</span>
                      {s.title === s.label ? "" : s.title}
                    </Link>
                  </li>
                );
              })}
              {ids.length > 30 ? (
                <li>
                  <Link
                    href={`/topics/?t=${t.id}`}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    모두 보기 →
                  </Link>
                </li>
              ) : null}
            </ul>
          </Card>
        );
      })}
    </>
  );
}
