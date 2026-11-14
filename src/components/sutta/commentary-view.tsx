"use client";

import { ChevronLeft, ChevronRight, CloudOff } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineText } from "@/components/sutta/inline-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCommentary } from "@/lib/content";
import { useSettingsStore } from "@/store/settings";
import type { PageMark } from "@/lib/page-marks";
import { cn } from "@/lib/utils";
import type { CommentaryLayer, Edition, SuttaCommentary } from "@/types";

/** 주석 원문 판본 — VRI 제6차 결집본 */
export const VRI_ID = "pli-vri";

/** 한 층에 책이 둘이면(디가 복주석서) 책마다 이름 — 옛 복주석서(purāṇaṭīkā) · 새 복주석서(abhinavaṭīkā) */
export function bookLabel(
  data: SuttaCommentary,
  bookId: string | undefined,
): string | null {
  if (data.books.length < 2) return null;
  const id = bookId ?? data.book;
  if (/-nt-/.test(id)) return "새 복주석서 (Abhinavaṭīkā)";
  if (/-pt-/.test(id)) return "옛 복주석서 (Purāṇaṭīkā)";
  return data.books.find((b) => b.id === id)?.name ?? id;
}

/** 이 문단이 책 목록의 몇 번째 책인가 (책이 하나면 0) */
export function bookIndexOf(
  data: SuttaCommentary,
  bookId: string | undefined,
): number {
  const k = data.books.findIndex((b) => b.id === (bookId ?? data.book));
  return k < 0 ? 0 : k;
}

