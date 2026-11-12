import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Screen, TopBar } from "@/components/layout/app-bar";
import { ContinueReading } from "@/components/home/continue-reading";
import { DailyVerse } from "@/components/home/daily-verse";
import { KoreanNikayaTiles } from "@/components/home/korean-nikaya-tiles";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/lib/constants";
import { editions, getDhpVaggas, getKoreanSummaries, getReadableSuttas } from "@/lib/data";

/** 홈 아래 "테라와다불교" 칸 — 지금은 준비 중 페이지로 이어진다 */
const THERAVADA_LINKS = [
  { href: "/theravada", label: "테라와다란" },
  { href: "/centers", label: "전국 수행처" },
  { href: "/community", label: "커뮤니티" },
];

const CARD = "rounded-2xl border bg-card p-6 shadow-sm";

/**
 * 홈 — 원래 앱과 같은 모양(호박색 띠 · 오늘의 게송)에
 * 새로 더한 이어 읽기 · 지금 읽을 수 있는 경 · 테라와다불교 칸을 같은 카드 모양으로 붙였다.
 */
export default function HomePage() {
  const dhpVaggas = getDhpVaggas();
  const dhp = getReadableSuttas().find((s) => dhpVaggas.some((v) => v.id === s.id));

  return (
    <>
      <TopBar title={SERVICE_NAME} pali={SERVICE_TAGLINE} />
      <Screen className="flex flex-col gap-4 px-6 py-8">
        <div className="empty:hidden">
          <ContinueReading />
        </div>

        {dhp ? (
          <DailyVerse vaggas={dhpVaggas} editions={editions.filter((e) => dhp.editions.includes(e.id))} />
        ) : null}

        <section className={CARD}>
          <h2 className="mb-1 text-base font-bold">지금 읽을 수 있는 경</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            니까야를 누르면 한글 번역이 있는 경을 볼 수 있습니다.
          </p>
          <KoreanNikayaTiles items={getKoreanSummaries()} />
        </section>


        <section className="rounded-2xl border bg-card px-3 pt-5 pb-2 shadow-sm">
          <h2 className="mb-1 px-3 text-base font-bold">테라와다불교</h2>
          <ul className="flex flex-col">
            {THERAVADA_LINKS.map((item, i) => (
              <li key={item.href} className={i > 0 ? "border-t" : undefined}>
                <Link
                  href={item.href}
                  className="flex min-h-13 items-center justify-between rounded-xl px-3 text-[15px] outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {item.label}
                  <ChevronRight className="size-4 text-faint" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <Link href="/about" className="t-meta self-center py-2 hover:text-foreground hover:underline">
          이 사이트에 대해
        </Link>
      </Screen>
    </>
  );
}
