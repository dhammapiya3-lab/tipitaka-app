"use client";

import { BookX, ChevronRight, CloudOff } from "lucide-react";
import { Fragment } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SuttaView } from "@/components/sutta/sutta-view";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSuttaIndex } from "@/lib/content";
import type { Edition, SuttaIndexEntry } from "@/types";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; index: SuttaIndexEntry[] };

const titleOf = (s: SuttaIndexEntry) => s.nameKo ?? s.name;

/** 주소의 ?id= 로 경을 찾아 SuttaView 를 그린다. 이전·다음 경은 같은 니까야 안에서. */
export function SuttaReader({ editions }: { editions: Edition[] }) {
  const id = useSearchParams().get("id") ?? "";
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchSuttaIndex()
      .then((index) => {
        if (!cancelled) setState({ status: "ready", index });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const index = state.status === "ready" ? state.index : [];
  const i = index.findIndex((s) => s.id === id);
  const sutta = i >= 0 ? index[i] : null;

  useEffect(() => {
    if (sutta) document.title = `${titleOf(sutta)} | 초기불교경전`;
  }, [sutta]);

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <EmptyState
        icon={CloudOff}
        title="경 목록을 불러오지 못했습니다"
        description="인터넷 연결을 확인한 뒤 다시 시도해 주세요."
        action={<Button onClick={() => setAttempt((n) => n + 1)}>다시 시도</Button>}
      />
    );
  }
  if (!sutta) {
    return (
      <EmptyState
        icon={BookX}
        title="찾는 경이 없습니다"
        description={id ? `"${id}" 경은 아직 본문이 없거나 번호가 다릅니다.` : "경을 고르지 않았습니다."}
        action={
          <Link href="/suttas" className={buttonVariants()}>
            경전 목록으로
          </Link>
        }
      />
    );
  }

  const sameNikaya = (s: SuttaIndexEntry | undefined) =>
    s && s.nikaya === sutta.nikaya ? { id: s.id, title: titleOf(s) } : null;

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb sutta={sutta} />
      <PageHeader
        title={titleOf(sutta)}
        titleLang={sutta.nameKo ? undefined : "pi"}
        description={
          <>
            {sutta.id.toUpperCase()}
            {sutta.nameKo ? <span lang="pi"> · {sutta.name}</span> : null}
          </>
        }
      />
      {/* 경이 바뀌면 읽기 화면을 새로 그린다 (열어 둔 각주·사전 창 등을 비운다) */}
      <SuttaView
        key={sutta.id}
        suttaId={sutta.id}
        suttaTitle={titleOf(sutta)}
        editions={editions.filter((e) => sutta.editions.includes(e.id))}
        noteEditions={sutta.noteEditions}
        analysisEditions={{
          nissaya: editions.filter((e) => sutta.nissaya.includes(e.id)),
          grammar: editions.filter((e) => sutta.grammar.includes(e.id)),
        }}
        prev={sameNikaya(index[i - 1])}
        next={sameNikaya(index[i + 1])}
      />
    </div>
  );
}

/** 경 제목 위 위치 줄 — 경전 › 니까야 › 품 › 상윳따. 눌러서 다른 경으로 쉽게 옮겨 간다. */
function Breadcrumb({ sutta }: { sutta: SuttaIndexEntry }) {
  const { nikayaName, groups, groupPages } = sutta.trail;
  const items: { label: string; href?: string }[] = [
    { label: "경전", href: "/suttas" },
    { label: nikayaName, href: `/suttas/${sutta.nikaya}` },
    ...groups.map((g, i) => ({
      label: g.label,
      href:
        groupPages && i === groups.length - 1
          ? `/suttas/${sutta.nikaya}/${encodeURIComponent(g.id)}`
          : undefined,
    })),
  ];
  return (
    <nav aria-label="위치" className="-mb-2 print:hidden">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px] text-muted-foreground">
        {items.map((item, i) => (
          <Fragment key={`${i}-${item.label}`}>
            {i > 0 ? (
              <li aria-hidden className="flex">
                <ChevronRight className="size-3.5 opacity-60" />
              </li>
            ) : null}
            <li>
              {item.href ? (
                <Link href={item.href} className="rounded underline-offset-3 hover:text-foreground hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
