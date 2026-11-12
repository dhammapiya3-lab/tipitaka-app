"use client";

import { BookX, CloudOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Screen, SubBar } from "@/components/layout/app-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { SuttaView } from "@/components/sutta/sutta-view";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSuttaIndex } from "@/lib/content";
import { suttaLabel } from "@/lib/format";
import type { Edition, SuttaIndexEntry } from "@/types";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; index: SuttaIndexEntry[] };

const titleOf = (s: SuttaIndexEntry) => s.nameKo ?? s.name;

/** 주소의 ?id= 로 경을 찾아 SuttaView 를 그린다. 이전·다음 경은 같은 니까야 안에서. */
export function SuttaReader({ editions }: { editions: Edition[] }) {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  /** 경 목록에서 판본 하나를 골라 들어오면 (?ed=) 그 판본으로 연다 */
  const ed = params.get("ed");
  const router = useRouter();
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

  useEffect(() => {
    if (!sutta || !ed) return;
    // 주소에서 ?ed= 를 지운다 (고른 판본은 읽기 화면이 처음 한 번 받아 둔다)
    router.replace(`/sutta/?id=${encodeURIComponent(sutta.id)}${window.location.hash}`);
  }, [sutta, ed, router]);

  if (state.status === "loading") {
    return (
      <Screen className="flex flex-col gap-4 px-6 pt-6" aria-busy>
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </Screen>
    );
  }
  if (state.status === "error") {
    return (
      <>
      <SubBar title="경 읽기" backHref="/suttas" />
      <EmptyState
        icon={CloudOff}
        title="경 목록을 불러오지 못했습니다"
        description="인터넷 연결을 확인한 뒤 다시 시도해 주세요."
        action={<Button onClick={() => setAttempt((n) => n + 1)}>다시 시도</Button>}
      />
      </>
    );
  }
  if (!sutta) {
    return (
      <>
      <SubBar title="경 읽기" backHref="/suttas" />
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
      </>
    );
  }

  const sameNikaya = (s: SuttaIndexEntry | undefined) =>
    s && s.nikaya === sutta.nikaya ? { id: s.id, title: titleOf(s) } : null;

  const { nikayaName, groups, groupPages } = sutta.trail;
  const crumbs = [
    { label: "경", href: "/suttas" },
    { label: nikayaName, href: `/suttas/${sutta.nikaya}` },
    ...groups.map((g, i) => ({
      label: g.label,
      href:
        groupPages && i === groups.length - 1
          ? `/suttas/${sutta.nikaya}/${encodeURIComponent(g.id)}`
          : undefined,
    })),
    { label: suttaLabel(sutta.id) },
  ];

  // 경이 바뀌면 읽기 화면을 새로 그린다 (열어 둔 각주·사전 창 등을 비운다)
  return (
    <SuttaView
      key={sutta.id}
      initialEdition={ed}
      head={{
        title: titleOf(sutta),
        titleLang: sutta.nameKo ? undefined : "pi",
        crumbs,
        backHref: `/suttas/${sutta.nikaya}`,
      }}
      suttaId={sutta.id}
      suttaTitle={titleOf(sutta)}
      editions={editions.filter((e) => sutta.editions.includes(e.id))}
      noteEditions={sutta.noteEditions}
      commentary={sutta.commentary ?? []}
      paliName={sutta.name}
      analysisEditions={{
        nissaya: editions.filter((e) => sutta.nissaya.includes(e.id)),
        grammar: editions.filter((e) => sutta.grammar.includes(e.id)),
      }}
      prev={sameNikaya(index[i - 1])}
      next={sameNikaya(index[i + 1])}
    />
  );
}
