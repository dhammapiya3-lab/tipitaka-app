import type { Metadata } from "next";
import { Screen, TopBar } from "@/components/layout/app-bar";
import { ListCard, NikayaCards } from "@/components/suttas/nikaya-cards";
import { PitakaTabs } from "@/components/suttas/pitaka-tabs";
import { getNikayaSummaries } from "@/lib/data";

export const metadata: Metadata = { title: "경전" };

/** 아직 본문이 없는 주석 문헌 — 번역이 올라오면 목록에 연결한다 */
const COMMENTARIES = [
  {
    abbr: "VISM",
    name: "위숫디막가",
    pali: "Visuddhimagga",
    note: "청정도론(淸淨道論)",
  },
  {
    abbr: "DhpA",
    name: "법구경 이야기",
    pali: "Dhammapada-aṭṭhakathā",
    note: "게송마다의 인연담",
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
          <h2 className="px-2 pt-6 pb-3 text-sm font-bold">주석 문헌</h2>
          <div className="flex flex-col gap-3">
            {COMMENTARIES.map((c) => (
              <ListCard
                key={c.abbr}
                badge={<span className="text-[11px]">{c.abbr}</span>}
                title={c.name}
                pali={c.pali}
                description={c.note}
                trailing={<span className="text-xs text-faint">준비 중</span>}
              />
            ))}
          </div>
        </PitakaTabs>
      </Screen>
    </>
  );
}
