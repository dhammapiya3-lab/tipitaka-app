"use client";

import { ListCheck } from "lucide-react";
import { ListCard } from "@/components/suttas/nikaya-cards";
import { formatCount } from "@/lib/format";
import { useReadStore } from "@/store/read";

/** 경전 화면 맨 위 — 읽기 진도표로 가는 카드 (다 읽은 경 수) */
export function ProgressCard() {
  const readCount = useReadStore((s) => Object.keys(s.items).length);
  return (
    <ListCard
      href="/progress/"
      badge={<ListCheck className="size-5" aria-hidden />}
      title="읽기 진도표"
      description={
        readCount > 0
          ? `다 읽은 경 ${formatCount(readCount)}개 — 무엇을 읽었고 무엇이 남았는지 봅니다`
          : "경 목록의 동그라미나 경 맨 끝 단추로 다 읽은 경을 표시해 보세요"
      }
    />
  );
}
