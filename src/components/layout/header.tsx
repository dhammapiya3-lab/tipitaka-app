"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveItem, NAV_TOOLS } from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { KeyboardShortcuts } from "@/components/shared/keyboard-shortcuts";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * 화면 맨 위 호박색 띠 — 왼쪽은 이름, 오른쪽은 검색·사전·내 서재 단추(어느 화면에서나 같은 자리).
 * 폰에서는 주 메뉴를 아래쪽 탭 막대가, 컴퓨터에서는 왼쪽 메뉴가 맡는다.
 */
export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-primary px-4 text-primary-foreground lg:px-6 print:hidden">
      <Link
        href="/"
        className="flex min-w-0 items-baseline gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-white/60"
      >
        <span className="truncate text-lg font-bold tracking-tight">{SERVICE_NAME}</span>
        <span lang="pi" className="hidden truncate text-sm opacity-85 sm:inline">
          {SERVICE_TAGLINE}
        </span>
      </Link>

      {/* 띠 위 단추는 흰 글자 — 안쪽 단추들의 기본 색·hover 를 띠에 맞게 덮는다 */}
      <div className="ml-auto flex items-center gap-0.5 [&_button]:text-primary-foreground [&_button]:hover:bg-white/15 [&_button]:hover:text-primary-foreground">
        {NAV_TOOLS.map((item) => {
          const active = isActiveItem(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex size-10 items-center justify-center rounded-full outline-none hover:bg-white/15 focus-visible:ring-3 focus-visible:ring-white/60",
                active && "bg-white/20",
              )}
            >
              <item.icon className="size-5" aria-hidden />
            </Link>
          );
        })}
        <KeyboardShortcuts />
        <ThemeToggle />
      </div>
    </header>
  );
}
