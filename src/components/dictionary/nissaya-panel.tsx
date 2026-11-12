"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSuttaNissaya } from "@/lib/content";
import { splitWords } from "@/lib/pali";
import { unitOf } from "@/lib/segments";
import type { Edition, SuttaNissaya } from "@/types";

type State = { status: "loading" } | { status: "error" } | { status: "ready"; files: SuttaNissaya[] };

/**
 * 대역 — 누른 문장(법구경은 그 게송 전체)의 "빠알리: 뜻" 풀이를 판본별로 보여 준다.
 * 판본마다 문장별·게송별로 넣은 방식이 달라, 같은 게송의 칸을 모두 모아 보여 준다.
 */
export function NissayaPanel({
  suttaId,
  rowKey,
  editions,
  onWord,
}: {
  suttaId: string;
  rowKey: string;
  editions: Edition[];
  onWord: (word: string) => void;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const editionKey = editions.map((e) => e.id).join(",");

  useEffect(() => {
    let cancelled = false;
    Promise.all(editionKey.split(",").map((id) => fetchSuttaNissaya(suttaId, id)))
      .then((files) => {
        if (!cancelled) setState({ status: "ready", files });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [suttaId, editionKey]);

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (state.status === "error") {
    return <p className="t-sub py-8 text-center">대역을 불러오지 못했습니다.</p>;
  }

  const unit = unitOf(rowKey, suttaId);
  const sameUnit = (key: string) => (unit ? unitOf(key, suttaId) === unit : key === rowKey);
  const found = state.files.flatMap((file) => {
    const text = Object.entries(file.entries)
      .filter(([key]) => sameUnit(key))
      .map(([, value]) => value.trim())
      .join("\n");
    const edition = editions.find((e) => e.id === file.editionId);
    return text && edition ? [{ edition, lines: text.split("\n").map((l) => l.trim()).filter(Boolean) }] : [];
  });

  if (found.length === 0) {
    return <p className="t-sub py-8 text-center">이 문장의 대역 데이터가 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {found.map(({ edition, lines }) => (
        <article key={edition.id} className="rounded-xl border bg-card p-4">
          <p className="t-meta mb-2 font-semibold">{edition.label}</p>
          <div className="flex flex-col gap-1">
            {lines.map((line, i) => {
              // "빠알리: 뜻" — 빠알리 부분은 굵게, 단어를 누르면 사전에서 찾는다.
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
