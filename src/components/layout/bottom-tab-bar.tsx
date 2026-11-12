"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveItem, NAV_GROUPS } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/**
 * 폰 화면 아래쪽 탭 막대 — 원래 앱처럼 엄지로 누르기 쉬운 자리에 주 메뉴를 둔다.
 * 넓은 화면(lg 이상)에서는 왼쪽 사이드바가 같은 메뉴를 맡으므로 숨긴다.
 * 메뉴 목록은 사이드바와 같은 NAV_GROUPS 를 쓴다(한 곳에서만 고친다).
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const items = NAV_GROUPS.flatMap((group) => group.items);

  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const active = isActiveItem(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "font-semibold text-primary" : "font-medium text-muted-foreground",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                <span className="truncate">{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
