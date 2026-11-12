/**
 * 원래 앱의 경 번호(sn.1.1) → 판본 폴더 안의 파일 경로(sn1/sn1.1). 원래 앱 코드와 같은 규칙.
 * scripts/fetch-from-site.mjs 의 suttaFilePath 와 같아야 한다.
 */

/** 이띠웃따까 품 범위 (원래 앱과 같은 값) */
const ITI_VAGGAS = [
  [1, 1, 10], [2, 11, 20], [3, 21, 27], [4, 28, 37], [5, 38, 49], [6, 50, 59],
  [7, 60, 69], [8, 70, 79], [9, 80, 89], [10, 90, 99], [11, 100, 112],
] as const;

export function suttaFilePath(sourceId: string): string {
  const m = sourceId.split(".");
  const y = m[0];
  if ((y === "an" || y === "sn") && m.length >= 3) return `${y}${m[1]}/${y}${m[1]}.${m[2]}`;
  if ((y === "ud" || y === "snp") && m.length >= 3) return `vagga${m[1]}/${y}${m[1]}.${m[2]}`;
  if (y === "iti" && m.length >= 2) {
    const n = Number.parseInt(m[1], 10);
    const vagga = ITI_VAGGAS.find(([, from, to]) => n >= from && n <= to)?.[0] ?? 1;
    return `vagga${vagga}/${y}${m[1]}`;
  }
  if (["thag", "thig", "ps", "mil"].includes(y) && m.length >= 3) return `${y}${m.slice(1).join(".")}`;
  return m.length >= 2 ? `${y}${m[1]}` : sourceId.replace(/\./g, "");
}
