import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SuttaView } from "@/components/sutta/sutta-view";
import {
  editions,
  getAdjacentSuttas,
  getReadableSuttas,
  getSutta,
} from "@/lib/data";
import type { CatalogSutta } from "@/types";

// 정적 빌드라 본문이 있는 경의 주소만 미리 만든다.
export const dynamicParams = false;

export function generateStaticParams() {
  return getReadableSuttas().map((s) => ({ id: s.id }));
}

const titleOf = (s: CatalogSutta) => s.nameKo ?? s.name;
const linkOf = (s: CatalogSutta | null) => (s ? { id: s.id, title: titleOf(s) } : null);

export async function generateMetadata({
  params,
}: PageProps<"/sutta/[id]">): Promise<Metadata> {
  const sutta = getSutta((await params).id);
  return { title: sutta ? titleOf(sutta) : undefined };
}

export default async function SuttaPage({ params }: PageProps<"/sutta/[id]">) {
  const sutta = getSutta((await params).id);
  if (!sutta) notFound();
  const { prev, next } = getAdjacentSuttas(sutta.id);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={titleOf(sutta)}
        titleLang={sutta.nameKo ? undefined : "pi"}
        description={
          <>
            {sutta.id.toUpperCase()}
            {sutta.nameKo ? <span lang="pi"> · {sutta.name}</span> : null}
          </>
        }
      />
      <SuttaView
        suttaId={sutta.id}
        suttaTitle={titleOf(sutta)}
        editions={editions.filter((e) => sutta.editions.includes(e.id))}
        noteEditions={sutta.noteEditions}
        nissayaEditions={editions.filter((e) => sutta.nissaya.includes(e.id))}
        prev={linkOf(prev)}
        next={linkOf(next)}
      />
    </div>
  );
}
