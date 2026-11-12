import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SuttaList } from "@/components/suttas/catalog-tree";
import { ReadableFilter } from "@/components/suttas/readable-filter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { catalog, getLeafGroups, getNikaya, splitsIntoGroups } from "@/lib/data";
import { formatCount } from "@/lib/format";

// 경이 많은 니까야만 묶음별 페이지를 만든다.
export const dynamicParams = false;

// 니까야·묶음 주소를 여기서 함께 만든다(상위 주소별로 나누면 경이 적은 니까야는 빈 목록이 되어 정적 빌드가 거부한다).
export function generateStaticParams() {
  return catalog.nikayas
    .filter(splitsIntoGroups)
    .flatMap((nikaya) =>
      getLeafGroups(nikaya).map(({ node }) => ({ nikaya: nikaya.id, group: node.id })),
    );
}

async function findGroup(params: PageProps<"/suttas/[nikaya]/[group]">["params"]) {
  const { nikaya: nikayaId, group } = await params;
  const nikaya = getNikaya(nikayaId);
  const groupId = decodeURIComponent(group);
  const found = nikaya && getLeafGroups(nikaya).find(({ node }) => node.id === groupId);
  return nikaya && found ? { nikaya, ...found } : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/suttas/[nikaya]/[group]">): Promise<Metadata> {
  const found = await findGroup(params);
  return { title: found ? (found.node.nameKo ?? found.node.name ?? undefined) : undefined };
}

export default async function GroupPage({ params }: PageProps<"/suttas/[nikaya]/[group]">) {
  const found = await findGroup(params);
  if (!found) notFound();
  const { nikaya, node, parents } = found;
  const path = [nikaya.nameKo, ...parents.map((p) => p.nameKo ?? p.name ?? p.id)].join(" › ");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={node.nameKo ?? node.name ?? node.id}
        description={`${path} · ${node.range ? `${node.range} · ` : ""}${formatCount(node.suttas.length)}경`}
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/suttas/${nikaya.id}`} />}
          >
            <ChevronLeft aria-hidden />
            {nikaya.nameKo}
          </Button>
        }
      />
      <ReadableFilter>
        <Card className="gap-0 p-0">
          <SuttaList suttas={node.suttas} />
        </Card>
      </ReadableFilter>
    </div>
  );
}
