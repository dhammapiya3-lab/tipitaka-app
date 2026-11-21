import type { Metadata } from "next";
import { Screen, TopBar } from "@/components/layout/app-bar";
import { ListCard, NikayaCards } from "@/components/suttas/nikaya-cards";
import { PitakaTabs } from "@/components/suttas/pitaka-tabs";
import { getNikayaSummaries } from "@/lib/data";
import { suttaHref } from "@/lib/format";

export const metadata: Metadata = { title: "경전" };

/** 주석 문헌 — href 가 있으면 그 화면으로, 없으면 "준비 중" */
const COMMENTARIES: {
  abbr: string;
  name: string;
  pali: string;
  note: string;
  href?: string;
}[] = [
  {
    abbr: "VISM",
    name: "위숫디막가",
    pali: "Visuddhimagga",
    note: "청정도론(淸淨道論) — VRI 제6차 결집본 원문, 23장 (계·정·혜)",
    href: suttaHref("vism1"),
  },
  {
    abbr: "DhpA",
    name: "법구경 이야기",
    pali: "Dhammapada-aṭṭhakathā",
    note: "게송마다의 인연담 — 법구경과 본문이 같아, 법구경을 주석서 쪽으로 엽니다",
    // 법구경 주석서(Dhammapada-aṭṭhakathā)는 법구경 품마다 이어 붙어 있다 — 첫 품을 주석서 탭으로 연다
    href: suttaHref("dhp1-20", undefined, "attha"),
  },
];

/** 경전 — 원래 앱과 같은 화면: 안내 · 경·율·논 · 5부 니까야 · 주석 문헌 */
export default function SuttasPage() {
  return (
    <>
      <TopBar title="경전" pali="Tipiṭaka" />
      <Screen className="px-6 py-2">
        <PitakaTabs>
          <h2 className="px-2 pt-2 pb-3 text-sm font-bold">5부 니까야</h2>
          <NikayaCards items={getNikayaSummaries()} />
          <h2 className="px-2 pt-6 pb-3 text-sm font-bold">주제로 찾기</h2>
          <ListCard
            badge={<span className="text-base">#</span>}
            title="주제별 경전"
            pali="Access to Insight 주제 색인"
            description="자애·선정·연기 … 사람이 정리한 주제 색인으로 경을 모아 봅니다"
            href="/topics/"
          />
          <h2 className="px-2 pt-6 pb-3 text-sm font-bold">주석 문헌</h2>
          <div className="flex flex-col gap-3">
            {COMMENTARIES.map((c) => (
              <ListCard
                key={c.abbr}
                badge={<span className="text-[11px]">{c.abbr}</span>}
                title={c.name}
                pali={c.pali}
                description={c.note}
                href={c.href}
                trailing={
                  c.href ? undefined : (
                    <span className="text-xs text-faint">준비 중</span>
                  )
                }
              />
            ))}
          </div>
        </PitakaTabs>
      </Screen>
    </>
  );
}
