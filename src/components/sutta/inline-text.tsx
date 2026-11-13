import { splitWords } from "@/lib/pali";
import { cn } from "@/lib/utils";
import { HIGHLIGHT_CLASS, type HighlightColor } from "@/store/highlights";
import type { InlinePart } from "@/types";

/** 밑줄 범위 — 각주 번호를 뺀 글자들의 순번 [start, end) */
export interface InlineHighlight {
  id: string;
  start: number;
  end: number;
  color: HighlightColor;
}

/**
 * 글자 조각을 그린다. 원문을 HTML 로 해석하지 않는다(굵게·기울임·각주만 정해진 모양으로).
 * onNote 가 있으면 각주 번호가 누를 수 있는 버튼이 된다.
 * onWord 가 있으면 단어마다 누를 수 있게 된다(빠알리 원문의 사전 찾기).
 * activeWord 가 있으면 그 순번의 단어를 표시한다(키보드로 단어 고르기).
 */
export function InlineText({
  parts,
  onNote,
  openMarks,
  onWord,
  activeWord,
  linked,
  onLinked,
  highlights,
  onHighlight,
  variants = false,
}: {
  /** 빠알리 원문: 이본 표기 [..] 를 따로 감싸 둔다 (설정에서 "이본 표기 감추기"를 켜면 CSS 로 감춘다) */
  variants?: boolean;
  /** 밑줄·형광펜 (누르면 onHighlight) */
  highlights?: InlineHighlight[];
  onHighlight?: (id: string, target: HTMLElement) => void;
  /** 주석과 이어진 낱말인지 (켜 두면 밑줄, 누르면 onLinked) */
  linked?: (word: string) => boolean;
  onLinked?: (word: string) => void;
  parts: InlinePart[];
  onNote?: (mark: string) => void;
  openMarks?: ReadonlySet<string>;
  onWord?: (word: string) => void;
  activeWord?: number | null;
}) {
  // 단어 순번은 조각을 넘어 이어진다 (reader.ts 의 wordsOf 와 같은 순서)
  let wordIndex = 0;
  let charIndex = 0;
  const plain = (value: string) => {
    if (!onWord) return value;
    const start = wordIndex;
    wordIndex += splitWords(value).filter((w) => w.word).length;
    return (
      <Words
        text={value}
        onWord={onWord}
        start={start}
        activeWord={activeWord ?? null}
        linked={linked}
        onLinked={onLinked}
      />
    );
  };
  // 밑줄 범위에 걸치는 곳은 잘라서 <mark> 로 감싼다
  const text = (value: string) => {
    const from = charIndex;
    charIndex += value.length;
    const hits = (highlights ?? []).filter(
      (h) => h.start < from + value.length && h.end > from,
    );
    if (hits.length === 0) return plain(value);
    const cuts = new Set([0, value.length]);
    for (const h of hits) {
      cuts.add(Math.max(0, h.start - from));
      cuts.add(Math.min(value.length, h.end - from));
    }
    const points = [...cuts].sort((a, b) => a - b);
    return points.slice(0, -1).map((a, k) => {
      const b = points[k + 1];
      const piece = value.slice(a, b);
      const h = hits.find((x) => x.start <= from + a && x.end >= from + b);
      if (!h) return <span key={k}>{plain(piece)}</span>;
      return (
        <mark
          key={k}
          data-highlight={h.id}
          onClick={(e) => {
            if (!onHighlight || (e.target as Element).closest("[data-word]"))
              return;
            onHighlight(h.id, e.currentTarget);
          }}
          className={cn(
            "rounded-sm bg-transparent text-inherit",
            HIGHLIGHT_CLASS[h.color],
            onHighlight && "cursor-pointer",
          )}
        >
          {plain(piece)}
        </mark>
      );
    });
  };

  // 이본 표기는 글자를 지우지 않고 감싸기만 한다 — 단어 순번·밑줄 위치가 그대로 맞도록
  const body = (value: string) =>
    variants && value.includes("[")
      ? value.split(VARIANT).map((piece, k) =>
          VARIANT_ONLY.test(piece) ? (
            <span key={k} data-variant>
              {text(piece)}
            </span>
          ) : (
            <span key={k}>{text(piece)}</span>
          ),
        )
      : text(value);

  return parts.map((part, i) => {
    switch (part.type) {
      case "bold":
        return (
          <strong key={i} className="font-bold">
            {body(part.text)}
          </strong>
        );
      case "em":
        return <em key={i}>{body(part.text)}</em>;
      case "note":
        return onNote ? (
          <button
            key={i}
            type="button"
            data-note
            onClick={() => onNote(part.mark)}
            aria-expanded={openMarks?.has(part.mark) ?? false}
            aria-label={`각주 ${part.mark}`}
            className="mx-0.5 rounded px-0.5 align-super text-[0.7em] leading-none font-semibold text-primary outline-none hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {part.mark}
          </button>
        ) : (
          <sup
            key={i}
            data-note
            className="mx-0.5 text-[0.7em] text-muted-foreground"
          >
            {part.mark}
          </sup>
        );
      default:
        return <span key={i}>{body(part.text)}</span>;
    }
  });
}

/** 이본 표기: 앞 공백까지 함께 "[…]" */
const VARIANT = /(\s*\[[^\]]*\])/;
const VARIANT_ONLY = /^\s*\[[^\]]*\]$/;

/** 단어마다 누를 수 있는 글자. 키보드로는 문장을 고른 뒤 ← → 로 단어를 옮긴다. */
function Words({
  text,
  onWord,
  start,
  activeWord,
  linked,
  onLinked,
}: {
  text: string;
  onWord: (word: string) => void;
  start: number;
  activeWord: number | null;
  linked?: (word: string) => boolean;
  onLinked?: (word: string) => void;
}) {
  let n = start;
  return splitWords(text).map((piece, i) => {
    if (!piece.word) return piece.text;
    const index = n++;
    const isLinked = Boolean(linked && onLinked && linked(piece.text));
    return (
      <span
        key={i}
        data-word
        title={isLinked ? "주석 보기" : undefined}
        onClick={() => (isLinked ? onLinked!(piece.text) : onWord(piece.text))}
        className={cn(
          "cursor-pointer rounded-sm hover:bg-brand-soft hover:text-brand-ink",
          isLinked &&
            "text-amber-800 underline decoration-amber-500 decoration-dotted decoration-2 underline-offset-4 dark:text-amber-300",
          index === activeWord &&
            "bg-brand-soft text-brand-ink ring-2 ring-primary/40",
        )}
      >
        {piece.text}
      </span>
    );
  });
}
