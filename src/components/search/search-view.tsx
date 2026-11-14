"use client";

import { ChevronRight, CloudOff, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TopicMatches } from "@/components/search/topic-matches";
import {
  AbbreviationGuide,
  NumberMatches,
} from "@/components/search/number-matches";
import {
  fetchSuttaText,
  fetchSuttaTitles,
  searchText,
  type SearchHits,
} from "@/lib/content";
import { findSuttas } from "@/lib/sutta-number";
import { formatCount, suttaHref } from "@/lib/format";
import { highlightParts, minQueryLength, tokenize } from "@/lib/search";
import { compareSegmentKeys, plainText } from "@/lib/segments";
import { cn } from "@/lib/utils";
import type { Edition, Language, SuttaText } from "@/types";

/** 검색 결과에 쓰는 경 정보 (목록 순서대로) */
export interface SearchableSutta {
  id: string;
  title: string;
  /** 빠알리 이름 (제목으로 찾기) */
  name: string;
  label: string;
}

type Scope = "all" | Language;
const SCOPES: { id: Scope; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "ko", label: "한국어" },
  { id: "pli", label: "빠알리" },
  { id: "en", label: "영어" },
];
const PAGE = 20;
/** 경마다 보여 줄 문장 수 */
const SNIPPETS = 3;

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; hits: SearchHits };

// 결과 문장을 보여 주려고 받은 본문은 기억해 둔다 (같은 경을 여러 번 받지 않게)
const textCache = new Map<string, Promise<SuttaText>>();
function cachedText(suttaId: string, editionId: string) {
  const key = `${suttaId}|${editionId}`;
  let p = textCache.get(key);
  if (!p) {
    p = fetchSuttaText(suttaId, editionId);
    textCache.set(key, p);
    p.catch(() => textCache.delete(key));
  }
  return p;
}

/**
 * 경 본문 검색 — 찾은 단어와 범위는 주소(?q=&lang=)에 남아 그대로 공유할 수 있다.
 * 띄어쓴 단어는 모두 같은 문장에 있어야 하고, 각 단어는 앞부분 일치다.
 */
