/**
 * 빠알리 단어 정리·조각 파일 이름 — 화면을 모르는 순수 함수.
 * 변환 스크립트(scripts/build-dictionary.ts)와 화면이 같은 규칙을 써야 단어를 찾을 수 있다.
 */

const PALI_LETTERS = "a-zāīūṃṅñṭḍṇḷ";
const NOT_LETTER = new RegExp(`[^${PALI_LETTERS}]`, "g");
const WORD = new RegExp(`[${PALI_LETTERS}ṁĀĪŪṀṂṄÑṬḌṆḶA-Z]+`, "g");

/** 사전 찾기용 정리: 소문자, ṁ → ṃ(DPD 표기), 글자 아닌 것 제거 */
export function normalizeWord(word: string): string {
  return word.normalize("NFC").toLowerCase().replace(/ṁ/g, "ṃ").replace(NOT_LETTER, "");
}

const FOLD: Record<string, string> = {
  ā: "a", ī: "i", ū: "u", ṃ: "m", ṅ: "n", ñ: "n", ṭ: "t", ḍ: "d", ṇ: "n", ḷ: "l",
};

/**
 * 빠알리 자판 없이 친 글자와 비교하기 위해 발음 구별 기호를 뗀다.
 * satipaṭṭhāna → satipatthana. 정리(normalizeWord)를 먼저 한 뒤 쓴다.
 */
export function foldPali(word: string): string {
  return [...normalizeWord(word)].map((ch) => FOLD[ch] ?? ch).join("");
}

/** 문장 안에서 누를 수 있는 단어 조각들 (단어 / 단어 아닌 글자를 번갈아) */
export function splitWords(text: string): { text: string; word: boolean }[] {
  const out: { text: string; word: boolean }[] = [];
  let last = 0;
  for (const m of text.normalize("NFC").matchAll(WORD)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ text: text.slice(last, start), word: false });
    out.push({ text: m[0], word: true });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), word: false });
  return out;
}

// 파일 이름에 쓸 수 있도록 빠알리 글자를 겹치지 않는 영문 두 글자로 바꾼다.
const SLUG: Record<string, string> = {
  ā: "a_", ī: "i_", ū: "u_", ṃ: "m_", ṅ: "n_", ñ: "nj", ṭ: "t_", ḍ: "d_", ṇ: "nn", ḷ: "l_",
};

export function slugLetters(letters: string): string {
  return [...letters].map((ch) => SLUG[ch] ?? ch).join("");
}

/**
 * 정리된 단어가 들어 있는 조각 파일 이름.
 * 기본은 앞 두 글자이고, 너무 커서 나눈 앞부분(split)이면 한 글자씩 더 늘린다.
 * 단어가 그 앞부분보다 짧으면 단어 전체가 조각 이름이 된다.
 */
export function shardOf(normalized: string, split: ReadonlySet<string>): string {
  const letters = [...normalized];
  let length = 2;
  while (length < letters.length && split.has(letters.slice(0, length).join(""))) length++;
  return slugLetters(letters.slice(0, length).join("")) || "_";
}

/** 조각 파일을 만들 때 쓰는 앞부분 (shardOf 와 같은 규칙, 파일 이름으로 바꾸기 전) */
export function shardPrefix(normalized: string, length: number): string {
  return [...normalized].slice(0, length).join("");
}

/** DPD 표제어의 번호를 뗀 형태: "dhamma 1.01" → "dhamma" */
export function cleanLemma(lemma: string): string {
  return lemma.replace(/ \d.*$/, "").trim();
}
