"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveItem, NAV_MAIN } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/** 아래쪽 탭 막대를 보여 줄 첫 단계 화면 — 원래 앱처럼 경 목록·경 읽기 같은 안쪽 화면에서는 숨긴다 */
const TOP_LEVEL = ["/", "/suttas/", "/books/", "/practice/", "/chanting/", "/bookmarks/", "/search/", "/dictionary/", "/about/"];

/**
 * 폰 화면 아래쪽 탭 막대 — 홈·경전·서적·실천·예불 (원래 앱의 4칸 + 서적).
 * 넓은 화면(lg 이상)에서는 왼쪽 메뉴가 같은 목록(NAV_MAIN)을 맡으므로 숨긴다.
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (!TOP_LEVEL.includes(path)) return null;

  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden print:hidden"
    >
      <ul className="mx-auto flex max-w-md items-center justify-around">
        {NAV_MAIN.map((item) => {
          const active = isActiveItem(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                <span>{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
