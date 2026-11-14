"use client";

import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchParallels, fetchSuttaIndex } from "@/lib/content";
import { suttaHref, suttaLabel } from "@/lib/format";
import { paragraphOf } from "@/lib/segments";
import type { ParallelLink } from "@/types";

/**
 * 병행 경전 — 이 경과 같은 가르침이 담긴 다른 니까야 경 (SuttaCentral parallels, CC0).
 *  · 문단 번호 옆 "⇄ n" : 그 문단과 같은 대목이 있는 경 (누르면 목록, 고르면 그 대목으로)
 *  · 오른쪽 칸 '참고 경전' : 관계별 전체 목록
 *  경 전체가 이어진 경(대목 표시가 없는 연결)은 첫 문단의 "⇄ n" 에 "경 전체"로 함께 단다.
 */

export const REL_LABEL: Record<ParallelLink["r"], string> = {
  p: "같은 내용",
  pp: "일부 같음",
  rt: "다시 들려줌",
  m: "언급·인용",
};
const REL_ORDER: ParallelLink["r"][] = ["p", "pp", "rt", "m"];

/** 이 경의 병행 경전과 경 이름 (한 번만 받는다) */
export function useParallels(suttaId: string) {
  const [state, setState] = useState<{
    id: string;
    links: ParallelLink[];
    names: Map<string, string>;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([fetchParallels(suttaId), fetchSuttaIndex()])
      .then(([links, index]) => {
        if (!alive) return;
        const wanted = new Set(links.map((l) => l.s));
        // 이름이 번호와 같으면(예: NE 17) 두 번 적지 않는다
        const names = new Map(
          index
            .filter((s) => wanted.has(s.id))
            .map((s) => [s.id, s.nameKo ?? s.name] as const)
            .filter(
              ([id, name]) =>
                name.toLowerCase() !== suttaLabel(id).toLowerCase(),
            ),
        );
        setState({ id: suttaId, links, names });
      })
      .catch(
        () => alive && setState({ id: suttaId, links: [], names: new Map() }),
      );
    return () => {
      alive = false;
    };
  }, [suttaId]);
  return state && state.id === suttaId ? state : null;
}

/** 문장 번호 → 화면의 문단 표시 ("sn56.11:4.2" → "4", 법구경 게송 "dhp5:1" → "5") */
function paragraphLabel(suttaId: string, key: string): string {
  const p = paragraphOf(key, suttaId);
  const colon = p.indexOf(":");
  return colon >= 0 ? p.slice(colon + 1) : p.replace(/^[a-z-]+/, "");
}

export interface ParagraphParallel {
  s: string;
  r: ParallelLink["r"];
  /** 그 경의 문장 번호 ("" 이면 경 처음) */
  there: string;
  /** 이 경의 어느 대목이 아니라 경 전체가 이어짐 */
  whole?: boolean;
}

/** 이 경의 문단 → 그 문단과 이어진 경들 */
export function parallelsByParagraph(
  suttaId: string,
  links: ParallelLink[],
  /** 화면의 문단 (차례대로) — 문단을 찾지 못한 연결과 경 전체 연결은 첫 문단에 단다 */
  paragraphs: string[],
): Map<string, ParagraphParallel[]> {
  const map = new Map<string, ParagraphParallel[]>();
  const known = new Set(paragraphs);
  const add = (p: string, item: ParagraphParallel) => {
    const list = map.get(p) ?? [];
    if (!list.some((x) => x.s === item.s && x.there === item.there))
      list.push(item);
    map.set(p, list);
  };
  for (const link of links) {
    const first = paragraphs[0];
    const pairs = link.l.length ? link.l : [["", ""] as [string, string]];
    for (const [here, there] of pairs) {
      const p = here ? paragraphOf(here, suttaId) : "";
      if (p && known.has(p)) add(p, { s: link.s, r: link.r, there });
      else if (first) add(first, { s: link.s, r: link.r, there, whole: !here });
    }
  }
  return map;
}

