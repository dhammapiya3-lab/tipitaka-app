import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { NikayaCards } from "@/components/suttas/nikaya-cards";
import { getNikayaSummaries } from "@/lib/data";

export const metadata: Metadata = { title: "경전 목록" };

export default function SuttasPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="경전 목록" description="경장(Sutta Piṭaka) 5부 니까야" />
      <NikayaCards items={getNikayaSummaries()} />
    </div>
  );
}
