import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Screen } from "@/components/layout/app-bar";
import { NikayaBar } from "@/components/suttas/nikaya-bar";
import { EditionsProvider, SuttaRow } from "@/components/suttas/sutta-row";
import { catalog, editions, getKoreanGroups, getNikaya } from "@/lib/data";

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

/** 홈에서 니까야를 누르면 — 한국어 번역이 있는 경을 책·상윳따 이름 아래 경 단위로 */
export default async function ReadableNikayaPage({ params }: PageProps<"/readable/[nikaya]">) {
  const nikaya = getNikaya((await params).nikaya);
  if (!nikaya) notFound();
  const groups = getKoreanGroups(nikaya.id);
  const count = groups.reduce((n, g) => n + g.suttas.length, 0);

  return (
    <>
      <NikayaBar
        title={nikaya.nameKo}
        pali={nikaya.name}
        introduction={nikaya.introduction}
        backHref="/"
        crumbs={[{ label: "지금 읽을 수 있는 경", href: "/" }, { label: `${nikaya.nameKo} · 한글 번역 ${count}개 경` }]}
      />
      <Screen className="flex flex-col gap-5">
        {groups.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-faint">아직 한글 번역이 있는 경이 없습니다.</p>
        ) : (
          <EditionsProvider editions={editions}>
            {groups.map((group) => (
              <section key={group.id} className="flex flex-col gap-2" aria-labelledby={`g-${group.id}`}>
                <h2 id={`g-${group.id}`} className="flex flex-wrap items-baseline gap-x-1.5 px-2">
                  <span className="text-sm font-bold">{group.label}</span>
                  {group.pali && group.pali !== group.label ? (
                    <span lang="pi" className="text-xs text-faint">
                      {group.pali}
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs font-bold text-primary">{group.suttas.length}경</span>
                </h2>
                {group.suttas.map((s) => (
                  <SuttaRow
                    key={s.id}
                    nested={false}
                    sutta={{ id: s.id, name: s.name, nameKo: s.nameKo, editions: s.editions }}
                  />
                ))}
              </section>
            ))}
          </EditionsProvider>
        )}
      </Screen>
    </>
  );
}
