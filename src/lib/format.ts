/** 경 번호 표시: dn22 → DN 22, sn1.1 → SN 1.1 */
export function suttaLabel(id: string): string {
  return id.replace(
    /^([a-z]+(?:-[a-z]+)*)/,
    (letters) => `${letters.toUpperCase()} `,
  );
}

export function formatCount(n: number): string {
  return n.toLocaleString("ko-KR");
}

/**
 * 오늘의 번호 (1 ~ count). 그 기기의 날짜가 같으면 하루 종일 같은 번호이고, 날마다 하나씩 넘어간다.
 */
export function dailyNumber(date: Date, count: number): number {
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
  return (((day % count) + count) % count) + 1;
}

/** 저장한 날짜 표시: 2026. 11. 3. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR");
}

/**
 * 경 읽기 주소: /sutta/?id=sn56.11#sn56.11:1.1
 * 경 화면은 페이지 하나가 ?id= 로 경을 고른다(경마다 페이지를 만들면 파일이 호스팅 한도를 넘는다).
 * 옛 주소 /sutta/sn56.11/ 은 public/_redirects 가 새 주소로 넘긴다.
 */
export function suttaHref(
  suttaId: string,
  rowKey?: string,
  /** 처음 볼 층 — 주석서·복주석서로 바로 열 때 (?layer=) */
  layer?: "attha" | "tika",
  /** 문단별로 보기로 열 때 처음 볼 문단 — 앞뒤 경으로 이어 넘길 때 (?para=first|last) */
  paragraph?: "first" | "last",
): string {
  return `/sutta/?id=${encodeURIComponent(suttaId)}${layer ? `&layer=${layer}` : ""}${paragraph ? `&para=${paragraph}` : ""}${rowKey ? `#${rowKey}` : ""}`;
}
