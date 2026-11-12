import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Nikaya } from "@/types";

/** 니까야 짧은 이름 — 좁은 칸에 들어가게 "니까야"를 뺀다 */
function shortName(n: Nikaya): string {
  return n.nameKo.replace(/\s*니까야$/, "");
}

/**
 * 홈의 "지금 읽을 수 있는 경" — 니까야 다섯 칸. 누르면 그 니까야의 한국어 번역 경 목록으로 들어간다.
 * 폰은 윗줄 셋·아랫줄 둘(아랫줄은 넓게), 넓은 화면은 한 줄에 다섯.
 */
export function KoreanNikayaTiles({ items }: { items: { nikaya: Nikaya; count: number }[] }) {
  return (
    <nav aria-label="니까야" className="grid grid-cols-6 gap-2 sm:grid-cols-5">
      {items.map(({ nikaya, count }, i) => (
        <Link
          key={nikaya.id}
          href={`/readable/${nikaya.id}`}
          className={cn(
            "flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border bg-gray-50 px-1 outline-none transition-colors hover:border-amber-200 hover:bg-amber-50 dark:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:col-span-1",
            i < 3 ? "col-span-2" : "col-span-3",
          )}
        >
          <span className="text-base font-bold">{shortName(nikaya)}</span>
          <span className="text-sm font-bold text-primary">
            {count}
          </span>
        </Link>
      ))}
    </nav>
  );
}
