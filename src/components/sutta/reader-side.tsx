"use client";

import { ExternalLink, MousePointerClick } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  WordPanelBody,
  type AnalysisEditions,
  type WordTarget,
} from "@/components/dictionary/word-sheet";
import { ParallelList, type useParallels } from "@/components/sutta/parallels";
import type { BookToc, TocEntry } from "@/components/sutta/reader-sheets";
import { fetchExtras, fetchSuttaText } from "@/lib/content";
import { paragraphMark, paragraphOf, plainText, rowKind } from "@/lib/segments";
import { suttaHref, suttaLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ExtraKind, SuttaExtras } from "@/types";

export type SidePanel = "toc" | "analysis" | ExtraKind;

const EXTRA_TABS: { id: ExtraKind; label: string; empty: string }[] = [
  {
    id: "refs",
    label: "참고 경전",
    empty: "이 경과 함께 읽으면 좋은 경을 모으고 있습니다.",
  },
  {
    id: "talks",
    label: "해설 법문",
    empty: "이 경을 풀어 설한 법문(글·음성·영상)을 모으고 있습니다.",
  },
  {
    id: "others",
    label: "기타 자료",
    empty: "이 경에 관한 그 밖의 자료를 모으고 있습니다.",
  },
];

/**
 * 넓은 화면 경 읽기의 오른쪽 칸 — 위아래로 내려도 그 자리에 붙어 있다.
 * 평소에는 이 경의 목차(지금 읽는 문단은 호박색), 문장·단어·배지를 누르면 같은 자리가 대역·문법분석·사전.
 */
