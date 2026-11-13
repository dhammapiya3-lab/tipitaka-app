/**
 * 문장 번호·글자 조각·각주를 다루는 순수 함수.
 * 화면을 모른다. 변환 스크립트(scripts/build-content.ts)와 화면이 같이 쓴다.
 */
import type { InlinePart, Segment } from "@/types";

/** 각주 번호 표시. 예: **42)** 또는 **42-1)** */
const NOTE_MARK = /\*\*(\d+(?:-\d+)?)\)\*\*/;
/** 각주 파일 쪽 번호 표시: 괄호가 없는 **17** 도 받는다 (맛지마 119경 현음 스님 각주가 이 형식) */
const NOTE_FILE_MARK = /\*\*(\d+(?:-\d+)?)\)?\*\*/;
/** 원본에 쓰인 서식 표시. `<\b>` 는 `</b>` 가 깨져 백스페이스 문자로 들어온 것이다. */
const TOKEN = /(<b>|<\/b>|<\x08>|<em>|<\/em>|<i>|<\/i>|\*\*\d+(?:-\d+)?\)\*\*)/;
// 줄바꿈(\n)과 탭(\t)은 남긴다.
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

/** 원래 앱 자료의 번호(dn.22, sn.1.1)를 주소용 번호(dn22, sn1.1)로 바꾼다. */
export function toSuttaId(sourceId: string): string {
  return sourceId.replace(".", "");
}

/**
 * 문장 번호의 숫자를 차례대로 (1.9 < 1.10 이 되도록).
 * 법구경처럼 게송 번호가 콜론 앞에 있는 경우(dhp2:1 < dhp10:1)도 있어 앞뒤를 모두 쓴다.
 */
function keyNumbers(key: string): number[] {
  return (key.match(/\d+/g) ?? []).map((n) => Number.parseInt(n, 10));
}

