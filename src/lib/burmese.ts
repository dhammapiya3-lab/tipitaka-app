/**
 * 미얀마어 글을 낱말로 나누기 — 미얀마어는 띄어쓰기가 거의 없어서, 사전(미얀마어 위키낱말사전)에 있는
 * 가장 긴 낱말부터 맞춘다. 사전에 없는 글자는 그대로 둔다.
 */
export const MYWIKT_SHARDS = 32;

/** 조각 번호 — scripts/build-mywikt.ts 와 같은 계산 */
export function mywiktHash(word: string): number {
  let h = 0;
  for (const ch of word) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % MYWIKT_SHARDS;
}

export type BurmesePiece = { text: string; word: boolean };

const RUN = /[က-႟‌‍]+/gu;

/** 글을 [낱말 / 낱말 아님] 조각으로. 두 글자 이상인 사전 낱말만 낱말로 친다. */
export function segmentBurmese(
  text: string,
  words: Set<string>,
  maxLen: number,
): BurmesePiece[] {
  const out: BurmesePiece[] = [];
  const plain = (t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last && !last.word) last.text += t;
    else out.push({ text: t, word: false });
  };
  let at = 0;
  for (const m of text.matchAll(RUN)) {
    plain(text.slice(at, m.index));
    const run = m[0];
    let i = 0;
    while (i < run.length) {
      let hit = 0;
      for (let len = Math.min(maxLen, run.length - i); len >= 2; len--) {
        if (words.has(run.slice(i, i + len))) {
          hit = len;
          break;
        }
      }
      if (hit) {
        out.push({ text: run.slice(i, i + hit), word: true });
        i += hit;
      } else {
        plain(run[i]!);
        i += 1;
      }
    }
    at = m.index + run.length;
  }
  plain(text.slice(at));
  return out;
}
