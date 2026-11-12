"use client";

import { CloudOff } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineText } from "@/components/sutta/inline-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCommentary } from "@/lib/content";
import type { CommentaryLayer, SuttaCommentary } from "@/types";

const LAYER_NAME: Record<CommentaryLayer, string> = { attha: "주석서", tika: "복주석서" };

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
}: {
  suttaId: string;
  layer: CommentaryLayer;
  available: boolean;
  onGoParagraph: (paragraph: string) => void;
  onWord: (word: string) => void;
  fontStyle?: React.CSSProperties;
}) {
  const [state, setState] = useState<{ key: string; data?: SuttaCommentary; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
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

  return (
    <div className="flex flex-col gap-4" style={fontStyle}>
      <p className="px-1 text-xs leading-relaxed text-faint">
        <span className="font-pali text-secondary-foreground">{data.bookName}</span> · VRI 제6차 결집본 — 이 경을 풀이한
        문단 {data.paras.length}개
      </p>
      {data.paras.map((para, i) => (
        <section
          key={i}
          id={`${layer}-${i}`}
          className="scroll-mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3 dark:border-border">
            <h3 className="mr-auto text-sm font-bold">
              {i + 1}
              {para.vripara ? <span className="ml-2 text-xs font-medium text-faint">VRI {para.vripara}</span> : null}
            </h3>
            {para.refs.length ? <span className="text-xs text-faint">경 문단</span> : null}
            {para.refs.map((ref) => (
              <button
                key={ref}
                type="button"
                title="경의 이 문단으로 가기"
                onClick={() => onGoParagraph(ref)}
                className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"
              >
                {ref.slice(ref.indexOf(":") + 1)}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 px-5 py-4 font-pali text-gray-800 dark:text-foreground" lang="pi">
            {para.lines.map((parts, j) => (
              <p key={j}>
                <InlineText parts={parts} onWord={onWord} />
              </p>
            ))}
          </div>
        </section>
      ))}
      <p className="px-1 text-xs leading-relaxed text-faint">
        출처: VRI Chaṭṭha Saṅgāyana Tipiṭaka · 문단 연결 E-Piṭaka (CC BY-NC 4.0)
      </p>
    </div>
  );
}
