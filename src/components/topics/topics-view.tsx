"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSuttaIndex, fetchTopics, type Topics } from "@/lib/content";
import { suttaHref, suttaLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SuttaIndexEntry } from "@/types";

const NIKAYA_ORDER = ["dn", "mn", "sn", "an", "kn"];

/**
 * 주제별 경전 — 경마다 단 주제 해시태그로 경을 모아 본다.
 * ?t=<주제> 이면 그 주제의 경 목록 (니까야별), 없으면 주제 전체.
 */
export function TopicsView() {
  const params = useSearchParams();
  const router = useRouter();
  const selected = params.get("t");
  const [data, setData] = useState<
    { topics: Topics; index: SuttaIndexEntry[] } | "error" | null
  >(null);
  useEffect(() => {
    let alive = true;
    Promise.all([fetchTopics(), fetchSuttaIndex()]).then(
      ([topics, index]) => alive && setData({ topics, index }),
      () => alive && setData("error"),
    );
    return () => {
      alive = false;
    };
  }, []);
  const groups = useMemo(() => {
    if (!data || data === "error" || !selected) return [];
    const ids = new Set(
      Object.entries(data.topics.suttas).flatMap(([id, ts]) =>
        ts.includes(selected) ? [id] : [],
      ),
    );
    const list = data.index.filter((s) => ids.has(s.id));
    return NIKAYA_ORDER.map((n) => ({
      nikaya: n,
      name: list.find((s) => s.nikaya === n)?.trail.nikayaName ?? n,
      suttas: list.filter((s) => s.nikaya === n),
    })).filter((g) => g.suttas.length);
  }, [data, selected]);

  if (data === null) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (data === "error")
    return (
      <p className="py-10 text-center text-sm text-faint">
        주제 자료를 불러오지 못했습니다.
      </p>
    );
  const topics = [...data.topics.topics]
    .filter((t) => t.count > 0)
    .sort((a, b) => a.ko.localeCompare(b.ko, "ko"));
  const current = topics.find((t) => t.id === selected);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {topics.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={t.id === selected}
            onClick={() =>
              router.push(t.id === selected ? "/topics/" : `/topics/?t=${t.id}`)
            }
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-semibold transition-colors",
              t.id === selected
                ? "border-transparent bg-primary text-primary-foreground"
                : "bg-card hover:bg-brand-soft",
            )}
          >
            #{t.ko}{" "}
            <span
              className={cn(
                "text-xs font-normal",
                t.id === selected ? "opacity-80" : "text-faint",
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>
      {current ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">
            #{current.ko}{" "}
            <span className="font-pali text-sm font-normal text-faint">
              {current.pali}
            </span>
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              경 {current.count}개
            </span>
          </h2>
          {groups.map((g) => (
            <div
              key={g.nikaya}
              className="rounded-2xl border bg-card p-4 shadow-sm"
            >
              <h3 className="mb-2 text-sm font-bold">
                {g.name}{" "}
                <span className="font-normal text-faint">
                  {g.suttas.length}
                </span>
              </h3>
              <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {g.suttas.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={suttaHref(s.id)}
                      className="group flex items-baseline gap-2 py-0.5"
                    >
                      <span className="w-20 shrink-0 text-xs text-faint">
                        {suttaLabel(s.id)}
                      </span>
                      <span className="truncate group-hover:text-primary group-hover:underline">
                        {(s.nameKo ?? s.name).toUpperCase() ===
                        suttaLabel(s.id).toUpperCase()
                          ? ""
                          : (s.nameKo ?? s.name)}
                      </span>
                      {s.editions.some((e) => e.startsWith("kor")) ? (
                        <span className="shrink-0 rounded bg-brand-soft px-1 text-[10px] font-bold text-primary">
                          번역
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          위에서 주제를 고르면 그 주제를 다룬 경들이 니까야별로 모여 나옵니다.
        </p>
      )}
      <p className="text-xs leading-relaxed text-faint">
        주제는 이 사이트가 자동으로 단 것이에요. 상윳따의 주제별 묶음(예: 연기
        상윳따 → #연기)과, 경의 빠알리 원문에 그 주제의 핵심 낱말(예: mettā →
        #자애, jhāna → #선정)이 두드러지게 많이 나오는지를 보고 경마다 많아야
        다섯 개를 달았어요. 빠지거나 넘치는 것이 있을 수 있어요.
      </p>
    </div>
  );
}