export function ReaderSide({
  panel,
  onPanel,
  toc,
  book,
  tocEdition,
  current,
  onPick,
  word,
  suttaId,
  analysisEditions,
  onCloseWord,
  parallels,
}: {
  panel: SidePanel;
  onPanel: (panel: SidePanel) => void;
  toc: TocEntry[];
  /** 이 문헌의 장(경)들 — 목차 위에 장 탭으로 */
  book?: BookToc;
  /** 다른 장의 목차를 읽어 올 판본 (지금 보이는 첫 판본) */
  tocEdition?: string;
  current: string | null;
  onPick: (paragraph: string) => void;
  word: WordTarget | null;
  suttaId: string;
  analysisEditions: AnalysisEditions;
  onCloseWord: () => void;
  /** 병행 경전 — '참고 경전' 칸 맨 위에 관계별로 */
  parallels?: ReturnType<typeof useParallels>;
}) {
  const [extras, setExtras] = useState<SuttaExtras | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchExtras()
      .then((all) => {
        if (!cancelled) setExtras(all[suttaId] ?? {});
      })
      .catch(() => {
        if (!cancelled) setExtras({});
      });
    return () => {
      cancelled = true;
    };
  }, [suttaId]);

  const tab = (id: "toc" | "analysis", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={panel === id}
      onClick={() => onPanel(id)}
      className={cn(
        "flex-1 rounded-lg py-2 text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        panel === id
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
  return (
    <aside
      aria-label="목차와 풀이"
      className={cn(
        "sticky top-4 flex h-[calc(100vh-2rem)] shrink-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-[width] print:hidden",
        // 풀이(문법분석·사전)를 볼 때는 화면에 여유가 있는 만큼 넓힌다
        panel === "analysis" && word
          ? "w-[340px] xl:w-[440px] 2xl:w-[560px]"
          : "w-[340px]",
      )}
    >
      {/* 덧붙임 자료 — 참고 경전 · 해설 법문 · 기타 자료 */}
      <div
        className="grid shrink-0 grid-cols-3 gap-1.5 px-3 pt-3"
        role="tablist"
        aria-label="덧붙임 자료"
      >
        {EXTRA_TABS.map((t) => {
          const count =
            (extras?.[t.id]?.length ?? 0) +
            (t.id === "refs" ? (parallels?.links.length ?? 0) : 0);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={panel === t.id}
              onClick={() => onPanel(t.id)}
              className={cn(
                "rounded-lg border py-1.5 text-xs font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                panel === t.id
                  ? "border-primary bg-brand-soft text-primary"
                  : "bg-card text-muted-foreground hover:border-amber-200 hover:bg-amber-50 dark:hover:bg-muted",
              )}
            >
              {t.label}
              {count > 0 ? (
                <span className="ml-1 text-primary">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div
        className="flex shrink-0 gap-1.5 p-3"
        role="tablist"
        aria-label="오른쪽 칸"
      >
        {tab("toc", "목차")}
        {tab("analysis", "풀이")}
      </div>
      {panel === "refs" && parallels && parallels.links.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto border-t px-3 pb-3">
          <ParallelList
            suttaId={suttaId}
            links={parallels.links}
            names={parallels.names}
          />
          {(extras?.refs ?? []).length > 0 ? (
            <ExtraList
              items={extras?.refs ?? []}
              loading={false}
              empty=""
              heading="참고 경전"
            />
          ) : null}
        </div>
      ) : panel === "refs" || panel === "talks" || panel === "others" ? (
        <ExtraList
          items={extras?.[panel] ?? []}
          loading={extras === null}
          empty={EXTRA_TABS.find((t) => t.id === panel)!.empty}
          heading={EXTRA_TABS.find((t) => t.id === panel)!.label}
        />
      ) : panel === "toc" ? (
        <TocPanel
          toc={toc}
          book={book}
          tocEdition={tocEdition}
          suttaId={suttaId}
          current={current}
          onPick={onPick}
        />
      ) : word ? (
        <div className="flex min-h-0 flex-1 flex-col border-t">
          <WordPanelBody
            key={`${word.rowKey} ${word.word} ${word.tab} ${word.keys.length}`}
            target={word}
            suttaId={suttaId}
            analysisEditions={analysisEditions}
            onClose={onCloseWord}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <MousePointerClick className="size-6 text-faint" aria-hidden />
          <p className="text-sm text-muted-foreground">
            문장이나 빠알리 단어, <b className="text-violet-700">문법분석</b>·
            <b className="text-sky-700">대역</b> 배지를 누르면 여기에 풀이가
            나옵니다.
          </p>
        </div>
      )}
    </aside>
  );
}

function ExtraList({
  items,
  loading,
  empty,
  heading,
}: {
  items: NonNullable<SuttaExtras["refs"]>;
  loading: boolean;
  empty: string;
  heading: string;
}) {
  if (loading)
    return <p className="px-4 py-6 text-sm text-faint">불러오는 중…</p>;
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center gap-1 border-t px-6 pt-10 text-center">
        <p className="text-sm font-bold text-secondary-foreground">
          {heading} — 준비 중
        </p>
        <p className="text-sm text-muted-foreground">{empty}</p>
      </div>
    );
  }
  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto border-t p-3">
      {items.map((item, i) => {
        const body = (
          <>
            <span className="flex items-start gap-1.5 text-sm font-bold">
              <span className="min-w-0 flex-1 break-keep">{item.title}</span>
              {item.url && !item.suttaId ? (
                <ExternalLink
                  className="mt-0.5 size-3.5 shrink-0 text-faint"
                  aria-hidden
                />
              ) : null}
            </span>
            {item.suttaId || item.by ? (
              <span className="mt-0.5 block text-xs text-primary">
                {item.suttaId ? suttaLabel(item.suttaId) : null}
                {item.suttaId && item.by ? " · " : null}
                {item.by}
              </span>
            ) : null}
            {item.note ? (
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {item.note}
              </span>
            ) : null}
          </>
        );
        const cls =
          "block rounded-xl border bg-gray-50 px-3.5 py-3 outline-none transition-colors hover:border-amber-200 hover:bg-amber-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-muted";
        return (
          <li key={`${i}-${item.title}`}>
            {item.suttaId ? (
              <Link
                href={suttaHref(
                  item.suttaId,
                  item.anchor ?? undefined,
                  item.layer ?? undefined,
                )}
                className={cls}
              >
                {body}
              </Link>
            ) : item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cls}
              >
                {body}
              </a>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** 장 탭 이름 — 청정도론은 "1장", 나머지는 경 번호(DN 1) */
function chapterTab(ch: BookToc["chapters"][number]): string {
  return /^\d+장/.exec(ch.title)?.[0] ?? ch.sub;
}

/** 다른 장의 목차 — 그 장의 본문을 읽어 문단 번호와 단락 제목을 뽑는다 (문단 → 첫 문장 번호) */
async function loadChapterToc(
  id: string,
  editionId: string | undefined,
): Promise<(TocEntry & { firstKey: string })[]> {
  const text = await (editionId
    ? fetchSuttaText(id, editionId).catch(() => fetchSuttaText(id, "pli-vri"))
    : fetchSuttaText(id, "pli-vri"));
  const out = new Map<string, TocEntry & { firstKey: string }>();
  let pending: string[] = [];
  for (const seg of text.segments) {
    const kind = rowKind(seg.key, id);
    if (kind === "hidden") continue;
    if (kind === "heading") {
      const s = plainText(seg.parts).trim();
      if (s) pending.push(s);
      continue;
    }
    const p = paragraphOf(seg.key, id);
    if (!out.has(p)) {
      out.set(p, {
        paragraph: p,
        label: paragraphMark(p),
        title: pending.length ? pending.join(" · ") : undefined,
        firstKey: seg.key,
      });
    }
    pending = [];
  }
  return [...out.values()];
}

/**
 * 오른쪽 칸 목차 — 위에 장 탭(1장·2장… 또는 DN 1·DN 2…), 처음에는 지금 읽는 장.
 * 다른 장 탭을 누르면 그 장의 세부 목차가 뜨고, 항목을 누르면 그 장의 그 문단으로 간다.
 */
function TocPanel({
  toc,
  book,
  tocEdition,
  suttaId,
  current,
  onPick,
}: {
  toc: TocEntry[];
  book?: BookToc;
  tocEdition?: string;
  suttaId: string;
  current: string | null;
  onPick: (paragraph: string) => void;
}) {
  const [chosen, setChosen] = useState(suttaId);
  const [other, setOther] = useState<{
    id: string;
    items: (TocEntry & { firstKey: string })[] | "loading" | "error";
  } | null>(null);
  const viewing = chosen === suttaId ? null : chosen;
  useEffect(() => {
    if (!viewing) return;
    let alive = true;
    loadChapterToc(viewing, tocEdition)
      .then((items) => alive && setOther({ id: viewing, items }))
      .catch(() => alive && setOther({ id: viewing, items: "error" }));
    return () => {
      alive = false;
    };
  }, [viewing, tocEdition]);
  const chapters = book && book.chapters.length > 1 ? book.chapters : null;
  const otherItems = viewing && other?.id === viewing ? other.items : "loading";
  const row = (
    key: string,
    label: string,
    title: string | undefined,
    on: boolean,
  ) => (
    <>
      <span
        className={cn(
          "w-9 shrink-0 font-pali",
          on ? "text-primary" : "text-faint",
        )}
      >
        {label}
      </span>
      <span key={key} className="min-w-0 break-keep">
        {title ?? ""}
      </span>
    </>
  );
  const itemClass = (on: boolean) =>
    cn(
      "flex w-full gap-2.5 border-l-2 px-3.5 py-2 text-left text-sm transition-colors outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50",
      on
        ? "border-primary bg-brand-soft font-bold text-foreground"
        : "border-transparent text-secondary-foreground",
    );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {chapters ? (
        <div
          role="tablist"
          aria-label="장"
          className="mx-3 mb-2 flex max-h-28 shrink-0 flex-wrap gap-1 overflow-y-auto border-b pb-2"
        >
          {chapters.map((ch) => {
            const on = ch.id === chosen;
            return (
              <button
                key={ch.id}
                type="button"
                role="tab"
                aria-selected={on}
                title={`${ch.sub} · ${ch.title}${ch.id === suttaId ? " (지금 읽는 곳)" : ""}`}
                ref={
                  ch.id === suttaId
                    ? (el) => el?.scrollIntoView({ block: "nearest" })
                    : undefined
                }
                onClick={() => setChosen(ch.id)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-xs whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  on
                    ? "border-primary bg-primary font-bold text-primary-foreground"
                    : ch.id === suttaId
                      ? "border-primary text-primary hover:bg-brand-soft"
                      : "text-secondary-foreground hover:bg-hover",
                )}
              >
                {chapterTab(ch)}
              </button>
            );
          })}
        </div>
      ) : null}
      <nav aria-label="목차" className="min-h-0 flex-1 overflow-y-auto pb-3">
        {!viewing ? (
          <>
            <p className="px-4 pb-2 text-xs text-faint">문단 {toc.length}개</p>
            {toc.map((item) => {
              const on = item.paragraph === current;
              return (
                <button
                  key={item.paragraph}
                  type="button"
                  aria-current={on ? "location" : undefined}
                  onClick={() => onPick(item.paragraph)}
                  className={itemClass(on)}
                >
                  {row(item.paragraph, item.label, item.title, on)}
                </button>
              );
            })}
          </>
        ) : otherItems === "loading" ? (
          <p className="px-4 py-3 text-sm text-faint">목차를 불러오는 중…</p>
        ) : otherItems === "error" ? (
          <p className="px-4 py-3 text-sm text-faint">
            이 장의 목차를 불러오지 못했습니다.
          </p>
        ) : (
          <>
            <p className="px-4 pb-2 text-xs text-faint">
              {chapters?.find((c) => c.id === viewing)?.title} · 문단{" "}
              {otherItems.length}개
            </p>
            {otherItems.map((item) => (
              <Link
                key={item.paragraph}
                href={suttaHref(viewing, item.firstKey)}
                className={itemClass(false)}
              >
                {row(item.paragraph, item.label, item.title, false)}
              </Link>
            ))}
          </>
        )}
      </nav>
    </div>
  );
}
