import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Screen } from "@/components/layout/app-bar";
import { NikayaBar } from "@/components/suttas/nikaya-bar";
import { ReadableFilter } from "@/components/suttas/readable-filter";
import { EditionsProvider, SuttaRow } from "@/components/suttas/sutta-row";
import { catalog, editions, getLeafGroups, getNikaya, splitsIntoGroups } from "@/lib/data";

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

  return (
    <>
      <NikayaBar
        title={node.nameKo ?? node.name ?? node.id}
        pali={node.name}
        backHref={`/suttas/${nikaya.id}`}
        crumbs={[
          { label: "경", href: "/suttas" },
          { label: nikaya.nameKo, href: `/suttas/${nikaya.id}` },
          ...parents.map((p) => ({ label: p.nameKo ?? p.name ?? p.id })),
          { label: node.nameKo ?? node.name ?? node.id },
        ]}
      />
      <Screen>
        <EditionsProvider editions={editions}>
          <ReadableFilter>
            <div className="flex flex-col gap-2">
              {node.suttas.map((s) => (
                <SuttaRow
                  key={s.id}
                  nested={false}
                  sutta={{ id: s.id, name: s.name, nameKo: s.nameKo, editions: s.editions }}
                />
              ))}
            </div>
          </ReadableFilter>
        </EditionsProvider>
      </Screen>
    </>
  );
}
