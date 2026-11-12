import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "전국 수행처" };

export default function CentersPage() {
  return (
    <ComingSoon
      title="전국 수행처"
      description="가까운 수행 도량 찾기"
      icon={MapPin}
      note="전국의 테라와다 수행처 안내를 준비하고 있습니다."
    />
  );
}
