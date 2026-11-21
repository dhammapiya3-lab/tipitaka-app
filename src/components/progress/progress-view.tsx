"use client";

import { ChevronDown, Download, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount, suttaHref, suttaLabel } from "@/lib/format";
import { makeReadFile, parseReadFile, readFileName } from "@/lib/read-file";
import { cn } from "@/lib/utils";
import { useReadStore, type ReadRecord } from "@/store/read";

/** 경 하나: [경 번호, 한글 번역이 있는지] */
export type ProgressSutta = [id: string, korean: boolean];

export interface ProgressLeaf {
  name: string;
  suttas: ProgressSutta[];
}

export interface ProgressGroup {
  name: string;
  leaves: ProgressLeaf[];
}

export interface ProgressNikaya {
  id: string;
  name: string;
  groups: ProgressGroup[];
}

type Scope = "korean" | "all";

const inScope = (scope: Scope) => (s: ProgressSutta) => scope === "all" || s[1];

function count(suttas: ProgressSutta[], scope: Scope, read: ReadRecord) {
  const list = suttas.filter(inScope(scope));
  return { total: list.length, done: list.filter(([id]) => read[id]).length };
}

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : (done / total) * 100;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Count({ done, total }: { done: number; total: number }) {
  return (
    <span className="shrink-0 text-xs font-bold text-primary tabular-nums">
      {formatCount(done)} / {formatCount(total)}
    </span>
  );
}

/**
 * 진도표 — 니까야별 막대, 품을 펼치면 경마다 칸 하나(다 읽은 경은 호박색).
 * 칸을 누르면 그 경으로 간다. 다 읽음 표시는 경 목록·경 끝에서 사용자가 직접 한다.
 */
export function ProgressView({ nikayas }: { nikayas: ProgressNikaya[] }) {
  const read = useReadStore((s) => s.items);
  const importItems = useReadStore((s) => s.importItems);
  const [scope, setScope] = useState<Scope>("korean");
  const fileInput = useRef<HTMLInputElement>(null);
  // 이 기기의 저장값은 화면이 뜬 뒤 불러오므로, 그 전에는 0으로 보여 주지 않는다.
  const ready = useSyncExternalStore(
    (onChange) =>
      useReadStore.persist?.onFinishHydration(onChange) ?? (() => {}),
    () => useReadStore.persist?.hasHydrated() ?? false,
    () => false,
  );

  const all = nikayas.flatMap((n) =>
    n.groups.flatMap((g) => g.leaves.flatMap((l) => l.suttas)),
  );
  const overall = count(all, scope, read);
  const readCount = Object.keys(read).length;

  function exportFile() {
    const blob = new Blob([makeReadFile(read)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = readFileName();
    a.click();
    URL.revokeObjectURL(url);
    toast.success(
      `다 읽은 경 ${formatCount(readCount)}개의 기록을 파일로 내보냈습니다.`,
    );
  }

  async function importFile(file: File) {
    const parsed = parseReadFile(await file.text());
    if ("error" in parsed) {
      toast.error(parsed.error);
      return;
    }
    const added = importItems(parsed.items);
    toast.success(
      `가져왔습니다. 새로 더한 경 ${formatCount(added)}개, 이미 표시되어 있던 경 ${formatCount(Object.keys(parsed.items).length - added)}개는 그대로 두었습니다.`,
    );
  }

  if (!ready) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">경장 전체</h2>
          <Count {...overall} />
        </div>
        <Bar {...overall} />
        <div
          className="flex rounded-lg bg-muted p-0.5"
          role="group"
          aria-label="셀 경의 범위"
        >
          {(
            [
              ["korean", "한글 번역이 있는 경"],
              ["all", "본문이 있는 경 전체"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={scope === id}
              onClick={() => setScope(id)}
              className={cn(
                "h-8 flex-1 rounded-md px-2 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                scope === id
                  ? "bg-card font-semibold text-primary shadow-sm"
                  : "font-medium text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          다 읽은 경은 경 목록의 동그라미나 경 맨 끝의 [다 읽음으로 표시] 단추로
          직접 표시합니다. 기록은 이 기기의 브라우저에만 저장되므로, 다른 기기로
          옮기려면 파일로 내보내고 가져오세요.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInput.current?.click()}
          >
            <Upload aria-hidden />
            기록 가져오기
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={readCount === 0}
            onClick={exportFile}
          >
            <Download aria-hidden />
            기록 내보내기
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

      {nikayas.map((n) => (
        <NikayaProgress key={n.id} nikaya={n} scope={scope} read={read} />
      ))}
    </div>
  );
}

function NikayaProgress({
  nikaya,
  scope,
  read,
}: {
  nikaya: ProgressNikaya;
  scope: Scope;
  read: ReadRecord;
}) {
  const suttas = nikaya.groups.flatMap((g) =>
    g.leaves.flatMap((l) => l.suttas),
  );
  const c = count(suttas, scope, read);
  if (c.total === 0) return null;
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold">{nikaya.name}</h2>
        <Count {...c} />
      </div>
      <Bar {...c} />
      <div className="flex flex-col">
        {nikaya.groups.map((g) => (
          <GroupProgress key={g.name} group={g} scope={scope} read={read} />
        ))}
      </div>
    </section>
  );
}

function GroupProgress({
  group,
  scope,
  read,
}: {
  group: ProgressGroup;
  scope: Scope;
  read: ReadRecord;
}) {
  const c = count(
    group.leaves.flatMap((l) => l.suttas),
    scope,
    read,
  );
  if (c.total === 0) return null;
  return (
    <details className="group/p border-t first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 text-sm font-medium">{group.name}</span>
        <span className="w-16 shrink-0">
          <Bar {...c} />
        </span>
        <Count {...c} />
        <ChevronDown
          className="size-4 shrink-0 text-faint transition-transform group-open/p:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="flex flex-col gap-2 pb-3">
        {group.leaves.map((leaf) => {
          const list = leaf.suttas.filter(inScope(scope));
          if (list.length === 0) return null;
          return (
            <div key={leaf.name}>
              {group.leaves.length > 1 || leaf.name !== group.name ? (
                <div className="mb-1 text-xs text-muted-foreground">
                  {leaf.name}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-1">
                {list.map(([id]) => (
                  <Link
                    key={id}
                    href={suttaHref(id)}
                    title={`${suttaLabel(id)}${read[id] ? " · 다 읽음" : ""}`}
                    aria-label={`${suttaLabel(id)}${read[id] ? " 다 읽음" : " 아직 안 읽음"}`}
                    className={cn(
                      "size-4 rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      read[id]
                        ? "bg-primary"
                        : "bg-muted hover:bg-amber-200 dark:hover:bg-border",
                    )}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
