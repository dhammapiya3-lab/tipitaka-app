"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchSuttaIndex, fetchTopics } from "@/lib/content";
import { suttaHref, suttaLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SuttaIndexEntry } from "@/types";

interface SuttaLink {
  id: string;
  title: string;
}

/** 경 제목 — 이름이 번호와 같으면(제목이 따로 없는 경) 비워 둔다 */
function titleOf(s: Pick<SuttaIndexEntry, "id" | "name" | "nameKo">): string {
  const t = s.nameKo ?? s.name;
  return t.toUpperCase() === suttaLabel(s.id).toUpperCase() ? "" : t;
}

const card =
  "group flex min-w-0 flex-1 flex-col gap-1 rounded-2xl border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-hover";

/** 경 맨 아래: 이전 경 · 다음 경 (제목까지 보이는 큰 단추) */
export function SuttaEndNav({
  prev,
  next,
}: {
  prev: SuttaLink | null;
  next: SuttaLink | null;
}) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="이전 경 · 다음 경" className="flex gap-3 print:hidden">
      {prev ? (
        <Link href={suttaHref(prev.id)} className={card}>
          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
            <ChevronLeft className="size-4" aria-hidden />
            이전 경 읽기
          </span>
          <span className="truncate text-sm">
            <span className="mr-1.5 text-xs text-faint">
              {suttaLabel(prev.id)}
            </span>
            {prev.title}
          </span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
      {next ? (
        <Link
          href={suttaHref(next.id)}
          className={cn(card, "items-end text-right")}
        >
          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
            다음 경 읽기
            <ChevronRight className="size-4" aria-hidden />
          </span>
          <span className="max-w-full truncate text-sm">
            <span className="mr-1.5 text-xs text-faint">
              {suttaLabel(next.id)}
            </span>
            {next.title}
          </span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  );
}

interface Related {
  sutta: SuttaIndexEntry;
  shared: string[];
}

/**
 * 관련 경전 — 주제 해시태그가 많이 겹치는 경을 추천한다.
 * 드문 주제가 겹칠수록 점수가 높고(흔한 주제는 낮게), 같은 니까야·한국어 번역이 있는 경을 조금 앞세운다.
 */
export function RelatedSuttas({
  suttaId,
  exclude,
}: {
  suttaId: string;
  exclude: string[];
}) {
  const [state, setState] = useState<{
    list: Related[];
    names: Map<string, string>;
  } | null>(null);
  const excludeKey = exclude.join(",");
  useEffect(() => {
    let alive = true;
    Promise.all([fetchTopics(), fetchSuttaIndex()]).then(
      ([topics, index]) => {
        const mine = topics.suttas[suttaId] ?? [];
        const names = new Map(topics.topics.map((t) => [t.id, t.ko]));
        if (mine.length === 0) {
          if (alive) setState({ list: [], names });
          return;
        }
        const total = Object.keys(topics.suttas).length;
        const weight = new Map(
          topics.topics.map((t) => [
            t.id,
            Math.log(total / Math.max(1, t.count)),
          ]),
        );
        const self = index.find((s) => s.id === suttaId);
        const skip = new Set([suttaId, ...excludeKey.split(",")]);
        const scored: {
          s: SuttaIndexEntry;
          shared: string[];
          score: number;
        }[] = [];
        for (const s of index) {
          if (skip.has(s.id)) continue;
          const theirs = topics.suttas[s.id];
          if (!theirs) continue;
          const shared = mine.filter((t) => theirs.includes(t));
          if (shared.length === 0) continue;
          // 겹친 주제의 무게 합을 두 경의 주제 수로 나눠, 주제를 많이 단 경이 늘 앞서지 않게
          let score =
            shared.reduce((a, t) => a + (weight.get(t) ?? 0), 0) /
            Math.sqrt(mine.length * theirs.length);
          if (self && s.nikaya === self.nikaya) score *= 1.1;
          if (s.editions.some((e) => e.startsWith("kor"))) score *= 1.15;
          scored.push({ s, shared, score });
        }
        scored.sort((a, b) => b.score - a.score);
        // 한 묶음(예: 상윳따 하나, sn54)에서는 둘까지만 — 여러 곳의 경을 고루 보이게
        const perGroup = new Map<string, number>();
        const picked: Related[] = [];
        for (const { s, shared } of scored) {
          const group = s.id.includes(".")
            ? s.id.slice(0, s.id.lastIndexOf("."))
            : s.nikaya;
          const n = perGroup.get(group) ?? 0;
          if (n >= 2) continue;
          perGroup.set(group, n + 1);
          picked.push({ sutta: s, shared });
          if (picked.length >= 6) break;
        }
        if (alive) setState({ list: picked, names });
      },
      () => alive && setState({ list: [], names: new Map() }),
    );
    return () => {
      alive = false;
    };
  }, [suttaId, excludeKey]);

  if (!state || state.list.length === 0) return null;
  return (
    <section
      aria-label="관련 경전"
      className="flex flex-col gap-2 print:hidden"
    >
      <h2 className="px-1 text-sm font-bold">
        관련 경전{" "}
        <span className="text-xs font-normal text-faint">
          같은 주제를 다룬 경
        </span>
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {state.list.map(({ sutta, shared }) => (
          <li key={sutta.id}>
            <Link
              href={suttaHref(sutta.id)}
              className="flex h-full flex-col gap-1 rounded-2xl border bg-card px-4 py-3 shadow-sm hover:bg-hover"
            >
              <span className="flex items-baseline gap-2">
                <span className="shrink-0 text-xs text-faint">
                  {suttaLabel(sutta.id)}
                </span>
                <span className="truncate text-sm font-semibold">
                  {titleOf(sutta)}
                </span>
                {sutta.editions.some((e) => e.startsWith("kor")) ? (
                  <span className="shrink-0 rounded bg-brand-soft px-1 text-[10px] font-bold text-primary">
                    번역
                  </span>
                ) : null}
              </span>
              <span className="flex flex-wrap gap-1">
                {shared.map((t) => (
                  <span key={t} className="text-xs text-muted-foreground">
                    #{state.names.get(t) ?? t}
                  </span>
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="px-1 text-xs text-faint">
        주제 해시태그가 겹치는 경을 자동으로 고른 것이에요.
      </p>
    </section>
  );
}
