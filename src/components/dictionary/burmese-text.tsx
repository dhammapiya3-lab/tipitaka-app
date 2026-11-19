"use client";

/**
 * 미얀마어 글 — 낱말마다 눌러서 미얀마어 위키낱말사전 풀이(미얀마어 뜻·영어 뜻)를 본다.
 * 낱말 경계는 사전에 있는 가장 긴 낱말부터 맞춰 찾는다(src/lib/burmese.ts). 사전에 없는 글자는 그대로.
 * 글 자체는 바꾸지 않는다 — 조각들을 이으면 원래 글과 같다.
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

/** 화면이 한가할 때 하기 */
function whenIdle(fn: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(fn, 200);
  return () => window.clearTimeout(id);
}

/** 누른 자리의 글자 위치 (이 span 안의 글자 순번) — 브라우저마다 이름이 다르다 */
function offsetAt(e: React.MouseEvent<HTMLElement>): number | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null = null;
  let offset = 0;
  const pos = doc.caretPositionFromPoint?.(e.clientX, e.clientY);
  if (pos) {
    node = pos.offsetNode;
    offset = pos.offset;
  } else {
    const range = doc.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }
  if (!node || !e.currentTarget.contains(node)) return null;
  // span 안 앞쪽 글자 수를 더한다 (고른 낱말을 표시하느라 글이 여러 조각일 수 있다)
  let before = 0;
  const walker = document.createTreeWalker(e.currentTarget, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (t === node) return before + offset;
    before += t.textContent?.length ?? 0;
  }
  return null;
}

/**
 * 글은 통째로 그대로 그리고(낱말마다 단추를 만들지 않아 가볍다), 누른 자리에서만 낱말을 찾는다.
 * 낱말 목록은 화면이 한가할 때 미리 받아 둔다.
 */
export function BurmeseText({ text }: { text: string }) {
  const [picked, setPicked] = useState<{ word: string; at: number } | null>(null);
  const [senses, setSenses] = useState<BurmeseEntry | "loading" | "error">("loading");

  useEffect(
    () =>
      whenIdle(() => {
        fetchBurmeseWords().catch(() => {});
      }),
    [],
  );

  useEffect(() => {
    if (!picked) return;
    let alive = true;
    fetchBurmeseEntry(picked.word)
      .then((s) => alive && setSenses(s))
      .catch(() => alive && setSenses("error"));
    return () => {
      alive = false;
    };
  }, [picked]);

  const onTap = async (e: React.MouseEvent<HTMLSpanElement>) => {
    const at = offsetAt(e);
    if (at === null) return;
    const dict = await fetchBurmeseWords().catch(() => null);
    if (!dict) return;
    // 누른 글자가 든 미얀마 글 덩어리만 나눠 본다
    let s = at;
    let t = at;
    const isMy = (c: string | undefined) => !!c && /[\u1000-\u109F\u200C\u200D]/u.test(c);
    if (!isMy(text[at])) return;
    while (s > 0 && isMy(text[s - 1])) s--;
    while (t < text.length && isMy(text[t])) t++;
    let pos = s;
    for (const piece of segmentBurmese(text.slice(s, t), dict)) {
      const end = pos + piece.text.length;
      if (at < end) {
        if (!piece.word) return;
        setSenses("loading");
        setPicked((p) => (p && p.at === pos ? null : { word: piece.text, at: pos }));
        return;
      }
      pos = end;
    }
  };

  const mark = picked && text.slice(picked.at, picked.at + picked.word.length) === picked.word;
  return (
    <>
      <span onClick={onTap} className="cursor-pointer" title="미얀마어 낱말을 누르면 뜻이 나옵니다">
        {mark ? (
          <>
            {text.slice(0, picked.at)}
            <mark className="rounded-sm bg-primary/20 text-inherit">{picked.word}</mark>
            {text.slice(picked.at + picked.word.length)}
          </>
        ) : (
          text
        )}
      </span>
      {picked && (
        <span className="mt-2 block rounded-lg border bg-muted/40 p-3 text-sm">
          <span className="flex items-baseline justify-between gap-2">
            <span lang="my" className="font-semibold text-foreground">
              {picked.word}
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
            <BurmeseSenses entry={senses} />
          )}
          <BurmeseCredit />
        </span>
      )}
    </>
  );
}

const CREDIT =
  "출처: 우 호크 세인 『미얀마어-영어-빠알리어 사전』(Pn Daza 스님 MEP Dictionary 자료) · 미얀마어 위키낱말사전(my.wiktionary.org, CC BY-SA 4.0) · 영어 위키낱말사전 미얀마어 항목(en.wiktionary.org, kaikki.org 정리본, CC BY-SA 4.0) — 자세한 이용 조건은 정보 화면";

function BurmeseCredit() {
  return <span className="mt-2 block text-[11px] text-muted-foreground">{CREDIT}</span>;
}

/** 두 사전의 풀이 (낱말 풀이 상자와 사전 검색이 같이 쓴다) */
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
