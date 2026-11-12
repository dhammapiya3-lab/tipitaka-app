"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchSuttaNotes, fetchSuttaText } from "@/lib/content";
import type { SuttaNotes, SuttaText } from "@/types";

// 같은 판본을 껐다 켜도 다시 받지 않도록 페이지 안에서 기억한다. 실패한 요청은 지워 다시 시도할 수 있게 한다.
const textCache = new Map<string, Promise<SuttaText>>();
const notesCache = new Map<string, Promise<SuttaNotes>>();

function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>) {
  let promise = cache.get(key);
  if (!promise) {
    promise = load();
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
  }
  return promise;
}

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "자료를 받지 못했습니다";

/** 고른 판본의 본문을 받는다. 이미 받은 판본은 판본을 바꾸는 동안에도 그대로 보인다. */
export function useSuttaTexts(suttaId: string, editionIds: string[]) {
  const idsKey = editionIds.join(",");
  const ids = useMemo(() => idsKey.split(",").filter(Boolean), [idsKey]);
  const [texts, setTexts] = useState<Record<string, SuttaText>>({});
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      ids.map((id) => cached(textCache, `${suttaId}/${id}`, () => fetchSuttaText(suttaId, id))),
    )
      .then((list) => {
        if (cancelled) return;
        setTexts((prev) => ({ ...prev, ...Object.fromEntries(list.map((t) => [t.editionId, t])) }));
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [suttaId, ids, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { texts, error, retry };
}

export type NotesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; notes: SuttaNotes };

/** 각주는 처음 누를 때만 받는다. */
export function useSuttaNotes(suttaId: string) {
  const [notes, setNotes] = useState<Record<string, NotesState>>({});

  const load = useCallback(
    (editionId: string) => {
      setNotes((prev) =>
        prev[editionId]?.status === "ready" ? prev : { ...prev, [editionId]: { status: "loading" } },
      );
      cached(notesCache, `${suttaId}/${editionId}`, () => fetchSuttaNotes(suttaId, editionId))
        .then((result) =>
          setNotes((prev) => ({ ...prev, [editionId]: { status: "ready", notes: result } })),
        )
        .catch((e: unknown) =>
          setNotes((prev) => ({
            ...prev,
            [editionId]: { status: "error", message: errorMessage(e) },
          })),
        );
    },
    [suttaId],
  );

  return { notes, load };
}
