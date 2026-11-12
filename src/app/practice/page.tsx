import { Heart } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "실천" };

export default function PracticePage() {
  return (
    <ComingSoon
      title="실천"
      description="수행과 일상의 실천"
      icon={Heart}
      top
      note="수행 안내와 실천 자료를 준비하고 있습니다."
    />
  );
}
