import { Landmark } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "테라와다란" };

export default function TheravadaPage() {
  return (
    <ComingSoon
      title="테라와다란"
      description="상좌부 불교의 역사와 가르침"
      icon={Landmark}
      note="테라와다불교를 소개하는 글을 준비하고 있습니다."
    />
  );
}
