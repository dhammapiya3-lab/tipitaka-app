import { BookA, Bookmark, House, Info, Library, Search, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** href 외에 이 메뉴를 활성으로 표시할 경로 앞부분 (예: 경 읽기 화면은 경전 목록 메뉴) */
  alsoActiveFor?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** 사이드바 메뉴 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "경전",
    items: [
      { href: "/", label: "홈", icon: House },
      { href: "/suttas", label: "경전 목록", icon: Library, alsoActiveFor: ["/sutta/"] },
      { href: "/search", label: "검색", icon: Search },
      { href: "/dictionary", label: "사전", icon: BookA },
      { href: "/bookmarks", label: "북마크", icon: Bookmark },
    ],
  },
];

/** 사이드바 맨 아래(그룹 밖)에 두는 메뉴 */
export const NAV_FOOTER: NavItem[] = [
  { href: "/about", label: "정보", icon: Info },
];

export function isActiveItem(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/";
  return [item.href, ...(item.alsoActiveFor ?? [])].some((prefix) =>
    pathname.startsWith(prefix),
  );
}
