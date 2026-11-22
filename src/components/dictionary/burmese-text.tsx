"use client";

/**
 * 미얀마어 사전 찾기 — 사전 검색칸에 미얀마 글자를 치면 미얀마어 낱말 사전들(위키낱말사전·우 호크 세인)의 풀이를 보여 준다.
 * 낱말 경계는 사전에 있는 가장 긴 낱말부터 맞춰 찾는다(src/lib/burmese.ts).
 * (미얀마어 뜻풀이 속 낱말을 눌러 뜻을 보던 기능은 2026-11-22 사용자 요청으로 없앴다.)
 */
import { useEffect, useState } from "react";
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

/** 영어 위키낱말사전(kaikki.org) 품사 이름 */
const EN_POS: Record<string, string> = {
  noun: "명사",
  verb: "동사",
  name: "고유명사",
  adj: "형용사",
  adv: "부사",
  particle: "조사·첨사",
  pron: "대명사",
  classifier: "분류사",
  num: "수사",
  character: "글자",
  conj: "접속사",
  postp: "후치사",
  intj: "감탄사",
  prefix: "접두사",
  suffix: "접미사",
  phrase: "구",
  det: "한정사",
  prep: "전치사",
};

const CREDIT =
  "출처: 우 호크 세인 『미얀마어-영어-빠알리어 사전』(Pn Daza 스님 MEP Dictionary 자료) · 미얀마어 위키낱말사전(my.wiktionary.org, CC BY-SA 4.0) · 영어 위키낱말사전 미얀마어 항목(en.wiktionary.org, kaikki.org 정리본, CC BY-SA 4.0) — 자세한 이용 조건은 정보 화면";

/** 사전들의 풀이 (사전 검색) */
function BurmeseSenses({ entry }: { entry: BurmeseEntry }) {
  return (
    <>
      {(entry.m ?? []).length > 0 && (
        <span className="mt-1.5 block">
          <span className="block text-xs font-semibold text-muted-foreground">
            우 호크 세인 미얀마어-영어-빠알리어 사전
          </span>
          {entry.m!.map(([head, eng, pli, page], j) => (
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
              <span className="text-[11px] text-muted-foreground"> (원서 {page}쪽)</span>
            </span>
          ))}
        </span>
      )}
      {(entry.w ?? []).length > 0 && (
        <span className="mt-2 block">
          <span className="block text-xs font-semibold text-muted-foreground">
            미얀마어 위키낱말사전
          </span>
          {entry.w!.map(([pos, def, ex, en], j) => (
            <span key={j} className="mt-1.5 block">
              {pos && (
                <span className="mr-1.5 text-xs text-muted-foreground">{POS[pos] ?? pos}</span>
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
      {(entry.e ?? []).length > 0 && (
        <span className="mt-2 block">
          <span className="block text-xs font-semibold text-muted-foreground">
            영어 위키낱말사전
          </span>
          {entry.e!.map(([pos, glosses, roman, ipa, etym], j) => (
            <span key={j} className="mt-1.5 block">
              {pos && (
                <span className="mr-1.5 text-xs text-muted-foreground">{EN_POS[pos] ?? pos}</span>
              )}
              {(roman || ipa) && (
                <span className="text-xs text-muted-foreground">
                  {[roman, ipa].filter(Boolean).join(" · ")}
                </span>
              )}
              {glosses.map((g, k) => (
                <span key={k} className="block text-foreground">
                  {glosses.length > 1 ? `${k + 1}. ` : ""}
                  {g}
                </span>
              ))}
              {etym && (
                <span className="block text-xs text-muted-foreground">어원: {etym}</span>
              )}
            </span>
          ))}
        </span>
      )}
    </>
  );
}

/** 미얀마 글자가 들었는가 — 사전 검색에서 미얀마어 사전으로 찾을지 정한다 */
export function hasBurmese(text: string): boolean {
  return /[\u1000-\u109F]/u.test(text);
}

type SearchState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      /** 찾은 낱말들 — 통째로 있으면 하나, 없으면 낱말로 나눈 것들 */
      found: { word: string; entry: BurmeseEntry }[];
      /** 이 글자로 시작하는 다른 낱말 */
      more: string[];
    };

/**
 * 사전 화면에서 미얀마어로 찾기 — 우 호크 세인 사전, 미얀마어 위키낱말사전, 영어 위키낱말사전 미얀마어 항목.
 * 친 글이 통째로 사전에 없으면, 사전 낱말로 나눠 낱말마다 보여 준다.
 */
export function BurmeseSearchResult({
  query,
  onSearch,
}: {
  query: string;
  onSearch?: (word: string) => void;
}) {
  const key = query.replace(/[\s\u200B]+/g, "");
  const [state, setState] = useState<SearchState & { key: string }>({ status: "loading", key: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      const dict = await fetchBurmeseWords();
      let words = dict.has(key)
        ? [key]
        : segmentBurmese(key, dict)
            .filter((p) => p.word)
            .map((p) => p.text);
      words = [...new Set(words)].slice(0, 12);
      const found = (
        await Promise.all(words.map(async (word) => ({ word, entry: await fetchBurmeseEntry(word) })))
      ).filter(
        (f) => (f.entry.m ?? []).length + (f.entry.w ?? []).length + (f.entry.e ?? []).length > 0,
      );
      const more = dict.startingWith(key, 30).filter((w) => w !== key);
      if (alive) setState({ status: "ready", found, more, key });
    })().catch(() => alive && setState({ status: "error", key }));
    return () => {
      alive = false;
    };
  }, [key]);

  if (state.key !== key || state.status === "loading")
    return <p className="text-sm text-muted-foreground">미얀마어 사전에서 찾는 중…</p>;
  if (state.status === "error")
    return <p className="text-sm text-muted-foreground">미얀마어 사전을 받지 못했습니다.</p>;
  return (
    <div className="flex flex-col gap-3">
      {state.found.length === 0 && (
        <p className="text-sm text-muted-foreground">미얀마어 사전에 &ldquo;{query}&rdquo;가 없습니다.</p>
      )}
      {state.found.length > 1 && (
        <p className="text-xs text-muted-foreground">
          통째로는 없어서 사전 낱말로 나눠 찾았습니다.
        </p>
      )}
      {state.found.map(({ word, entry }) => (
        <article key={word} className="rounded-xl border bg-card p-4 text-sm">
          <p lang="my" className="mb-1 font-bold">
            {word}
          </p>
          <BurmeseSenses entry={entry} />
        </article>
      ))}
      {state.more.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="이 글자로 시작하는 낱말">
          <span className="text-xs text-muted-foreground">이렇게 시작하는 낱말:</span>
          {state.more.map((w) => (
            <button
              key={w}
              type="button"
              lang="my"
              onClick={() => onSearch?.(w)}
              className="rounded-md bg-muted px-2 py-0.5 text-sm text-muted-foreground hover:bg-hover hover:text-foreground"
            >
              {w}
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">{CREDIT}</p>
    </div>
  );
}
