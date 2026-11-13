"use client";

import { ChevronLeft, ChevronRight, CloudOff } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineText } from "@/components/sutta/inline-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCommentary } from "@/lib/content";
import { cn } from "@/lib/utils";
import type { CommentaryLayer, Edition, SuttaCommentary } from "@/types";

/** 주석 원문 판본 — VRI 제6차 결집본 */
export const VRI_ID = "pli-vri";

/** 한 층에 책이 둘이면(디가 복주석서) 책마다 이름 — 옛 복주석서(purāṇaṭīkā) · 새 복주석서(abhinavaṭīkā) */
export function bookLabel(data: SuttaCommentary, bookId: string | undefined): string | null {
  if (data.books.length < 2) return null;
  const id = bookId ?? data.book;
  if (/-nt-/.test(id)) return "새 복주석서 (Abhinavaṭīkā)";
  if (/-pt-/.test(id)) return "옛 복주석서 (Purāṇaṭīkā)";
  return data.books.find((b) => b.id === id)?.name ?? id;
}

export const LAYER_NAME: Record<CommentaryLayer, string> = { attha: "주석서", tika: "복주석서" };

/**
 * 주석서·복주석서 — VRI 6차 결집본의 해당 문단들. 문단마다 이 경의 어느 문단을 풀이하는지 보여 주고,
 * 누르면 경의 그 문단으로 돌아간다. 빠알리 단어를 누르면 사전을 연다.
 */
