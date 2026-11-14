"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EditionInfoView } from "@/components/sutta/reader-sheets";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fetchEditionInfo } from "@/lib/content";
import type { EditionInfo } from "@/types";

/**
 * 정보 화면 판본 표 — 판본·번역자 이름을 누르면 상세 정보(번역자 소개·출처·이용 조건 …)를 창으로 띄운다.
 * id 가 있으면 경 화면의 판본 창과 같은 소개 자료(public/data/edition-info)를 열 때 받고,
 * 없으면 children 을 그대로 보인다 (자따까 새 복주석서처럼 이 화면에서 쓴 소개).
 */
export function EditionInfoDialog({
  id,
  title,
  label,
  children,
}: {
  id?: string;
  /** 창 제목 */
  title: ReactNode;
  /** 표에 보이는 누를 글자 */
  label: ReactNode;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            title="누르면 상세 정보"
            className="cursor-pointer text-left underline decoration-dotted decoration-1 underline-offset-4 outline-none hover:text-primary hover:decoration-solid focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        }
      >
        {label}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] gap-5 overflow-y-auto p-6 sm:max-w-2xl">
        <DialogTitle className="pr-8 text-lg font-bold">{title}</DialogTitle>
        {open ? id ? <LoadedInfo id={id} /> : children : null}
      </DialogContent>
    </Dialog>
  );
}

function LoadedInfo({ id }: { id: string }) {
  const [info, setInfo] = useState<EditionInfo | null | "loading">("loading");
  useEffect(() => {
    let alive = true;
    fetchEditionInfo(id)
      .then((v) => alive && setInfo(v))
      .catch(() => alive && setInfo(null));
    return () => {
      alive = false;
    };
  }, [id]);
  if (info === "loading")
    return <p className="text-sm text-faint">불러오는 중…</p>;
  if (!info)
    return (
      <p className="text-sm text-faint">
        이 판본의 상세 정보는 아직 준비 중입니다.
      </p>
    );
  return <EditionInfoView info={info} />;
}