export function compareSegmentKeys(a: string, b: string): number {
  const x = keyNumbers(a);
  const y = keyNumbers(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? -1) - (y[i] ?? -1);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * 원문 글자를 글자 조각으로 나눈다. 아는 서식(굵게·기울임·각주 번호)만 바꾸고,
 * 그 밖의 `<자료실>` 같은 꺾쇠 글자는 글자 그대로 둔다.
 */
export function parseInline(raw: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let bold = false;
  let em = false;

  const pushText = (text: string) => {
    const clean = text.replace(CONTROL_CHARS, "");
    if (!clean) return;
    const type = bold ? "bold" : em ? "em" : "text";
    const last = parts.at(-1);
    if (last && last.type === type) last.text += clean;
    else parts.push({ type, text: clean });
  };

  for (const token of raw.split(TOKEN)) {
    if (token === "<b>") bold = true;
    else if (token === "</b>" || token === "<\x08>") bold = false;
    else if (token === "<em>" || token === "<i>") em = true;
    else if (token === "</em>" || token === "</i>") em = false;
    else {
      const mark = token.match(NOTE_MARK);
      if (mark && mark[0] === token) parts.push({ type: "note", mark: mark[1] });
      else pushText(token);
    }
  }

  // 원문 끝의 공백은 문장 구분용이라 지운다.
  const first = parts[0];
  if (first && first.type !== "note") first.text = first.text.trimStart();
  const last = parts.at(-1);
  if (last && last.type !== "note") last.text = last.text.trimEnd();
  return parts.filter((p) => p.type === "note" || p.text.length > 0);
}

/** 글자 조각을 서식 없는 글자로 (책갈피 미리보기 등) */
export function plainText(parts: InlinePart[]): string {
  return parts
    .map((p) => (p.type === "note" ? "" : p.text))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/** 각주 번호를 문장 순서대로 모은다. */
export function noteMarks(parts: InlinePart[]): string[] {
  return parts.flatMap((p) => (p.type === "note" ? [p.mark] : []));
}

/**
 * 각주 파일의 한 칸(문장 하나)에 각주가 여러 개 붙어 있을 수 있어 번호별로 나눈다.
 * 번호 앞에 남는 글자가 있으면 leftover 로 돌려준다(변환 단계에서 오류로 본다).
 */
export function splitNotes(raw: string): {
  notes: { mark: string; text: string }[];
  leftover: string;
} {
  const chunks = raw.split(/(?=\*\*\d+(?:-\d+)?\)?\*\*)/);
  const notes: { mark: string; text: string }[] = [];
  let leftover = "";
  for (const chunk of chunks) {
    const mark = chunk.match(NOTE_FILE_MARK);
    if (mark && chunk.startsWith(mark[0])) {
      notes.push({ mark: mark[1], text: chunk.slice(mark[0].length).trim() });
    } else {
      leftover += chunk.trim();
    }
  }
  return { notes, leftover };
}

/**
 * 경보다 작은 단위(법구경의 게송) 번호. "dhp5:1" → "dhp5".
 * 문장 번호의 앞부분이 경 번호와 같으면(dn22:1.1) 작은 단위가 없으므로 null.
 */
export function unitOf(key: string, suttaId: string): string | null {
  const prefix = key.slice(0, key.indexOf(":"));
  return prefix && prefix !== suttaId ? prefix : null;
}

/**
 * 문장이 든 문단(원래 앱의 카드 하나) 번호 — 대역·문법분석 배지를 다는 단위.
 * 게송이 있는 경(법구경)은 게송 번호(dhp5), 그 밖에는 문장 번호에서 마지막 숫자를 뗀 것.
 *   sn56.11:1.1 → sn56.11:1 / dn22:1.2.3 → dn22:1.2 / dn1:5 → dn1:5
 */
export function paragraphOf(key: string, suttaId: string): string {
  const unit = unitOf(key, suttaId);
  if (unit) return unit;
  const colon = key.indexOf(":");
  const tail = key.slice(colon + 1);
  const dot = tail.lastIndexOf(".");
  return dot > 0 ? `${key.slice(0, colon)}:${tail.slice(0, dot)}` : key;
}

/**
 * 줄의 종류 — 화면에서 어떻게 그릴지.
 *   hidden : 경·품 이름 줄(0.1~0.3). 페이지 제목이 대신한다.
 *   heading: 단락 제목(.0)과 법구경 게송의 일화 제목(dhp5:0.4 / dhp5:0)
 *   text   : 본문
 * (원래 앱과 같은 규칙)
 */
export function rowKind(key: string, suttaId: string): "hidden" | "heading" | "text" {
  const tail = key.slice(key.indexOf(":") + 1);
  if (unitOf(key, suttaId) && (tail === "0" || tail === "0.4")) return "heading";
  if (tail === "0" || tail.startsWith("0.")) return "hidden";
  return /\.0$/.test(tail) ? "heading" : "text";
}

/** `dn22:0.1` 처럼 경 이름 줄(0번)인지 */
export function isTitleKey(key: string): boolean {
  return /:0\./.test(key);
}

/** `dn22:3.0`, `dn1:1.11.0` 처럼 .0 으로 끝나는 단락 제목 줄인지 */
export function isHeadingKey(key: string): boolean {
  return !isTitleKey(key) && /\.0$/.test(key);
}

/**
 * 이 경에서 보여 줄 판본을 고른다.
 * 저장된 선택 중 이 경에 있는 판본을 쓰고, 번역(빠알리가 아닌 판본)이 하나도 없으면 첫 번역을 더한다.
 * 빠알리 판본이 둘(Mahāsaṅgīti·PTS)인 경도 있어 판본 언어로 번역인지 가린다.
 * 결과는 available 순서(빠알리 → 한국어 → 영어)를 따른다.
 */
export function pickEditions(
  available: { id: string; language: string }[],
  preferred: string[],
): string[] {
  const ids = available.map((e) => e.id);
  const chosen = new Set(preferred.filter((id) => ids.includes(id)));
  const isTranslation = (id: string) => available.some((e) => e.id === id && e.language !== "pli");
  if (![...chosen].some(isTranslation)) {
    const firstTranslation = available.find((e) => e.language !== "pli");
    if (firstTranslation) chosen.add(firstTranslation.id);
  }
  if (chosen.size === 0 && ids[0]) chosen.add(ids[0]);
  return ids.filter((id) => chosen.has(id));
}

/**
 * 판본 하나를 켜거나 끈 결과를 저장할 선택 목록으로 만든다.
 * 이 경에 없는 판본의 선택은 그대로 두어 다른 경에서 계속 쓰인다. 마지막 하나는 끌 수 없다.
 */
export function toggleEdition(
  available: string[],
  preferred: string[],
  shown: string[],
  id: string,
): string[] {
  const next = shown.includes(id) ? shown.filter((e) => e !== id) : [...shown, id];
  if (next.length === 0) return preferred;
  return [...preferred.filter((e) => !available.includes(e)), ...next];
}

/** 판본 여러 개를 문장 번호로 짝지은 한 줄 */
export interface AlignedRow {
  key: string;
  /** 판본 id → 그 판본의 문장. 판본에 없는 문장은 빠진다. */
  cells: Record<string, Segment>;
}

/**
 * 판본 여러 개를 문장 번호로 짝짓는다. 어느 판본에든 있는 번호는 모두 줄이 되고,
 * 판본에 없는 문장은 그 칸이 비어 있다.
 */
export function alignEditions(texts: Record<string, Segment[]>): AlignedRow[] {
  const rows = new Map<string, AlignedRow>();
  for (const [editionId, segments] of Object.entries(texts)) {
    for (const segment of segments) {
      const row = rows.get(segment.key) ?? { key: segment.key, cells: {} };
      row.cells[editionId] = segment;
      rows.set(segment.key, row);
    }
  }
  return [...rows.values()].sort((a, b) => compareSegmentKeys(a.key, b.key));
}
