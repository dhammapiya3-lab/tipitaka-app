"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSuttaAnalysis } from "@/lib/content";
import { splitWords } from "@/lib/pali";
import { unitOf } from "@/lib/segments";
import type { AnalysisKind, Edition, SuttaNissaya } from "@/types";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; files: SuttaNissaya[] };

export const ANALYSIS_LABEL: Record<AnalysisKind, string> = { nissaya: "대역", grammar: "문법분석" };

/**
 * 대역·문법분석 — 고른 문장(또는 문단 전체)의 "빠알리: 풀이" 줄들을 판본별로 보여 준다.
 * keys 는 보여 줄 문장 번호들(차례대로). 문장 하나를 골랐는데 그 문장에 칸이 없으면,
 * 게송 첫 줄에 게송 전체를 넣은 판본이 있어 같은 게송의 칸을 대신 보여 준다.
 * 종류(kind)가 바뀌면 부르는 쪽에서 key 를 바꿔 새로 그린다.
 */
export function AnalysisPanel({
  kind,
  suttaId,
  keys,
  editions,
  onWord,
}: {
  kind: AnalysisKind;
  suttaId: string;
  keys: string[];
  editions: Edition[];
  onWord: (word: string) => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const editionKey = editions.map((e) => e.id).join(",");

  useEffect(() => {
    let cancelled = false;
    Promise.all(editionKey.split(",").map((id) => fetchSuttaAnalysis(kind, suttaId, id)))
      .then((files) => {
        if (!cancelled) setState({ status: "ready", files });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [kind, suttaId, editionKey]);

  const label = ANALYSIS_LABEL[kind];
  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (state.status === "error") {
    return <p className="t-sub py-8 text-center">{label}을 불러오지 못했습니다.</p>;
  }

  const wanted = new Set(keys);
  const units = new Set(keys.map((k) => unitOf(k, suttaId)).filter((u): u is string => u !== null));
  const linesOf = (file: SuttaNissaya, pick: (key: string) => boolean) =>
    Object.entries(file.entries)
      .filter(([key]) => pick(key))
      .flatMap(([, value]) => value.split("\n"))
      .map((l) => l.trim())
      .filter(Boolean);

  const found = state.files.flatMap((file) => {
    let lines = linesOf(file, (key) => wanted.has(key));
    if (lines.length === 0 && units.size > 0) {
      lines = linesOf(file, (key) => units.has(unitOf(key, suttaId) ?? ""));
    }
    const edition = editions.find((e) => e.id === file.editionId);
    return lines.length && edition ? [{ edition, lines }] : [];
  });

  if (found.length === 0) {
    return <p className="t-sub py-8 text-center">이 문장의 {label} 데이터가 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {found.map(({ edition, lines }) => (
        <article key={edition.id} className="rounded-xl border bg-card p-4">
          <p className="t-meta mb-2 font-semibold">{edition.label}</p>
          <div className="flex flex-col gap-1">
            {lines.map((line, i) => {
              // "빠알리: 풀이" — 빠알리 부분은 굵게, 단어를 누르면 사전에서 찾는다.
              const m = line.match(/^([^:：]+?)\s*[:：]\s*(.*)$/);
              return (
                <p key={i}>
                  {m ? (
                    <>
                      <strong lang="pi" className="font-bold">
                        <Words text={m[1]} onWord={onWord} />
                      </strong>
                      : {m[2]}
                    </>
                  ) : (
                    line
                  )}
                </p>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}

function Words({ text, onWord }: { text: string; onWord: (word: string) => void }) {
  return splitWords(text).map((piece, i) =>
    piece.word ? (
      <span
        key={i}
        onClick={() => onWord(piece.text)}
        className="cursor-pointer rounded-sm hover:bg-brand-soft hover:text-brand-ink"
      >
        {piece.text}
      </span>
    ) : (
      piece.text
    ),
  );
}
