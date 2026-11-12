import { BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ContinueReading } from "@/components/home/continue-reading";
import { DailyVerse } from "@/components/home/daily-verse";
import { PageHeader } from "@/components/layout/page-header";
import { NikayaCards } from "@/components/suttas/nikaya-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/lib/constants";
import {
  editions,
  getDhpVaggas,
  getEdition,
  getNikayaSummaries,
  getReadableSuttas,
} from "@/lib/data";
import { formatCount, suttaHref, suttaLabel } from "@/lib/format";

/** 홈의 "지금 읽을 수 있는 경"에 하나씩 보여 줄 경 수 */
const HOME_SUTTA_LIMIT = 8;

interface ReadableItem {
  href: string;
  title: React.ReactNode;
  meta: string;
}

export default function HomePage() {
  const dhpVaggas = getDhpVaggas();
  const readable = getReadableSuttas();
  const dhp = readable.filter((s) => dhpVaggas.some((v) => v.id === s.id));
  const editionLabels = (ids: string[]) => ids.map((id) => getEdition(id)?.label ?? id).join(", ");

  // 법구경 26품은 한 줄로 묶고, 나머지는 앞의 몇 개만 (경이 수백 개라 다 실으면 홈이 무거워진다)
  const others = readable.filter((s) => !dhp.includes(s));
  const items: ReadableItem[] = [
    ...others
      .slice(0, HOME_SUTTA_LIMIT)
      .map((s) => ({
        href: suttaHref(s.id),
        title: s.nameKo ?? <span lang="pi">{s.name}</span>,
        meta: `${suttaLabel(s.id)} · 판본 ${editionLabels(s.editions)}`,
      })),
    ...(dhp.length > 0
      ? [
          {
            href: "/suttas/kn/dhp",
            title: "법구경 (Dhammapada)",
            meta: `${dhp.length}품 · 판본 ${editionLabels(dhp[0].editions)}`,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={SERVICE_NAME} description={<span lang="pi">{SERVICE_TAGLINE}</span>} />

      <ContinueReading />

      {dhp.length > 0 ? (
        <DailyVerse
          vaggas={dhpVaggas}
          editions={editions.filter((e) => dhp[0].editions.includes(e.id))}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>지금 읽을 수 있는 경</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 px-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                <BookOpen className="size-4" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{item.title}</span>
                <span className="t-meta">{item.meta}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          ))}
          {others.length > HOME_SUTTA_LIMIT ? (
            <Link
              href="/suttas"
              className="t-sub mt-1 px-3 py-2 font-semibold text-primary hover:underline"
            >
              읽을 수 있는 경 {formatCount(readable.length)}개 모두 보기 →
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="t-section">경장 5부 니까야</h2>
        <NikayaCards items={getNikayaSummaries()} />
      </section>
    </div>
  );
}
