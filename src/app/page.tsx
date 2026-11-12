import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { ContinueReading } from "@/components/home/continue-reading";
import { DailyVerse } from "@/components/home/daily-verse";
import { KoreanNikayaTiles } from "@/components/home/korean-nikaya-tiles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { editions, getDhpVaggas, getKoreanSummaries, getReadableSuttas } from "@/lib/data";

/** 홈 아래 "테라와다불교" 칸 — 지금은 준비 중 페이지로 이어진다 */
const THERAVADA_LINKS = [
  { href: "/theravada", label: "테라와다란" },
  { href: "/centers", label: "전국 수행처" },
  { href: "/community", label: "커뮤니티" },
];

export default function HomePage() {
  const dhpVaggas = getDhpVaggas();
  const dhp = getReadableSuttas().find((s) => dhpVaggas.some((v) => v.id === s.id));

  return (
    // 폰은 한 줄로(이어 읽기 → 오늘의 경전 → 읽을 수 있는 경 → 안내), 컴퓨터는 왼쪽 넓은 칸 + 오른쪽 좁은 칸.
    // 폰에서는 두 칸 묶음을 풀어(contents) 한 줄로 늘어놓고, 이어 읽기를 맨 앞으로(order-first) 올린다.
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-6">
      <div className="contents lg:flex lg:flex-col lg:gap-6">
        {dhp ? (
          <DailyVerse vaggas={dhpVaggas} editions={editions.filter((e) => dhp.editions.includes(e.id))} />
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="t-section">지금 읽을 수 있는 경</CardTitle>
            <CardDescription>니까야를 누르면 한글 번역이 있는 경을 볼 수 있습니다</CardDescription>
          </CardHeader>
          <CardContent>
            <KoreanNikayaTiles items={getKoreanSummaries()} />
          </CardContent>
        </Card>
      </div>

      <div className="contents lg:flex lg:flex-col lg:gap-6">
        <div className="order-first empty:hidden lg:order-none">
          <ContinueReading />
        </div>
        <Card className="gap-1 py-3">
          <CardHeader className="pt-2">
            <CardTitle className="t-section">테라와다불교</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <ul className="flex flex-col">
              {THERAVADA_LINKS.map((item, i) => (
                <li key={item.href} className={i > 0 ? "border-t" : undefined}>
                  <Link
                    href={item.href}
                    className="flex min-h-13 items-center justify-between rounded-2xl px-3 text-[15px] outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {item.label}
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Link href="/about" className="t-meta self-center py-2 hover:text-foreground hover:underline lg:self-start lg:px-2">
          이 사이트에 대해
        </Link>
      </div>
    </div>
  );
}
