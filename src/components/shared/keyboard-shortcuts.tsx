"use client";

import { Keyboard } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isTypingOrDialog } from "@/components/sutta/use-reader-keys";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS: { keys: string[]; label: string; where?: string }[] = [
  { keys: ["/"], label: "검색 화면으로 (검색 화면에서는 입력칸으로)" },
  { keys: ["?"], label: "이 단축키 안내 열기" },
  { keys: ["j", "k"], label: "다음 · 이전 문장 고르기", where: "경 읽기" },
  { keys: ["←", "→"], label: "고른 문장 안에서 단어 옮기기 (문장을 안 골랐으면 이전 · 다음 경)", where: "경 읽기" },
  { keys: ["Enter"], label: "고른 단어를 사전에서 찾기", where: "경 읽기" },
  { keys: ["b"], label: "고른 문장 북마크", where: "경 읽기" },
  { keys: ["c"], label: "고른 문장 원문+번역 복사", where: "경 읽기" },
  { keys: ["Esc"], label: "사전 닫기 · 문장 고르기 그만", where: "경 읽기" },
];

/** 어디서나 쓰는 단축키(/ 검색, ? 안내)와 안내 창. 헤더의 키보드 버튼으로도 연다. */
export function KeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingOrDialog(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        const input = document.getElementById("search-input");
        if (input) input.focus();
        else router.push("/search/");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, pathname]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        aria-label="단축키 안내"
        title="단축키 안내 (?)"
        onClick={() => setOpen(true)}
      >
        <Keyboard className="size-4" aria-hidden />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>단축키</DialogTitle>
            <DialogDescription>글을 쓰는 칸에서는 단축키가 작동하지 않습니다.</DialogDescription>
          </DialogHeader>
          <table className="t-sub w-full">
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.label} className="border-t align-top first:border-t-0">
                  <td className="w-28 py-2 pr-3 whitespace-nowrap">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="mr-1 rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-foreground"
                      >
                        {k}
                      </kbd>
                    ))}
                  </td>
                  <td className="py-2">
                    {s.label}
                    {s.where ? <span className="t-meta ml-1">({s.where})</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </>
  );
}
