"use client";

/**
 * 미얀마어 글 — 낱말마다 눌러서 미얀마어 위키낱말사전 풀이(미얀마어 뜻·영어 뜻)를 본다.
 * 낱말 경계는 사전에 있는 가장 긴 낱말부터 맞춰 찾는다(src/lib/burmese.ts). 사전에 없는 글자는 그대로.
 * 글 자체는 바꾸지 않는다 — 조각들을 이으면 원래 글과 같다.
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import { segmentBurmese } from "@/lib/burmese";
import {
  type BurmeseEntry,
  fetchBurmeseEntry,
  fetchBurmeseWords,
} from "@/lib/content";

const POS: Record<string, string> = {
  n: "명사",
  v: "동사",
  adj: "형용사",
  adv: "부사",
  pron: "대명사",
  part: "조사·첨사",
  conj: "접속사",
  interj: "감탄사",
};

export function BurmeseText({ text }: { text: string }) {
  const [dict, setDict] = useState<{ words: Set<string>; maxLen: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [senses, setSenses] = useState<BurmeseEntry | "loading" | "error">("loading");

  useEffect(() => {
    let alive = true;
    fetchBurmeseWords()
      .then((d) => alive && setDict(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!picked) return;
    let alive = true;
    fetchBurmeseEntry(picked)
      .then((s) => alive && setSenses(s))
      .catch(() => alive && setSenses("error"));
    return () => {
      alive = false;
    };
  }, [picked]);

  const pieces = useMemo(
    () => (dict ? segmentBurmese(text, dict.words, dict.maxLen) : null),
    [text, dict],
  );

  if (!pieces) return <>{text}</>;
  return (
    <>
      {pieces.map((p, i) =>
        p.word ? (
          <button
            key={i}
            type="button"
            onClick={() => {
              setSenses("loading");
              setPicked((w) => (w === p.text ? null : p.text));
            }}
            className={`rounded-sm underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 hover:bg-primary/10 ${picked === p.text ? "bg-primary/15" : ""}`}
          >
            {p.text}
          </button>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
      {picked && (
        <span className="mt-2 block rounded-lg border bg-muted/40 p-3 text-sm">
          <span className="flex items-baseline justify-between gap-2">
            <span lang="my" className="font-semibold text-foreground">
              {picked}
            </span>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              닫기
            </button>
          </span>
          {senses === "loading" ? (
            <span className="block text-muted-foreground">찾는 중…</span>
          ) : senses === "error" ? (
            <span className="block text-muted-foreground">풀이를 받지 못했습니다.</span>
          ) : (
            <>
              {(senses.m ?? []).length > 0 && (
                <span className="mt-1.5 block">
                  <span className="block text-xs font-semibold text-muted-foreground">
                    우 호크 세인 미얀마어-영어-빠알리어 사전
                  </span>
                  {senses.m!.map(([head, eng, pli, page], j) => (
                    <span key={j} className="mt-1 block">
                      <span lang="my" className="text-muted-foreground">
                        {head}
                      </span>{" "}
                      <span className="text-foreground">{eng}</span>
                      {pli && (
                        <span lang="my" className="block">
                          빠알리어: {pli}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {" "}
                        (원서 {page}쪽)
                      </span>
                    </span>
                  ))}
                </span>
              )}
              {(senses.w ?? []).length > 0 && (
                <span className="mt-2 block">
                  <span className="block text-xs font-semibold text-muted-foreground">
                    미얀마어 위키낱말사전
                  </span>
                  {senses.w!.map(([pos, def, ex, en], j) => (
                    <span key={j} className="mt-1.5 block">
                      {pos && (
                        <span className="mr-1.5 text-xs text-muted-foreground">
                          {POS[pos] ?? pos}
                        </span>
                      )}
                      {def && <span lang="my">{def}</span>}
                      {en && <span className="block text-foreground">{en}</span>}
                      {ex && (
                        <span lang="my" className="block text-xs text-muted-foreground">
                          {ex}
                        </span>
                      )}
                    </span>
                  ))}
                </span>
              )}
            </>
          )}
          <span className="mt-2 block text-[11px] text-muted-foreground">
            출처: 우 호크 세인 『미얀마어-영어-빠알리어 사전』(Pn Daza 스님 MEP
            Dictionary 자료) · 미얀마어 위키낱말사전(my.wiktionary.org, CC
            BY-SA 4.0) — 자세한 이용 조건은 정보 화면
          </span>
        </span>
      )}
    </>
  );
}
