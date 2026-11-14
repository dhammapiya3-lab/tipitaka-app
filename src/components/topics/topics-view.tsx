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

/** 경 제목 — 이름이 번호와 같으면(제목이 따로 없는 경) 비워 둔다 */
function titleOf(s: SuttaIndexEntry): string {
  const t = s.nameKo ?? s.name;
  return t.toUpperCase() === suttaLabel(s.id).toUpperCase() ? "" : t;
}

/**
 * 주제별 경전 — Access to Insight 의 주제 색인(사람이 정리한 색인)을 따라 경을 모아 본다.
 * ?t=<주제>,<주제>… 이면 고른 주제마다 그 주제의 경 목록 (고른 차례대로, 니까야별, ATI 의 설명과 함께).
 * 주제는 여러 개를 함께 고를 수 있고, 고른 주제를 다시 누르면 뺀다.
 */
export function TopicsView() {
  const params = useSearchParams();
  const router = useRouter();
  const selected = useMemo(
    () => (params.get("t") ?? "").split(",").filter(Boolean),
    [params],
  );
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
  /** 고른 주제마다 니까야별 경 목록 */
  const sections = useMemo(() => {
    if (!data || data === "error") return [];
    return selected.flatMap((topic) => {
      const info = data.topics.topics.find((x) => x.id === topic);
      if (!info) return [];
      const notes = new Map<string, string[]>();
      for (const [id, list] of Object.entries(data.topics.suttas)) {
        const mine = list.filter((x) => x.t === topic);
        if (mine.length)
          notes.set(id, [...new Set(mine.map((x) => x.n).filter(Boolean))]);
      }
      const list = data.index.filter((s) => notes.has(s.id));
      const groups = NIKAYA_ORDER.map((n) => ({
        nikaya: n,
        name: list.find((s) => s.nikaya === n)?.trail.nikayaName ?? n,
        suttas: list
          .filter((s) => s.nikaya === n)
          .map((s) => ({ s, notes: notes.get(s.id) ?? [] })),
      })).filter((g) => g.suttas.length);
      return [{ topic: info, groups }];
    });
  }, [data, selected]);
  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    router.push(next.length ? `/topics/?t=${next.join(",")}` : "/topics/", {
      scroll: false,
    });
  };

  if (data === null) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (data === "error")
    return (
      <p className="py-10 text-center text-sm text-faint">
        주제 자료를 불러오지 못했습니다.
      </p>
    );
  const topics = [...data.topics.topics].sort((a, b) =>
    a.ko.localeCompare(b.ko, "ko"),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {topics.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.en}
            aria-pressed={selected.includes(t.id)}
            onClick={() => toggle(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-semibold transition-colors",
              selected.includes(t.id)
                ? "border-transparent bg-primary text-primary-foreground"
                : "bg-card hover:bg-brand-soft",
            )}
          >
            #{t.ko}{" "}
            <span
              className={cn(
                "text-xs font-normal",
                selected.includes(t.id) ? "opacity-80" : "text-faint",
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>
      {sections.length ? (
        sections.map(({ topic: current, groups }) => (
          <section key={current.id} className="flex flex-col gap-4">
            <h2 className="text-lg font-bold">
              #{current.ko}{" "}
              <span className="text-sm font-normal text-faint">
                {current.en}
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
                <ul className="flex flex-col divide-y">
                  {g.suttas.map(({ s, notes }) => (
                    <li key={s.id} className="py-2">
                      <Link
                        href={suttaHref(s.id)}
                        className="group flex items-baseline gap-2"
                      >
                        <span className="w-20 shrink-0 text-xs text-faint">
                          {suttaLabel(s.id)}
                        </span>
                        <span className="truncate group-hover:text-primary group-hover:underline">
                          {titleOf(s)}
                        </span>
                        {s.editions.some((e) => e.startsWith("kor")) ? (
                          <span className="shrink-0 rounded bg-brand-soft px-1 text-[10px] font-bold text-primary">
                            번역
                          </span>
                        ) : null}
                      </Link>
                      {notes.length ? (
                        <p
                          lang="en"
                          className="mt-0.5 pl-22 text-xs text-muted-foreground"
                        >
                          {notes
                            .join(" · ")
                            .replace(/~/g, current.en.replace(/\s*\(.*$/, ""))}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">
          위에서 주제를 고르면 그 주제를 다룬 경들이 니까야별로 모여 나옵니다.
          주제는 여러 개를 함께 고를 수 있고, 고른 차례대로 아래에 이어
          나옵니다.
        </p>
      )}
      <p className="text-xs leading-relaxed text-faint">
        주제는 Access to Insight 의 주제 색인(Index of Subjects)을 따른
        것입니다. 사람이 정리한 색인이며, ATI 에 영어 번역이 있는 경(약 630개)만
        다룹니다. 경 아래의 영어 설명은 ATI 색인의 설명 그대로입니다. 주제
        이름의 한국어는 이 사이트가 옮겼습니다. 출처: © Access to Insight,
        Creative Commons Attribution 4.0 International License (CC BY 4.0).
      </p>
    </div>
  );
}
