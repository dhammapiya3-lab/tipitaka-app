import {
  BookA,
  BookOpen,
  BookText,
  Flower2,
  Heart,
  House,
  Info,
  Library,
  Search,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 폰 아래쪽 탭 막대처럼 좁은 자리에 쓸 짧은 이름 */
  shortLabel?: string;
  /** href 외에 이 메뉴를 활성으로 표시할 경로 앞부분 (예: 경 읽기 화면은 경전 메뉴) */
  alsoActiveFor?: string[];
}

/**
 * 주 메뉴 5칸 — 폰은 아래쪽 탭 막대, 컴퓨터는 왼쪽 메뉴 위쪽.
 * 서적은 경전(삼장)과 같은 권위로 보이지 않도록 경전과 나란한 별도 칸으로 둔다 (MASTER-PLAN.md).
 */
export const NAV_MAIN: NavItem[] = [
  { href: "/", label: "홈", icon: House },
  { href: "/suttas", label: "경전", icon: BookOpen, alsoActiveFor: ["/sutta/", "/readable/", "/topics"] },
  { href: "/books", label: "서적", icon: BookText },
  { href: "/practice", label: "실천", icon: Heart },
  { href: "/chanting", label: "예불", icon: Flower2 },
];

/** 도구 — 폰은 화면 맨 위 오른쪽 단추, 컴퓨터는 왼쪽 메뉴 아래쪽 */
export const NAV_TOOLS: NavItem[] = [
  { href: "/search", label: "검색", icon: Search },
  { href: "/dictionary", label: "사전", icon: BookA },
  { href: "/bookmarks", label: "내 서재", icon: Library },
];

/** 왼쪽 메뉴 맨 아래 */
export const NAV_FOOTER: NavItem[] = [{ href: "/about", label: "정보", icon: Info }];

export function isActiveItem(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/";
  return [item.href, ...(item.alsoActiveFor ?? [])].some((prefix) =>
    pathname.startsWith(prefix),
  );
}
