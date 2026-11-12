import { splitWords } from "@/lib/pali";
import { cn } from "@/lib/utils";
import type { InlinePart } from "@/types";

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
}: {
  parts: InlinePart[];
  onNote?: (mark: string) => void;
  openMarks?: ReadonlySet<string>;
  onWord?: (word: string) => void;
  activeWord?: number | null;
}) {
  // 단어 순번은 조각을 넘어 이어진다 (reader.ts 의 wordsOf 와 같은 순서)
  let wordIndex = 0;
  const text = (value: string) => {
    if (!onWord) return value;
    const start = wordIndex;
    wordIndex += splitWords(value).filter((w) => w.word).length;
    return <Words text={value} onWord={onWord} start={start} activeWord={activeWord ?? null} />;
  };

  return parts.map((part, i) => {
    switch (part.type) {
      case "bold":
        return (
          <strong key={i} className="font-bold">
            {text(part.text)}
          </strong>
        );
      case "em":
        return <em key={i}>{text(part.text)}</em>;
      case "note":
        return onNote ? (
          <button
            key={i}
            type="button"
            onClick={() => onNote(part.mark)}
            aria-expanded={openMarks?.has(part.mark) ?? false}
            aria-label={`각주 ${part.mark}`}
            className="mx-0.5 rounded px-0.5 align-super text-[0.7em] leading-none font-semibold text-primary outline-none hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {part.mark}
          </button>
        ) : (
          <sup key={i} className="mx-0.5 text-[0.7em] text-muted-foreground">
            {part.mark}
          </sup>
        );
      default:
        return <span key={i}>{text(part.text)}</span>;
    }
  });
}

/** 단어마다 누를 수 있는 글자. 키보드로는 문장을 고른 뒤 ← → 로 단어를 옮긴다. */
function Words({
  text,
  onWord,
  start,
  activeWord,
}: {
  text: string;
  onWord: (word: string) => void;
  start: number;
  activeWord: number | null;
}) {
  let n = start;
  return splitWords(text).map((piece, i) => {
    if (!piece.word) return piece.text;
    const index = n++;
    return (
      <span
        key={i}
        data-word
        onClick={() => onWord(piece.text)}
        className={cn(
          "cursor-pointer rounded-sm hover:bg-brand-soft hover:text-brand-ink",
          index === activeWord && "bg-brand-soft text-brand-ink ring-2 ring-primary/40",
        )}
      >
        {piece.text}
      </span>
    );
  });
}
