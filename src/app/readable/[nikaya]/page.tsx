import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { catalog, getKoreanSuttas, getNikaya, koreanEditionCount } from "@/lib/data";
import { suttaHref, suttaLabel } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return catalog.nikayas.map((n) => ({ nikaya: n.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/readable/[nikaya]">): Promise<Metadata> {
  const nikaya = getNikaya((await params).nikaya);
  return { title: nikaya ? `${nikaya.nameKo} — 지금 읽을 수 있는 경` : undefined };
}

/** 홈에서 니까야를 누르면 — 한국어 번역이 있는 경을 경 단위로 한 목록에 */
export default async function ReadableNikayaPage({ params }: PageProps<"/readable/[nikaya]">) {
  const nikaya = getNikaya((await params).nikaya);
  if (!nikaya) notFound();
  const suttas = getKoreanSuttas(nikaya.id);

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
      <PageHeader
        title={nikaya.nameKo}
        description={
          <>
            <span lang="pi">{nikaya.name}</span> · 한글 번역 {suttas.length}개 경
          </>
        }
      />
      {suttas.length === 0 ? (
        <Card>
          <p className="t-sub px-5">아직 한글 번역이 있는 경이 없습니다.</p>
        </Card>
      ) : (
        <Card className="gap-0 px-2 py-2">
          <ul className="flex flex-col">
            {suttas.map((s, i) => (
              <li key={s.id} className={i > 0 ? "border-t" : undefined}>
                <Link
                  href={suttaHref(s.id)}
                  className="flex min-h-15 items-center gap-3 rounded-2xl px-3 py-2 outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-base font-bold">{s.nameKo ?? <span lang="pi">{s.name}</span>}</span>
                    <span className="t-meta">
                      {suttaLabel(s.id)}
                      {s.nameKo ? <span lang="pi"> · {s.name}</span> : null}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-ink">
                    번역 {koreanEditionCount(s)}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
