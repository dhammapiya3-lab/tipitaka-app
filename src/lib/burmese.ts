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

const RUN = /[\u1000-\u109F\u200C\u200D]+/gu;

/**
 * 낱말 목록 + 첫 글자마다 가장 긴 낱말 길이 (맞춰 볼 길이를 줄여 빠르게).
 * 8만여 개를 Set 에 넣는 데도 휴대폰에서는 눈에 띄게 걸려서, 정렬된 목록을 이분 탐색한다.
 */
export type BurmeseDict = { has: (w: string) => boolean; maxByFirst: Map<string, number> };

export function makeBurmeseDict(list: string[]): BurmeseDict {
  const sorted = list.slice().sort();
  const maxByFirst = new Map<string, number>();
  for (const w of sorted) {
    const c = w[0];
    if (c !== undefined && (maxByFirst.get(c) ?? 0) < w.length) maxByFirst.set(c, w.length);
  }
  return { has: (w) => sortedHas(sorted, w), maxByFirst };
}

/** 이미 정렬된 목록(빌드에서 정렬해 둠)을 그대로 쓴다 — 다시 정렬하지 않는다 */
export function makeBurmeseDictSorted(sorted: string[]): BurmeseDict {
  const maxByFirst = new Map<string, number>();
  let first = "";
  let max = 0;
  for (const w of sorted) {
    const c = w[0] ?? "";
    if (c !== first) {
      if (first) maxByFirst.set(first, max);
      first = c;
      max = 0;
    }
    if (w.length > max) max = w.length;
  }
  if (first) maxByFirst.set(first, max);
  return { has: (w) => sortedHas(sorted, w), maxByFirst };
}

function sortedHas(sorted: string[], w: string): boolean {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = sorted[mid]!;
    if (v === w) return true;
    if (v < w) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

/** 글을 [낱말 / 낱말 아님] 조각으로. 두 글자 이상인 사전 낱말만 낱말로 친다. */
export function segmentBurmese(text: string, dict: BurmeseDict): BurmesePiece[] {
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
      const max = Math.min(dict.maxByFirst.get(run[i]!) ?? 0, run.length - i);
      for (let len = max; len >= 2; len--) {
        if (len >= 2 && dict.has(run.slice(i, i + len))) {
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