/** 복주석서가 여럿일 때(디가: 옛·새 복주석서) 볼 책을 고르는 단추 — 모두 · 옛 복주석서 · 새 복주석서 */
export function BookSwitch({
  data,
  value,
  onChange,
  className,
}: {
  data: SuttaCommentary;
  value: number | null;
  onChange: (book: number | null) => void;
  className?: string;
}) {
  if (data.books.length < 2) return null;
  const options: { k: number | null; label: string; tone: string }[] = [
    { k: null, label: "모두", tone: "" },
    ...data.books.map((b, k) => ({
      k,
      label:
        bookLabel(data, k ? b.id : undefined)?.replace(/\s*\(.*\)$/, "") ??
        b.name,
      tone: k ? "text-violet-700" : "text-amber-800",
    })),
  ];
  const current = value !== null && value < data.books.length ? value : null;
  return (
    <span
      role="group"
      aria-label="복주석서 고르기"
      className={cn(
        "inline-flex rounded-lg border bg-card p-0.5 font-sans text-xs font-bold",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={String(o.k)}
          type="button"
          aria-pressed={current === o.k}
          title={
            o.k === null
              ? "두 복주석서를 경 문단 차례대로 함께"
              : data.books[o.k]?.name
          }
          onClick={() => onChange(o.k)}
          className={cn(
            "rounded-md px-2 py-0.5 transition-colors",
            current === o.k
              ? "bg-primary text-primary-foreground"
              : cn("hover:bg-hover", o.tone || "text-muted-foreground"),
          )}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

export const LAYER_NAME: Record<CommentaryLayer, string> = {
  attha: "주석서",
  tika: "복주석서",
};

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
  pageMarksOf,
}: {
  /** 줄의 인쇄본 쪽 표시 (키: c:<책>:<문단>:<줄>) */
  pageMarksOf?: (key: string) => PageMark[] | undefined;
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
  /** 없으면 카드 머리에 "경 문단" 단추를 두지 않는다 (경 칸이 없는 주석 문헌) */
  onGoParagraph?: (paragraph: string) => void;
  onWord: (word: string) => void;
  fontStyle?: React.CSSProperties;
}) {
  const [state, setState] = useState<{
    key: string;
    data?: SuttaCommentary;
    error?: string;
  } | null>(null);
  const tikaBook = useSettingsStore((s) => s.tikaBook);
  const setTikaBook = useSettingsStore((s) => s.setTikaBook);
  const [attempt, setAttempt] = useState(0);
  const [showBefore, setShowBefore] = useState(false);
  const key = `${suttaId}/${layer}/${attempt}`;
  useEffect(() => {
    if (!available) return;
    let alive = true;
    fetchCommentary(suttaId, layer)
      .then((data) => alive && setState({ key, data }))
      .catch(
        (e: unknown) =>
          alive &&
          setState({ key, error: e instanceof Error ? e.message : "오류" }),
      );
    return () => {
      alive = false;
    };
  }, [available, suttaId, layer, key]);

  if (!available) {
    return (
      <p className="px-6 py-12 text-center text-sm text-faint">
        {layer === "attha" ? "주석서(Aṭṭhakathā)" : "복주석서(Ṭīkā)"} 콘텐츠
        준비 중입니다.
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
        action={
          <Button onClick={() => setAttempt((n) => n + 1)}>다시 시도</Button>
        }
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
        const lines = para.lineRefs.flatMap((refs, j) =>
          refs.includes(paragraph) ? [j] : [],
        );
        return lines.length ? [{ para, i, lines }] : [];
      })
    : null;

  /** 어느 경 문단에도 붙지 않은 주석 — 앞 부분(머리말 등) · 끝 부분(맺음말 등) */
  // 주석서 책의 원래 제목(Ganthārambhakathā, Pakiṇṇakakathā 등)은 바뀌는 곳에서만 크게 보인다
  const extraCard = (
    para: SuttaCommentary["before"][number],
    i: number,
    label: string,
    list: SuttaCommentary["before"],
  ) => (
    <section
      key={`${label}-${i}`}
      className="overflow-hidden rounded-2xl border border-dashed bg-card/70 shadow-sm"
    >
      {para.title && para.title !== list[i - 1]?.title ? (
        <p
          lang="pi"
          className="border-b border-gray-100 bg-gray-50 px-5 py-2 font-pali text-sm font-bold text-secondary-foreground dark:border-border dark:bg-muted"
        >
          {para.title}
        </p>
      ) : null}
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-2.5 dark:border-border">
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-muted">
          {label}
        </span>
        <span className="text-xs text-faint">
          {data.book} {para.para}
          {para.vripara ? ` · VRI ${para.vripara}` : ""}
        </span>
      </div>
      <div
        className="flex flex-col gap-3 px-5 py-4 font-pali break-words text-gray-800 dark:text-foreground"
        lang="pi"
      >
        {para.lines.map((parts, j) => (
          <p key={j}>
            <PageBadges
              marks={pageMarksOf?.(`c:${data.book}:${para.para}:${j}`)}
            />
            <InlineText parts={parts} onWord={onWord} variants />
          </p>
        ))}
      </div>
    </section>
  );

  const navLink = (to: { id: string; title: string }, dir: "prev" | "next") => (
    <Link
      href={`/sutta/?id=${encodeURIComponent(to.id)}&layer=${layer}`}
      title={`${dir === "prev" ? "앞" : "다음"} 경의 ${LAYER_NAME[layer]} · ${to.title}`}
      className="inline-flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-bold text-primary hover:bg-amber-50"
    >
      {dir === "prev" ? (
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
      ) : null}
      <span className="shrink-0">{dir === "prev" ? "이전" : "다음"}</span>
      <span className="max-w-[12rem] truncate font-normal text-faint">
        · {to.title}
      </span>
      {dir === "next" ? (
        <ChevronRight className="size-4 shrink-0" aria-hidden />
      ) : null}
    </Link>
  );

  return (
    <div className="flex flex-col gap-4" style={fontStyle}>
      {/* 이전 · 다음 (한 줄) — 이전: 이 경 앞에 붙은 주석(책·품 머리말 등)을 펼치고, 없으면 앞 경의 주석. 다음: 다음 경의 주석 */}
      {only ? null : data.before.length || prev || next ? (
        <div className="flex items-center justify-between gap-3">
          {data.before.length ? (
            <button
              type="button"
              aria-expanded={showBefore}
              onClick={() => setShowBefore((v) => !v)}
              className="inline-flex min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-bold text-primary hover:bg-amber-50"
            >
              <ChevronLeft
                className={cn(
                  "size-4 shrink-0 transition-transform",
                  showBefore && "-rotate-90",
                )}
                aria-hidden
              />
              <span className="shrink-0">
                {showBefore ? "이전 접기" : "이전"}
              </span>
              <span className="truncate font-normal text-faint">
                ·{" "}
                {[...new Set(data.before.map((p) => p.title).filter(Boolean))]
                  .slice(0, 3)
                  .join(" · ") || "책·품 머리말, 이야기 등"}{" "}
                ({data.before.length}문단)
              </span>
            </button>
          ) : prev ? (
            navLink(prev, "prev")
          ) : (
            <span />
          )}
          {next ? navLink(next, "next") : null}
        </div>
      ) : null}
      {!only && showBefore
        ? data.before.map((para, i, list) =>
            extraCard(para, i, "앞 부분", list),
          )
        : null}
      <p className="px-1 text-xs leading-relaxed text-faint">
        <span className="font-pali text-secondary-foreground">
          {data.bookName}
        </span>{" "}
        ·{" "}
        {/^Jātaka-abhinavaṭīkā/.test(data.bookName)
          ? "자따까 새 복주석서"
          : "VRI 제6차 결집본"}{" "}
        —{" "}
        {only
          ? `${paragraphLabel ?? "이"} 문단을 풀이한 곳 ${only.length}개`
          : `이 경을 풀이한 문단 ${data.paras.length}개`}
      </p>
      {only && only.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-faint">
          이 문단을 풀이한 {LAYER_NAME[layer]} 내용이 없습니다.
        </p>
      ) : null}
      {data.books.length > 1 ? (
        // 옛·새 복주석서가 경 문단 차례대로 섞여 있다 — 카드 머리의 색 표시로 구분
        <p className="flex flex-wrap items-center gap-2 px-1 text-xs text-faint">
          <BookSwitch data={data} value={tikaBook} onChange={setTikaBook} />
          {data.books.map((b, k) => (
            <span key={b.id} className="inline-flex items-center gap-1">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-bold",
                  k
                    ? "bg-violet-50 text-violet-700"
                    : "bg-amber-50 text-amber-800",
                )}
              >
                {bookLabel(data, k ? b.id : undefined)?.replace(
                  /\s*\(.*\)$/,
                  "",
                )}
              </span>
              <span className="font-pali">{b.name}</span>
            </span>
          ))}
          <span>— 같은 경 문단의 풀이끼리 나란히</span>
        </p>
      ) : null}
      {(
        only ??
        data.paras.map((para, i) => ({
          para,
          i,
          lines: undefined as number[] | undefined,
        }))
      )
        .filter(
          ({ para }) =>
            tikaBook === null ||
            data.books.length < 2 ||
            bookIndexOf(data, para.book) === tikaBook,
        )
        .map(({ para, i, lines }) => (
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
              bookId={data.book}
              pageMarksOf={pageMarksOf}
            />
          </Fragment>
        ))}
      {/* 책 맨 끝(마지막 경 뒤)의 맺음말 등 */}
      {!only && data.after.length ? (
        <>
          {data.after.map((para, i, list) =>
            extraCard(para, i, "끝 부분", list),
          )}
        </>
      ) : null}
      {!only && next ? (
        <div className="flex justify-end">{navLink(next, "next")}</div>
      ) : null}
      <p className="px-1 text-xs leading-relaxed text-faint">
        {/^Jātaka-abhinavaṭīkā/.test(data.bookName)
          ? "출처: Jātaka-abhinavaṭīkā (Paññāsāmī, 만달레이 1868) — E-Piṭaka (CC BY-NC 4.0) · VRI 공식 원문에 없는 책이라 E-Piṭaka 글을 그대로 씁니다"
          : "출처: VRI Chaṭṭha Saṅgāyana Tipiṭaka · 문단 연결 E-Piṭaka (CC BY-NC 4.0)"}
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
  bookId,
  pageMarksOf,
}: {
  /** 이 문단이 든 책 (쪽 번호 찾기용 — 예: Spk-v) */
  bookId?: string;
  /** 줄의 인쇄본 쪽 표시 (키: c:<책>:<문단>:<줄>) */
  pageMarksOf?: (key: string) => PageMark[] | undefined;
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
                /^새/.test(bookBadge)
                  ? "bg-violet-50 text-violet-700"
                  : "bg-amber-50 text-amber-800",
              )}
            >
              {bookBadge.replace(/\s*\(.*\)$/, "")}
            </span>
          ) : null}
          {index + 1}
          {para.vripara ? (
            <span className="ml-2 text-xs font-medium text-faint">
              VRI {para.vripara}
            </span>
          ) : null}
        </h3>
        {para.refs.length && onGoParagraph ? (
          <span className="text-xs text-faint">경 문단</span>
        ) : null}
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
      <div
        className="flex flex-col gap-3 px-5 py-4 font-pali break-words text-gray-800 dark:text-foreground"
        lang="pi"
      >
        {(() => {
          const trs = editions.filter(
            (e) => picked.includes(e.id) && para.tr[e.id],
          );
          // 고른 번역이 이 문단에 없으면 빠알리 원문이라도 보인다
          const showPali = picked.includes(VRI_ID) || trs.length === 0;
          return para.lines.map((parts, j) =>
            (onlyLines && !onlyLines.includes(j)) ||
            (!showPali && !trs.some((e) => para.tr[e.id]![j])) ? null : (
              <div key={j}>
                {showPali ? (
                  <p>
                    <PageBadges
                      marks={pageMarksOf?.(
                        `c:${para.book ?? bookId}:${para.para}:${j}`,
                      )}
                    />
                    <InlineText parts={parts} onWord={onWord} variants />
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
            ),
          );
        })()}
      </div>
    </section>
  );
}

/** 인쇄본 쪽이 바뀌는 줄 — 줄 앞에 작게 (텍스트 설정의 '책 쪽 번호'를 켰을 때) */
function PageBadges({ marks }: { marks?: PageMark[] }) {
  if (!marks?.length) return null;
  return (
    <>
      {marks.map((m) => (
        <span
          key={m.label}
          title={m.title}
          className="mr-1.5 inline-flex cursor-help rounded bg-gray-100 px-1 py-0.5 align-middle font-sans text-[10px] leading-none text-faint select-none dark:bg-muted"
        >
          {m.label}
        </span>
      ))}
    </>
  );
}
