import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CatalogTree } from "@/components/suttas/catalog-tree";
import { ReadableFilter } from "@/components/suttas/readable-filter";
import { Button } from "@/components/ui/button";
import { catalog, getNikaya, splitsIntoGroups } from "@/lib/data";

export const dynamicParams = false;

export function generateStaticParams() {
  return catalog.nikayas.map((n) => ({ nikaya: n.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/suttas/[nikaya]">): Promise<Metadata> {
  return { title: getNikaya((await params).nikaya)?.nameKo };
}

export default async function NikayaPage({ params }: PageProps<"/suttas/[nikaya]">) {
  const nikaya = getNikaya((await params).nikaya);
  if (!nikaya) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={nikaya.nameKo}
        description={<span lang="pi">{nikaya.name}</span>}
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/suttas" />}>
            <ChevronLeft aria-hidden />
            경전
          </Button>
        }
      />
      <ReadableFilter>
        <CatalogTree
          nodes={nikaya.nodes}
          groupHref={
            splitsIntoGroups(nikaya)
              ? (node) => `/suttas/${nikaya.id}/${encodeURIComponent(node.id)}`
              : undefined
          }
        />
      </ReadableFilter>
    </div>
  );
}
