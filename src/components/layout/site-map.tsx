"use client";

import { Map as MapIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { suttaHref } from "@/lib/format";

interface Entry {
  href: string;
  label: string;
  note?: string;
}

const NIKAYAS: [string, string][] = [
  ["dn", "디가 니까야"],
  ["mn", "맛지마 니까야"],
  ["sn", "상윳따 니까야"],
  ["an", "앙굿따라 니까야"],
  ["kn", "쿳다까 니까야"],
];

/** 사이트 전체 구조 — 묶음마다 [묶음 이름, 첫 화면, 그 아래 화면들] */
const SECTIONS: {
  title: string;
  main: Entry;
  items: Entry[];
  /** 첫 화면과 나머지가 나란한 화면들이면 (서적·실천·예불) 들여 쓰지 않는다 */
  flat?: boolean;
}[] = [
  {
    title: "홈",
    main: { href: "/", label: "홈", note: "오늘의 경 · 지금 읽을 수 있는 경" },
    items: [
      ...NIKAYAS.map(([id, name]) => ({
        href: `/readable/${id}/`,
        label: `${name.replace(" 니까야", "")} — 한국어 번역 경`,
      })),
      { href: "/theravada/", label: "테라와다란" },
      { href: "/centers/", label: "전국 수행처" },
      { href: "/community/", label: "커뮤니티" },
    ],
  },
  {
    title: "경전",
    main: {
      href: "/suttas/",
      label: "경전",
      note: "5부 니까야 · 주제 · 주석 문헌",
    },
    items: [
      ...NIKAYAS.map(([id, name]) => ({ href: `/suttas/${id}/`, label: name })),
      { href: "/topics/", label: "주제별 경전", note: "ATI 주제 색인" },
      {
        href: "/suttas/vism/",
        label: "위숫디막가",
        note: "청정도론 · VRI 원문 23장",
      },
      {
        href: suttaHref("dhp1-20", undefined, "attha"),
        label: "법구경 이야기",
        note: "법구경 주석서",
      },
    ],
  },
  {
    title: "서적 · 실천 · 예불",
    flat: true,
    main: { href: "/books/", label: "서적" },
    items: [
      { href: "/practice/", label: "실천" },
      { href: "/chanting/", label: "예불" },
    ],
  },
  {
    title: "도구",
    flat: true,
    main: { href: "/search/", label: "검색", note: "본문 · 경 번호 · 경 제목" },
    items: [
      { href: "/dictionary/", label: "사전" },
      { href: "/bookmarks/", label: "내 서재", note: "책갈피 · 메모 · 밑줄" },
    ],
  },
  {
    title: "정보",
    main: { href: "/about/", label: "정보" },
    items: [
      { href: "/about/#editions", label: "판본" },
      { href: "/about/#translators", label: "저자·번역자" },
      { href: "/about/#dictionaries", label: "사전 출처" },
      { href: "/about/#sources", label: "출처" },
      { href: "/about/#settings", label: "읽기 설정" },
    ],
  },
];

/**
 * 사이트맵 — 맨 위 띠의 지도 단추. 누르면 사이트 전체 구조가 한 창에 펼쳐지고, 누르는 곳으로 바로 간다.
 */
export function SiteMap() {
  const [open, setOpen] = useState(false);
  const linkClass =
    "rounded-md px-2 py-1 outline-none hover:bg-amber-50 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-muted";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label="사이트맵"
            title="사이트맵 — 전체 구조 보기"
            className="flex size-9 items-center justify-center rounded-full outline-none hover:bg-white/15 focus-visible:ring-3 focus-visible:ring-white/60"
          />
        }
      >
        <MapIcon className="size-5" aria-hidden />
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] gap-5 overflow-y-auto p-6 sm:max-w-3xl">
        <DialogTitle className="text-lg font-bold">사이트맵</DialogTitle>
        <nav
          aria-label="사이트맵"
          className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {SECTIONS.map((section) => (
            <section key={section.title} className="flex flex-col gap-1">
              <h3 className="px-2 text-xs font-bold text-muted-foreground">
                {section.title}
              </h3>
              <Link
                href={section.main.href}
                onClick={() => setOpen(false)}
                className={`${linkClass} text-base font-bold`}
              >
                {section.main.label}
                {section.main.note ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {section.main.note}
                  </span>
                ) : null}
              </Link>
              <ul
                className={
                  section.flat
                    ? "flex flex-col gap-1"
                    : "ml-2 flex flex-col border-l pl-2"
                }
              >
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`${linkClass} block ${section.flat ? "text-base font-bold" : "text-sm"}`}
                    >
                      {item.label}
                      {item.note ? (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {item.note}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
