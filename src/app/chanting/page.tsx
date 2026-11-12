import { Flower2 } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "예불" };

export default function ChantingPage() {
  return (
    <ComingSoon
      title="예불"
      description="예불문과 독송"
      icon={Flower2}
      top
      note="예불문과 독송 자료를 준비하고 있습니다."
    />
  );
}
