import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="페이지를 찾을 수 없습니다"
      description="주소가 맞는지 확인하거나 경전 목록에서 다시 찾아 주세요."
      action={<Button nativeButton={false} render={<Link href="/suttas" />}>경전 목록으로</Button>}
    />
  );
}