function targetHref(s: string, there: string) {
  // "dhp383:" 처럼 경의 처음만 가리키면 문장 번호 없이
  return suttaHref(s, there && !there.endsWith(":") ? there : undefined);
}

/** 문단 번호 옆 "⇄ n" — 누르면 그 문단과 같은 대목이 있는 경 목록 */
export function ParagraphParallels({
  items,
  names,
}: {
  items: ParagraphParallel[];
  names: Map<string, string>;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            title="이 문단과 같은 대목이 있는 다른 경 (병행 경전)"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 transition-colors hover:bg-amber-100 data-popup-open:border-primary data-popup-open:bg-primary data-popup-open:text-primary-foreground dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300 print:hidden"
          />
        }
      >
        <ArrowLeftRight className="size-3" aria-hidden />
        {items.length}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="max-h-[70vh] w-80 p-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="px-2 pt-1 pb-1.5 text-xs font-bold text-muted-foreground">
          이 문단과 같은 대목
        </p>
        {items.map((it) => (
          <DropdownMenuItem
            key={`${it.s}:${it.there}`}
            onClick={() => router.push(targetHref(it.s, it.there))}
            className="flex-col items-start gap-0.5 rounded-lg border border-transparent px-2.5 py-2"
          >
            <span className="text-sm">
              <b>{suttaLabel(it.s)}</b>{" "}
              <span className="text-muted-foreground">
                {names.get(it.s)}
                {it.there ? ` ¶${paragraphLabel(it.s, it.there)}` : ""}
                {it.whole ? " · 경 전체" : ""}
              </span>
            </span>
            <span className="text-xs text-primary">
              {REL_LABEL[it.r]} · 눌러서 그 대목으로 가기 →
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 관계별 전체 목록 — 오른쪽 칸 '참고 경전' */
export function ParallelList({
  suttaId,
  links,
  names,
}: {
  suttaId: string;
  links: ParallelLink[];
  names: Map<string, string>;
}) {
  return (
    <div className="flex flex-col gap-1">
      {REL_ORDER.filter((r) => links.some((l) => l.r === r)).map((r) => (
        <section key={r} className="flex flex-col gap-1.5">
          <h4 className="px-1 pt-2 text-xs font-bold text-muted-foreground">
            {REL_LABEL[r]}
          </h4>
          {links
            .filter((l) => l.r === r)
            .map((l) => {
              const here = [
                ...new Set(
                  l.l
                    .map(([h]) => h)
                    .filter(Boolean)
                    .map((h) => paragraphLabel(suttaId, h)),
                ),
              ];
              const there = [
                ...new Set(
                  l.l
                    .map(([, t]) => t)
                    .filter(Boolean)
                    .map((t) => paragraphLabel(l.s, t)),
                ),
              ];
              const first = l.l.find(([, t]) => t)?.[1] ?? "";
              return (
                <Link
                  key={l.s}
                  href={targetHref(l.s, first)}
                  className="block rounded-xl border bg-gray-50 px-3.5 py-2.5 outline-none transition-colors hover:border-amber-200 hover:bg-amber-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-muted"
                >
                  <span className="text-sm">
                    <b>{suttaLabel(l.s)}</b>{" "}
                    <span className="text-muted-foreground">
                      {names.get(l.s)}
                    </span>
                  </span>
                  {here.length || there.length ? (
                    <span className="mt-0.5 block text-xs text-primary">
                      {here.length ? `이 경 ¶${here.join("·¶")}` : "이 경"}
                      {" ↔ "}
                      {there.length ? `그 경 ¶${there.join("·¶")}` : "그 경"}
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-xs text-faint">
                      경 전체
                    </span>
                  )}
                </Link>
              );
            })}
        </section>
      ))}
      <p className="px-1 pt-3 text-[11px] leading-relaxed text-faint">
        병행 경전 자료: SuttaCentral (CC0) — 니까야 경전끼리의 연결만
        실었습니다.
      </p>
    </div>
  );
}
