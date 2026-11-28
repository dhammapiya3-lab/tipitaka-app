import { foldPali } from "@/lib/pali";

/** 주석서 풀이 찾기 조각 수 — scripts/build-att-terms.ts 와 같아야 한다 */
export const ATT_SHARDS = 256;

/**
 * 주석서 풀이의 찾는 열쇠.
 * 굵은 표제어는 "~ti" 앞이라 끝 모양이 바뀐다(evaṃ → <b>eva</b>nti, hoti → <b>hotī</b>ti).
 * 그래서 발음 기호를 떼고(긴 모음도 짧게) 끝의 ṃ(m) 을 뗀 꼴로 맞춘다 — 자판 글자로 쳐도 찾힌다.
 */
export function attKey(word: string): string {
  return foldPali(word).replace(/m$/, "");
}

export function attShard(key: string): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h % ATT_SHARDS;
}
