import { Users } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "커뮤니티" };

export default function CommunityPage() {
  return (
    <ComingSoon
      title="커뮤니티"
      description="함께 공부하는 모임"
      icon={Users}
      note="함께 공부하는 모임 안내를 준비하고 있습니다."
    />
  );
}
