"use client";

import { CircleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const PITAKAS = [
  { id: "sutta", label: "경" },
  { id: "vinaya", label: "율" },
  { id: "abhidhamma", label: "논" },
] as const;

/**
 * 경전 화면 — 원래 앱과 같은 안내 글과 경·율·논 단추.
 * 율장·논장은 번역이 생길 때까지 "준비 중" (원래 앱과 같다).
 */
export function PitakaTabs({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<(typeof PITAKAS)[number]["id"]>("sutta");
  return (
    <>
      <div className="flex items-start gap-2 px-3 pt-2">
        <CircleAlert
          className="mt-0.5 size-4 shrink-0 text-faint"
          aria-hidden
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <b className="text-foreground">경장, 율장, 논장은</b> 붓다의
          말씀입니다. <b className="text-foreground">붓다의 가르침을 직접</b>{" "}
          읽고 경청하며 <b className="text-foreground">깨달음의 길</b>을
          걸어가세요.
        </p>
      </div>
      <div className="flex gap-2 px-2 py-4" role="tablist" aria-label="삼장">
        {PITAKAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={tab === p.id}
            onClick={() => setTab(p.id)}
            className={cn(
              "flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              tab === p.id
                ? "bg-primary text-primary-foreground"
                : "border bg-card text-muted-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {tab === "sutta" ? (
        children
      ) : (
        <p className="px-6 py-12 text-center text-sm text-faint">
          {tab === "vinaya" ? "율장" : "논장"} 콘텐츠 준비 중입니다.
        </p>
      )}
    </>
  );
}