export function SearchView({
  suttas,
  editions,
}: {
  suttas: SearchableSutta[];
  editions: Edition[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = params.get("q")?.trim() ?? "";
  const scope = (SCOPES.find((s) => s.id === params.get("lang"))?.id ??
    "all") satisfies Scope;
  const [input, setInput] = useState(q);
  const [state, setState] = useState<State & { key: string }>({
    status: "idle",
    key: "",
  });
  const [shown, setShown] = useState(PAGE);
  /** 한국어 번역들의 경 제목 — 제목으로 찾기 (한 번만 받는다) */
  const [koTitles, setKoTitles] = useState<Record<string, string[]>>({});
  useEffect(() => {
    let alive = true;
    fetchSuttaTitles().then((t) => alive && setKoTitles(t));
    return () => {
      alive = false;
    };
  }, []);
  const found = useMemo(
    () => (q ? findSuttas(q, suttas, koTitles) : null),
    [q, suttas, koTitles],
  );
  const searchKey = `${q}|${scope}`;

  function go(nextQ: string, nextScope: Scope) {
    const sp = new URLSearchParams();
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    if (nextScope !== "all") sp.set("lang", nextScope);
    router.replace(sp.size ? `${pathname}?${sp}` : pathname);
    setShown(PAGE);
  }

  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    const languages: Language[] =
      scope === "all" ? ["ko", "pli", "en"] : [scope];
    searchText(q, languages)
      .then((hits) => {
        if (!cancelled) setState({ status: "ready", hits, key: searchKey });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", key: searchKey });
      });
    return () => {
      cancelled = true;
    };
  }, [q, scope, searchKey]);

  // 경별로 묶고 목록 순서대로: 경 → [문장 번호, 판본]
  const order = useMemo(
    () => new Map(suttas.map((s, i) => [s.id, i])),
    [suttas],
  );
  const grouped = useMemo(() => {
    if (state.status !== "ready") return [];
    const bySutta = new Map<string, Map<string, string>>();
    for (const [doc, keys] of state.hits) {
      const [suttaId, editionId] = doc.split("|");
      const rows = bySutta.get(suttaId) ?? new Map<string, string>();
      for (const key of keys) if (!rows.has(key)) rows.set(key, editionId);
      bySutta.set(suttaId, rows);
    }
    return [...bySutta]
      .filter(([id]) => order.has(id))
      .sort(([a], [b]) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
      .map(([id, rows]) => ({
        sutta: suttas[order.get(id) ?? 0],
        rows: [...rows].sort(([a], [b]) => compareSegmentKeys(a, b)),
      }));
  }, [state, order, suttas]);

  const tooShort =
    q && tokenize(q, "ko").every((t) => [...t].length < minQueryLength(t));
  const loading =
    q && !tooShort && (state.key !== searchKey || state.status === "loading");
  const sentenceCount = grouped.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4">
      <form
        className="flex gap-2"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(input, scope);
        }}
      >
        <div className="relative flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="search-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="찾을 말 · 경 번호 · 경 제목 (예: 마음챙김, DN 22, 대념처경)"
            aria-label="찾을 말"
            className="h-10 pl-9"
          />
        </div>
        <Button type="submit" className="h-10">
          찾기
        </Button>
      </form>

      <div
        className="flex rounded-lg bg-muted p-0.5 sm:w-fit"
        role="group"
        aria-label="찾을 언어"
      >
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={scope === s.id}
            onClick={() => go(input, s.id)}
            className={cn(
              "h-9 flex-1 shrink-0 rounded-md px-5 text-sm whitespace-nowrap transition-colors outline-none sm:flex-none focus-visible:ring-3 focus-visible:ring-ring/50",
              scope === s.id
                ? "bg-card font-semibold text-primary shadow-sm"
                : "font-medium text-muted-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 경 번호(DN 22)·책 이름(법구경)·경 제목(대념처경)으로 찾은 경 */}
      {found ? <NumberMatches found={found} query={q} /> : null}

      {/* ATI 주제 이름에 찾을 말이 들어 있으면 그 주제의 경들도 함께 */}
      {q && !tooShort ? <TopicMatches query={q} suttas={suttas} /> : null}

      {!q ? (
        <>
          <EmptyState
            icon={Search}
            title="경 본문·경 번호·경 제목으로 찾습니다"
            description="띄어 쓴 말은 모두 한 문장에 있는 것만 찾습니다. 빠알리는 ā·ṭ 없이 쳐도 됩니다."
          />
          <AbbreviationGuide
            onPick={(example) => {
              setInput(example);
              go(example, scope);
            }}
          />
        </>
      ) : tooShort ? (
        <EmptyState
          icon={Search}
          title="조금 더 길게 넣어 주세요"
          description="로마자는 두 글자 이상이어야 찾습니다."
        />
      ) : loading ? (
        <div className="flex flex-col gap-3" aria-busy>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : state.status === "error" ? (
        <EmptyState
          icon={CloudOff}
          title="검색에 실패했습니다"
          description="인터넷 연결을 확인한 뒤 다시 시도해 주세요."
          action={<Button onClick={() => go(q, scope)}>다시 시도</Button>}
        />
      ) : grouped.length === 0 && found ? null : grouped.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={`“${q}”을(를) 찾지 못했습니다`}
          description="다른 말이나 다른 언어로 찾아 보세요."
        />
      ) : (
        <>
          <p className="t-sub">
            경 {formatCount(grouped.length)}개 · 문장{" "}
            {formatCount(sentenceCount)}개
          </p>
          {grouped.slice(0, shown).map(({ sutta, rows }) => (
            <Card key={sutta.id} className="gap-0 p-0">
              <Link
                href={suttaHref(sutta.id)}
                className="flex items-center gap-3 border-b px-5 py-3 hover:bg-hover"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="t-card truncate">{sutta.title}</span>
                  <span className="t-meta">
                    {sutta.label} · 문장 {formatCount(rows.length)}개
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
              <ul className="flex flex-col">
                {rows.slice(0, SNIPPETS).map(([key, editionId]) => (
                  <li key={key}>
                    <Snippet
                      suttaId={sutta.id}
                      rowKey={key}
                      edition={editions.find((e) => e.id === editionId)}
                      query={q}
                    />
                  </li>
                ))}
              </ul>
              {rows.length > SNIPPETS ? (
                <p className="t-meta px-5 pb-3">
                  그 밖에 {formatCount(rows.length - SNIPPETS)}문장
                </p>
              ) : null}
            </Card>
          ))}
          {grouped.length > shown ? (
            <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
              경 {formatCount(Math.min(PAGE, grouped.length - shown))}개 더 보기
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

/** 찾은 문장 한 줄 — 본문을 받아 찾은 단어를 표시한다 */
function Snippet({
  suttaId,
  rowKey,
  edition,
  query,
}: {
  suttaId: string;
  rowKey: string;
  edition: Edition | undefined;
  query: string;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!edition) return;
    let cancelled = false;
    cachedText(suttaId, edition.id)
      .then((t) => {
        const segment = t.segments.find((s) => s.key === rowKey);
        if (!cancelled) setText(segment ? plainText(segment.parts) : "");
      })
      .catch(() => {
        if (!cancelled) setText("");
      });
    return () => {
      cancelled = true;
    };
  }, [suttaId, rowKey, edition]);

  const language = edition?.language ?? "ko";
  const tokens = tokenize(query, language);
  return (
    <Link
      href={suttaHref(suttaId, rowKey)}
      className="flex flex-col gap-1 px-5 py-3 hover:bg-hover"
    >
      {text === null ? (
        <Skeleton className="h-5 w-3/4" />
      ) : (
        <span
          lang={language === "pli" ? "pi" : language}
          className="line-clamp-3"
        >
          {highlightParts(text, tokens, language).map((p, i) =>
            p.hit ? (
              <mark
                key={i}
                className="rounded-sm bg-brand-soft px-0.5 font-semibold text-brand-ink"
              >
                {p.text}
              </mark>
            ) : (
              <span key={i}>{p.text}</span>
            ),
          )}
        </span>
      )}
      <span className="t-meta">
        {rowKey.slice(rowKey.indexOf(":") + 1)} · {edition?.label ?? ""}
      </span>
    </Link>
  );
}
