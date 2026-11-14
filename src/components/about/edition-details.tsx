"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EditionInfoView } from "@/components/sutta/reader-sheets";
import { fetchEditionInfo } from "@/lib/content";
import type { EditionInfo } from "@/types";

/**
 * 정보 화면 — 판본 하나의 상세 정보(번역자 소개·출처·저작권 안내 …).
 * 접혀 있다가 누르거나, 판본 표의 이름을 눌러 주소가 #edition-<판본> 이 되면 펼쳐진다.
 * 소개 글은 경 화면의 판본 창과 같은 자료(public/data/edition-info)를 펼칠 때 받는다.
 */
export function EditionDetails({
  id,
  title,
  subtitle,
}: {
  id: string;
  title: string;
  subtitle?: string;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<EditionInfo | null | "loading">("loading");

  // 표에서 이름을 눌러 이 칸으로 오면 펼친다
  useEffect(() => {
    const check = () => {
      if (window.location.hash === `#edition-${id}` && ref.current) {
        ref.current.open = true;
        ref.current.scrollIntoView({ block: "start" });
      }
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [id]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchEditionInfo(id)
      .then((v) => alive && setInfo(v))
      .catch(() => alive && setInfo(null));
    return () => {
      alive = false;
    };
  }, [open, id]);

  return (
    <details
      ref={ref}
      id={`edition-${id}`}
      className="group scroll-mt-20 border-t first:border-t-0"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-foreground">{title}</span>
          {subtitle ? (
            <span className="ml-2 text-sm text-muted-foreground">
              {subtitle}
            </span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-faint transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="px-5 pt-1 pb-6">
        {!open ? null : info === "loading" ? (
          <p className="text-sm text-faint">불러오는 중…</p>
        ) : info ? (
          <EditionInfoView info={info} />
        ) : (
          <p className="text-sm text-faint">
            이 판본의 상세 정보는 아직 준비 중입니다.
          </p>
        )}
      </div>
    </details>
  );
}
