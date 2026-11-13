"use client";

import { Bookmark, Download, Highlighter, NotebookPen, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { bookmarkFileName, makeBookmarkFile, parseBookmarkFile } from "@/lib/bookmark-file";
import { formatCount, formatDate, suttaHref, suttaLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBookmarksStore } from "@/store/bookmarks";
import { HIGHLIGHT_CLASS, useHighlightsStore } from "@/store/highlights";

type Filter = "all" | "highlight" | "memo";

/**
 * 북마크·메모 목록 — 저장한 순서(최근 먼저). 누르면 그 문장으로 간다.
 * 이 기기에만 저장되므로 파일로 내보내고 가져와 다른 기기로 옮긴다.
 */
export function BookmarksView() {
  const items = useBookmarksStore((s) => s.items);
  const remove = useBookmarksStore((s) => s.remove);
  const importItems = useBookmarksStore((s) => s.importItems);
  const [filter, setFilter] = useState<Filter>("all");
  const fileInput = useRef<HTMLInputElement>(null);
  // 이 기기의 저장값은 화면이 뜬 뒤 불러오므로, 그 전에는 "없음"을 보여 주지 않는다.
  // (정적 빌드 때는 브라우저 저장소가 없어 persist 가 붙지 않는다)
  const ready = useSyncExternalStore(
    (onChange) => useBookmarksStore.persist?.onFinishHydration(onChange) ?? (() => {}),
    () => useBookmarksStore.persist?.hasHydrated() ?? false,
    () => false,
  );

  function exportFile() {
    const blob = new Blob([makeBookmarkFile(items)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = bookmarkFileName();
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`북마크 ${formatCount(items.length)}개를 파일로 내보냈습니다.`);
  }

  async function importFile(file: File) {
    const parsed = parseBookmarkFile(await file.text());
    if ("error" in parsed) {
      toast.error(parsed.error);
      return;
    }
    const added = importItems(parsed.items);
    toast.success(
      `가져왔습니다. 새 북마크 ${formatCount(added)}개, 이미 있던 ${formatCount(parsed.items.length - added)}개는 가져온 내용으로 바꿨습니다.`,
    );
  }

  const memoCount = items.filter((b) => b.memo).length;
  const highlightCount = useHighlightsStore((s) => s.items.length);
  const shown = filter === "memo" ? items.filter((b) => b.memo) : items;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg bg-muted p-0.5" role="group" aria-label="보기">
        {(
          [
            ["all", `책갈피 ${formatCount(items.length)}`],
            ["highlight", `형광펜·밑줄 ${formatCount(highlightCount)}`],
            ["memo", `메모 ${formatCount(memoCount)}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={cn(
              "h-8 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              filter === id
                ? "bg-card font-semibold text-primary shadow-sm"
                : "font-medium text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="ml-auto flex gap-2">
        <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
          <Upload aria-hidden />
          가져오기
        </Button>
        <Button variant="outline" size="sm" disabled={items.length === 0} onClick={exportFile}>
          <Download aria-hidden />
          내보내기
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );

  if (!ready) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {toolbar}
      {filter === "highlight" ? (
        <HighlightList />
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={filter === "memo" ? NotebookPen : Bookmark}
            title={filter === "memo" ? "메모를 남긴 문장이 없습니다" : "저장한 문장이 없습니다"}
            description="경을 읽다가 문장 옆 메뉴(⋯)에서 북마크나 메모를 남기면 여기에 모입니다. 다른 기기에서 내보낸 파일이 있으면 가져오기를 누르세요."
            action={
              <Button nativeButton={false} render={<Link href="/suttas" />}>
                경전 목록으로
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="gap-0 p-0">
          <ul className="flex flex-col">
            {shown.map((b) => (
              <li
                key={`${b.suttaId} ${b.key}`}
                className="flex items-start gap-2 border-t first:border-t-0"
              >
                <Link
                  href={suttaHref(b.suttaId, b.key)}
                  className="flex min-w-0 flex-1 flex-col gap-1 px-5 py-4 outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="line-clamp-2">{b.snippet || b.key}</span>
                  {b.memo ? (
                    <span className="t-sub flex gap-1.5 rounded-md bg-surface-2 px-2 py-1 whitespace-pre-line">
                      <NotebookPen className="mt-0.5 size-3.5 shrink-0 text-primary" aria-label="메모" />
                      {b.memo}
                    </span>
                  ) : null}
                  <span className="t-meta">
                    {b.suttaTitle} · {suttaLabel(b.key.slice(0, b.key.indexOf(":")))}:
                    {b.key.slice(b.key.indexOf(":") + 1)} · {formatDate(b.savedAt)}
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-3 mr-3"
                  aria-label="북마크와 메모 지우기"
                  onClick={() => remove(b.suttaId, b.key)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** 밑줄·형광펜을 그은 글 — 누르면 그 문장으로 */
function HighlightList() {
  const items = useHighlightsStore((s) => s.items);
  const remove = useHighlightsStore((s) => s.remove);
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Highlighter}
          title="형광펜·밑줄을 그은 글이 없습니다"
          description="경을 읽다가 글을 손가락이나 마우스로 끌어 고르면 뜨는 막대에서 형광펜이나 밑줄을 고르세요. 그은 글이 여기에 모입니다."
        />
      </Card>
    );
  }
  return (
    <section className="flex flex-col gap-2">
      <Card className="gap-0 p-0">
        <ul className="flex flex-col">
          {items.map((h) => (
            <li key={h.id} className="flex items-start gap-2 border-t first:border-t-0">
              <Link
                href={suttaHref(h.suttaId, h.key)}
                className="flex min-w-0 flex-1 flex-col gap-1 px-5 py-4 outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="line-clamp-3">
                  <mark className={cn("rounded-sm bg-transparent text-inherit", HIGHLIGHT_CLASS[h.color])}>{h.text}</mark>
                </span>
                <span className="t-meta">
                  {h.suttaTitle} · {suttaLabel(h.key.slice(0, h.key.indexOf(":")))}:{h.key.slice(h.key.indexOf(":") + 1)} ·{" "}
                  {formatDate(h.savedAt)}
                </span>
              </Link>
              <Button variant="ghost" size="icon" className="mt-3 mr-3" aria-label="밑줄 지우기" onClick={() => remove(h.id)}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
