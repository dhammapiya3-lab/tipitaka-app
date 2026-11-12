import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { NikayaCards } from "@/components/suttas/nikaya-cards";
import { getNikayaSummaries } from "@/lib/data";

export const metadata: Metadata = { title: "경전" };

/** 아직 본문이 없는 주석문헌 — 번역이 올라오면 목록에 연결한다 */
const COMMENTARIES = [
  { abbr: "DhpA", name: "법구경 이야기", pali: "Dhammapada-aṭṭhakathā", note: "게송마다의 인연담" },
  { abbr: "Vism", name: "청정도론", pali: "Visuddhimagga", note: "붓다고사 스님 · 계·정·혜" },
];

/**
 * 경전 — 지금은 경장(5부 니까야)과 주석문헌. 율장·논장은 번역이 생기면 위에 경장·율장·논장 칸으로 나눈다
 * (번역이 없는 동안은 숨긴다 — MASTER-PLAN.md).
 */
export default function SuttasPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8">
      <PageHeader title="경전" description={<>경장 <span lang="pi">Sutta Piṭaka</span> · 5부 니까야</>} />
      <NikayaCards items={getNikayaSummaries()} />

      <section className="flex flex-col gap-3" aria-labelledby="commentaries">
        <h2 id="commentaries" className="t-section">
          주석문헌
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {COMMENTARIES.map((c) => (
            <div
              key={c.abbr}
              className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-card ring-1 ring-foreground/5"
            >
              <span
                lang="pi"
                className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-success-soft text-sm font-semibold text-success"
              >
                {c.abbr}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="t-card">{c.name}</span>
                <span className="t-sub">
                  <span lang="pi">{c.pali}</span> · {c.note}
                </span>
              </span>
              <span className="t-meta shrink-0">준비 중</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
