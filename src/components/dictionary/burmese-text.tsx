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
