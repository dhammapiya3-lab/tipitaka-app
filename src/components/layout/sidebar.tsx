"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/layout/brand-mark";
import {
  isActiveItem,
  NAV_FOOTER,
  NAV_GROUPS,
  type NavItem,
} from "@/components/layout/nav-items";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/lib/constants";
import { cn } from "@/lib/utils";

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-2 rounded-lg px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
          : "font-medium text-sidebar-foreground hover:bg-hover",
      )}
    >
      <item.icon
        className={cn(
          "size-5 shrink-0",
          active ? "text-sidebar-accent-foreground" : "text-muted-foreground",
        )}
        aria-hidden
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex min-h-0 flex-1 flex-col px-3" aria-label="주 메뉴">
      <div className="flex flex-col gap-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">
              {group.label}
            </p>
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActiveItem(pathname, item)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-0.5 border-t border-sidebar-border pt-3 pb-3">
        {NAV_FOOTER.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActiveItem(pathname, item)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  );
}

export function SidebarBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className="flex h-14 shrink-0 items-center gap-2 px-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <BrandMark />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-base leading-5 font-bold tracking-tight">
          {SERVICE_NAME}
        </span>
        <span lang="pi" className="truncate text-xs text-meta">
          {SERVICE_TAGLINE}
        </span>
      </span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-3 border-r border-sidebar-border bg-sidebar lg:flex print:hidden">
      <SidebarBrand />
      <SidebarNav />
    </aside>
  );
}
