import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Screen } from "@/components/layout/app-bar";
import { CatalogTree } from "@/components/suttas/catalog-tree";
import { NikayaBar } from "@/components/suttas/nikaya-bar";
import { ReadableFilter } from "@/components/suttas/readable-filter";
import { EditionsProvider } from "@/components/suttas/sutta-row";
import { catalog, editions, getNikaya, splitsIntoGroups } from "@/lib/data";

export const dynamicParams = false;

export function generateStaticParams() {
  return catalog.nikayas.map((n) => ({ nikaya: n.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/suttas/[nikaya]">): Promise<Metadata> {
  return { title: getNikaya((await params).nikaya)?.nameKo };
}

/** 니까야 — 원래 앱처럼 품·상윳따 카드를 눌러 펼치고, 경 줄을 누르면 경을 연다 */
export default async function NikayaPage({ params }: PageProps<"/suttas/[nikaya]">) {
  const nikaya = getNikaya((await params).nikaya);
  if (!nikaya) notFound();

  return (
    <>
      <NikayaBar
        title={nikaya.nameKo}
        pali={nikaya.name}
        introduction={nikaya.introduction}
        backHref="/suttas"
        crumbs={[{ label: "경", href: "/suttas" }, { label: nikaya.nameKo }]}
      />
      <Screen>
        <EditionsProvider editions={editions}>
          <ReadableFilter>
            <CatalogTree nikaya={nikaya.id} nodes={nikaya.nodes} lazy={splitsIntoGroups(nikaya)} />
          </ReadableFilter>
        </EditionsProvider>
      </Screen>
    </>
  );
}
