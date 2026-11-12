"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveItem, NAV_MAIN } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/**
 * 폰 화면 아래쪽 탭 막대 — 홈·경전·서적·실천·예불. 엄지로 누르기 쉬운 자리에 주 메뉴를 둔다.
 * 넓은 화면(lg 이상)에서는 왼쪽 메뉴가 같은 목록(NAV_MAIN)을 맡으므로 숨긴다.
 */
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5 px-1 pt-1.5 pb-1">
        {NAV_MAIN.map((item) => {
          const active = isActiveItem(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "font-bold text-brand-ink" : "font-medium text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7.5 w-13 items-center justify-center rounded-full",
                    active && "bg-brand-soft",
                  )}
                >
                  <item.icon className="size-5.5" aria-hidden />
                </span>
                <span className="truncate">{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
