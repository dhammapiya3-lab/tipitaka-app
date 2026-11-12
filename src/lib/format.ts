/** 경 번호 표시: dn22 → DN 22, sn1.1 → SN 1.1 */
export function suttaLabel(id: string): string {
  return id.replace(/^([a-z]+(?:-[a-z]+)*)/, (letters) => `${letters.toUpperCase()} `);
}

export function formatCount(n: number): string {
  return n.toLocaleString("ko-KR");
}

/**
 * 오늘의 번호 (1 ~ count). 그 기기의 날짜가 같으면 하루 종일 같은 번호이고, 날마다 하나씩 넘어간다.
 */
export function dailyNumber(date: Date, count: number): number {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return (((day % count) + count) % count) + 1;
}

/** 저장한 날짜 표시: 2026. 11. 3. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR");
}

/**
 * 경 읽기 주소. 끝에 / 를 꼭 붙인다 — sn1.1 처럼 점이 든 번호를
 * 화면 안 이동(Next 라우터)이 파일 확장자로 착각하지 않게 하기 위해서다.
 */
export function suttaHref(suttaId: string, rowKey?: string): string {
  return `/sutta/${suttaId}/${rowKey ? `#${rowKey}` : ""}`;
}
