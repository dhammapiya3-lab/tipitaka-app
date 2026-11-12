import type { ReactNode } from "react";
import { Screen, TopBar } from "@/components/layout/app-bar";

/** 첫 단계 화면(홈·경전·사전·검색·내 서재·정보 …) — 호박색 띠 + 본문 칸. 설명은 꼭 필요할 때만 한 줄. */
export function TopLevelPage({
  title,
  pali,
  description,
  children,
  wide = false,
}: {
  title: string;
  pali?: string;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <>
      <TopBar title={title} pali={pali} />
      <Screen wide={wide} className="flex flex-col gap-4 px-6 py-5">
        {description ? <p className="px-2 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
        {children}
      </Screen>
    </>
  );
}