export function CommentaryView({
  suttaId,
  layer,
  available,
  onGoParagraph,
  onWord,
  fontStyle,
  picked,
  paragraph,
  paragraphLabel,
  prev,
  next,
}: {
  /** 앞뒤 경 — 주석에서 앞뒤로 넘겨 읽는다 (Digital Pāḷi Reader 처럼) */
  prev?: { id: string; title: string } | null;
  next?: { id: string; title: string } | null;
  /** 문단별로 보기 중이면 그 경 문단 (예: sn56.11:2) — 그 문단을 풀이한 줄만 보인다 */
  paragraph?: string | null;
  paragraphLabel?: string;
  /** 고른 주석 판본 — VRI 원문(pli-vri)과 번역자 id */
  picked: string[];
  suttaId: string;
  layer: CommentaryLayer;
  available: boolean;
  onGoParagraph: (paragraph: string) => void;
  onWord: (word: string) => void;
  fontStyle?: React.CSSProperties;
}) {
  const [state, setState] = useState<{ key: string; data?: SuttaCommentary; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [showBefore, setShowBefore] = useState(false);
  const key = `${suttaId}/${layer}/${attempt}`;
  useEffect(() => {
    if (!available) return;
    let alive = true;
    fetchCommentary(suttaId, layer)
      .then((data) => alive && setState({ key, data }))
      .catch((e: unknown) => alive && setState({ key, error: e instanceof Error ? e.message : "오류" }));
    return () => {
      alive = false;
    };
  }, [available, suttaId, layer, key]);

  if (!available) {
    return (
      <p className="px-6 py-12 text-center text-sm text-faint">
        {layer === "attha" ? "주석서(Aṭṭhakathā)" : "복주석서(Ṭīkā)"} 콘텐츠 준비 중입니다.
      </p>
    );
  }
  const current = state?.key === key ? state : null;
  if (current?.error) {
    return (
      <EmptyState
        icon={CloudOff}
        title={`${LAYER_NAME[layer]}를 불러오지 못했습니다`}
        description={`${current.error}. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.`}
        action={<Button onClick={() => setAttempt((n) => n + 1)}>다시 시도</Button>}
      />
    );
  }
  const data = current?.data;
  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  // 문단별로 보기: 그 경 문단을 풀이한 줄만 (줄마다 풀이하는 경 문단이 적혀 있다)
  const only = paragraph
    ? data.paras.flatMap((para, i) => {
        const lines = para.lineRefs.flatMap((refs, j) => (refs.includes(paragraph) ? [j] : []));
        return lines.length ? [{ para, i, lines }] : [];
      })
    : null;

  const navLink = (to: { id: string; title: string }, dir: "prev" | "next") => (
    <Link
      href={`/sutta/?id=${encodeURIComponent(to.id)}&layer=${layer}`}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-bold text-primary hover:bg-amber-50"
    >
      {dir === "prev" ? <ChevronLeft className="size-4" aria-hidden /> : null}
      {dir === "prev" ? "앞 경의 " : "다음 경의 "}
      {LAYER_NAME[layer]}
      <span className="max-w-[12rem] truncate font-normal text-faint">· {to.title}</span>
      {dir === "next" ? <ChevronRight className="size-4" aria-hidden /> : null}
    </Link>
  );

  return (
    <div className="flex flex-col gap-4" style={fontStyle}>
      {/* 앞으로 넘기기: 이 경 앞에 있는, 어느 경에도 붙지 않은 주석(책·품 머리말, 이야기)이 먼저, 없으면 앞 경 */}
      {only ? null : data.before.length ? (
        <button
          type="button"
          aria-expanded={showBefore}
          onClick={() => setShowBefore((v) => !v)}
          className="inline-flex w-fit items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-bold text-primary hover:bg-amber-50"
        >
          <ChevronLeft className={cn("size-4 transition-transform", showBefore && "-rotate-90")} aria-hidden />
          {showBefore ? "앞 부분 접기" : "앞 부분 보기"}
          <span className="font-normal text-faint">· 책·품 머리말, 이야기 등 {data.before.length}문단</span>
        </button>
      ) : prev ? (
        navLink(prev, "prev")
      ) : null}
      {!only && showBefore
        ? data.before.map((para, i) => (
            <section key={`before-${i}`} className="overflow-hidden rounded-2xl border border-dashed bg-card/70 shadow-sm">
              <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-2.5 dark:border-border">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-muted">앞 부분</span>
                <span className="text-xs text-faint">
                  {data.book} {para.para}
                  {para.vripara ? ` · VRI ${para.vripara}` : ""}
                </span>
              </div>
              <div className="flex flex-col gap-3 px-5 py-4 font-pali break-words text-gray-800 dark:text-foreground" lang="pi">
                {para.lines.map((parts, j) => (
                  <p key={j}>
                    <InlineText parts={parts} onWord={onWord} />
                  </p>
                ))}
              </div>
            </section>
          ))
        : null}
      <p className="px-1 text-xs leading-relaxed text-faint">
        <span className="font-pali text-secondary-foreground">{data.bookName}</span> · VRI 제6차 결집본 —{" "}
        {only ? `${paragraphLabel ?? "이"} 문단을 풀이한 곳 ${only.length}개` : `이 경을 풀이한 문단 ${data.paras.length}개`}
      </p>
      {only && only.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-faint">
          이 문단을 풀이한 {LAYER_NAME[layer]} 내용이 없습니다.
        </p>
      ) : null}
      {data.books.length > 1 ? (
        // 옛·새 복주석서가 경 문단 차례대로 섞여 있다 — 카드 머리의 색 표시로 구분
        <p className="flex flex-wrap items-center gap-2 px-1 text-xs text-faint">
          {data.books.map((b, k) => (
            <span key={b.id} className="inline-flex items-center gap-1">
              <span className={cn("rounded px-1.5 py-0.5 font-bold", k ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-800")}>
                {bookLabel(data, k ? b.id : undefined)?.replace(/\s*\(.*\)$/, "")}
              </span>
              <span className="font-pali">{b.name}</span>
            </span>
          ))}
          <span>— 같은 경 문단의 풀이끼리 나란히</span>
        </p>
      ) : null}
      {(only ?? data.paras.map((para, i) => ({ para, i, lines: undefined }))).map(({ para, i, lines }) => (
        <Fragment key={i}>
        <CommentaryCard
          bookBadge={bookLabel(data, para.book)}
          key={i}
          layer={layer}
          index={i}
          para={para}
          onGoParagraph={onGoParagraph}
          onWord={onWord}
          picked={picked}
          editions={data.editions}
          onlyLines={lines}
        />
        </Fragment>
      ))}
      {!only && next ? <div className="flex justify-end">{navLink(next, "next")}</div> : null}
      <p className="px-1 text-xs leading-relaxed text-faint">
        출처: VRI Chaṭṭha Saṅgāyana Tipiṭaka · 문단 연결 E-Piṭaka (CC BY-NC 4.0)
      </p>
    </div>
  );
}

/** 주석서·복주석서 문단 하나 — 머리에 풀이하는 경 문단 번호(누르면 그 문단으로) */
export function CommentaryCard({
  layer,
  index,
  para,
  onGoParagraph,
  onWord,
  label,
  picked,
  editions,
  onlyLines,
  bookBadge,
}: {
  /** 책이 둘인 층에서 이 문단의 책 이름 (머리에 작게) */
  bookBadge?: string | null;
  /** 이 줄들만 보인다 (문단별로 보기) */
  onlyLines?: number[];
  picked: string[];
  /** 이 주석의 번역 판본 (배지에 쓴다) */
  editions: Edition[];
  layer: CommentaryLayer;
  index: number;
  para: SuttaCommentary["paras"][number];
  onGoParagraph?: (paragraph: string) => void;
  onWord: (word: string) => void;
  /** 머리 왼쪽에 붙일 이름 (나란히 보기·문단 보기에서 "주석서" 등) */
  label?: string;
}) {
  return (
    <section
      id={label ? undefined : `${layer}-${index}`}
      className="scroll-mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3 dark:border-border">
        <h3 className="mr-auto text-sm font-bold">
          {label ? <span className="mr-2 text-primary">{label}</span> : null}
          {bookBadge ? (
            <span
              className={cn(
                "mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold",
                /^새/.test(bookBadge) ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-800",
              )}
            >
              {bookBadge.replace(/\s*\(.*\)$/, "")}
            </span>
          ) : null}
          {index + 1}
          {para.vripara ? <span className="ml-2 text-xs font-medium text-faint">VRI {para.vripara}</span> : null}
        </h3>
        {para.refs.length && onGoParagraph ? <span className="text-xs text-faint">경 문단</span> : null}
        {onGoParagraph
          ? para.refs.map((ref) => (
              <button
                key={ref}
                type="button"
                title="경의 이 문단으로 가기"
                onClick={() => onGoParagraph(ref)}
                className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"
              >
                {ref.slice(ref.indexOf(":") + 1)}
              </button>
            ))
          : null}
      </div>
      <div className="flex flex-col gap-3 px-5 py-4 font-pali break-words text-gray-800 dark:text-foreground" lang="pi">
        {(() => {
          const trs = editions.filter((e) => picked.includes(e.id) && para.tr[e.id]);
          // 고른 번역이 이 문단에 없으면 빠알리 원문이라도 보인다
          const showPali = picked.includes(VRI_ID) || trs.length === 0;
          return para.lines.map((parts, j) =>
            (onlyLines && !onlyLines.includes(j)) || (!showPali && !trs.some((e) => para.tr[e.id]![j])) ? null : (
            <div key={j}>
              {showPali ? (
                <p>
                  <InlineText parts={parts} onWord={onWord} />
                </p>
              ) : null}
              {trs.map((e) =>
                para.tr[e.id]![j] ? (
                  <p
                    key={e.id}
                    className={cn(
                      "font-sans text-[0.9em] leading-relaxed text-gray-600 dark:text-muted-foreground",
                      showPali && "mt-1",
                    )}
                    lang="ko"
                  >
                    {trs.length > 1 || showPali ? (
                      <span className="mr-1.5 inline-flex rounded bg-primary px-1 text-[10px] font-bold text-primary-foreground align-middle">
                        {e.badge})
                      </span>
                    ) : null}
                    <InlineText parts={para.tr[e.id]![j]!} />
                  </p>
                ) : null,
              )}
            </div>
          ));
        })()}
      </div>
    </section>
  );
}
