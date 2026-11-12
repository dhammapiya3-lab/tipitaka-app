"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { isActiveItem, NAV_TOOLS } from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { KeyboardShortcuts } from "@/components/shared/keyboard-shortcuts";
import { cn } from "@/lib/utils";

/**
 * 맨 위 호박색 띠 — 원래 앱의 홈·경전처럼 첫 단계 화면에 쓴다.
 * 제목 옆에 작은 빠알리 이름, 오른쪽에 검색·사전·내 서재 단추(새로 더한 기능).
 */
export function TopBar({ title, pali }: { title: string; pali?: string }) {
  const pathname = usePathname();
  return (
    <div className="sticky top-0 z-30 flex h-16 items-center bg-primary px-6 text-primary-foreground print:hidden">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">
          {title}
          {pali ? (
            <span lang="pi" className="ml-2 text-xs font-normal text-primary-foreground/70">
              {pali}
            </span>
          ) : null}
        </h1>
        <div className="-mr-2 flex items-center [&_button]:text-primary-foreground [&_button]:hover:bg-white/15 [&_button]:hover:text-primary-foreground">
          {NAV_TOOLS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              aria-current={isActiveItem(pathname, item) ? "page" : undefined}
              className="flex size-9 items-center justify-center rounded-full outline-none hover:bg-white/15 focus-visible:ring-3 focus-visible:ring-white/60"
            >
              <item.icon className="size-5" aria-hidden />
            </Link>
          ))}
          <KeyboardShortcuts />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

/**
 * 안쪽 화면의 머리 — 원래 앱처럼 연회색 바탕에 ← 단추, 제목, 오른쪽 작은 단추들.
 * 아래(children)에는 위치 줄·판본 배지 같은 것을 둔다.
 */
export function SubBar({
  title,
  titleLang,
  subtitle,
  backHref,
  onBack,
  actions,
  children,
  wide = false,
  widthClass,
}: {
  /** 머리 내용 폭 (경 읽기: 본문 상자와 같은 폭) — 주면 wide 대신 쓴다 */
  widthClass?: string;
  title: ReactNode;
  titleLang?: string;
  subtitle?: ReactNode;
  /** ← 단추가 갈 곳. 없으면 브라우저 뒤로 가기 */
  backHref?: string;
  /** ← 단추를 눌렀을 때 할 일 (문단 보기에서 전체로 돌아가기 등) */
  onBack?: () => void;
  actions?: ReactNode;
  children?: ReactNode;
  wide?: boolean;
}) {
  const router = useRouter();
  const backClass =
    "-ml-2 flex shrink-0 rounded-full p-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <div className={cn("bg-background pt-4 pb-4 print:px-0", widthClass ? "px-4" : "px-6")}>
      <div className={cn("mx-auto", widthClass ?? (wide ? "max-w-[1280px] lg:px-4" : "max-w-3xl"))}>
        <div className="flex items-center gap-3">
          {onBack ? (
            <button type="button" aria-label="뒤로" className={backClass} onClick={onBack}>
              <ArrowLeft className="size-5" aria-hidden />
            </button>
          ) : backHref ? (
            <Link href={backHref} aria-label="뒤로" className={backClass}>
              <ArrowLeft className="size-5" aria-hidden />
            </Link>
          ) : (
            <button type="button" aria-label="뒤로" className={backClass} onClick={() => router.back()}>
              <ArrowLeft className="size-5" aria-hidden />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 lang={titleLang} className="truncate text-lg font-bold">
              {title}
            </h1>
            {subtitle ? <p className="mt-0.5 truncate text-xs text-faint">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-1 print:hidden">{actions}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

/** 머리 오른쪽의 작은 동그란 단추 (판본·목차·글자) */
export function BarButton({
  label,
  onClick,
  href,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  children: ReactNode;
}) {
  const cls =
    "flex rounded-full p-2 text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-5";
  return href ? (
    <Link href={href} aria-label={label} title={label} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" aria-label={label} title={label} className={cls} onClick={onClick}>
      {children}
    </button>
  );
}

/** 위치 줄 — 경 › 상윳따 니까야 › 대품 … (원래 앱과 같은 모양) */
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="위치" className="mt-3 print:hidden">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {items.map((item, i) => (
          <li key={`${i}-${item.label}`} className="flex items-center gap-1">
            {i > 0 ? <span aria-hidden className="text-faint">›</span> : null}
            {i === 0 && !item.href ? (
              <span className="font-bold text-secondary-foreground">{item.label}</span>
            ) : item.href ? (
              <Link href={item.href} className={cn("hover:text-secondary-foreground", i === 0 && "font-bold text-secondary-foreground")}>
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** 화면 본문 칸 — 원래 앱처럼 좌우 여백 */
export function Screen({ children, wide = false, className }: { children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <div className={cn("mx-auto w-full px-4 py-4", wide ? "max-w-[1200px]" : "max-w-3xl", className)}>
      {children}
    </div>
  );
}
