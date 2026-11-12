"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { SidebarBrand, SidebarNav } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { KeyboardShortcuts } from "@/components/shared/keyboard-shortcuts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** 상단 헤더 — 모바일 메뉴 버튼과 테마 전환만 둔다(로그인이 없는 앱). */
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4 lg:px-6 print:hidden">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="메뉴 열기"
            />
          }
        >
          <Menu className="size-5" aria-hidden />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 gap-3 bg-sidebar p-0">
          <SheetTitle className="sr-only">메뉴</SheetTitle>
          <SidebarBrand onNavigate={() => setMenuOpen(false)} />
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="ml-auto flex items-center gap-1">
        <KeyboardShortcuts />
        <ThemeToggle />
      </div>
    </header>
  );
}
