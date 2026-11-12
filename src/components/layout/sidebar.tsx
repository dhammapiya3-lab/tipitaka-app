"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isActiveItem,
  NAV_FOOTER,
  NAV_MAIN,
  NAV_TOOLS,
  type NavItem,
} from "@/components/layout/nav-items";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/lib/constants";
import { cn } from "@/lib/utils";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-12 items-center gap-3.5 rounded-xl px-4 text-[17px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-sidebar-accent font-bold text-sidebar-accent-foreground"
          : "font-medium text-sidebar-foreground hover:bg-hover",
      )}
    >
      <item.icon
        className={cn(
          "size-[22px] shrink-0",
          active ? "text-sidebar-accent-foreground" : "text-muted-foreground",
        )}
        aria-hidden
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/**
 * 컴퓨터 화면의 왼쪽 메뉴 — 위는 주 메뉴 5칸(폰 아래쪽 탭 막대와 같은 목록), 아래는 사전·내 서재 같은 도구.
 * 폰(lg 미만)에서는 숨기고 아래쪽 탭 막대와 맨 위 단추가 맡는다.
 */
export function Sidebar() {
  const pathname = usePathname();
  const group = (items: NavItem[]) =>
    items.map((item) => (
      <NavLink key={item.href} item={item} active={isActiveItem(pathname, item)} />
    ));
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex print:hidden">
      <Link href="/" className="flex shrink-0 flex-col justify-center bg-primary px-5 py-3 text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-white/60">
        <span className="truncate text-lg leading-6 font-bold">{SERVICE_NAME}</span>
        <span lang="pi" className="truncate text-xs text-primary-foreground/70">
          {SERVICE_TAGLINE}
        </span>
      </Link>
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3.5 py-5" aria-label="주 메뉴">
        {group(NAV_MAIN)}
        <div className="mx-2 my-2.5 h-px bg-sidebar-border" />
        {/* 검색은 맨 위 띠의 단추로만 (2026-11-13 요청) */}
        {group(NAV_TOOLS.filter((item) => item.href !== "/search"))}
        <div className="mt-auto flex flex-col gap-1 border-t border-sidebar-border pt-3">
          {group(NAV_FOOTER)}
        </div>
      </nav>
    </aside>
  );
}
