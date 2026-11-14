"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { BarButton, Breadcrumb, SubBar } from "@/components/layout/app-bar";
import { BottomSheet } from "@/components/shared/bottom-sheet";

/** 니까야·묶음 목록 머리 — ← · 제목 · ⓘ(소개) · 위치 줄 (원래 앱과 같다) */
export function NikayaBar({
  title,
  pali,
  introduction,
  backHref,
  crumbs,
}: {
  title: string;
  pali?: string | null;
  introduction?: string | null;
  backHref: string;
  crumbs: { label: string; href?: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SubBar
        title={title}
        backHref={backHref}
        actions={
          introduction ? (
            <BarButton label="소개" onClick={() => setOpen(true)}>
              <Info aria-hidden />
            </BarButton>
          ) : null
        }
      >
        <Breadcrumb items={crumbs} />
      </SubBar>
      {introduction ? (
        <BottomSheet
          open={open}
          onOpenChange={setOpen}
          title={title}
          subtitle={pali}
          subtitleLang="pi"
        >
          <p className="text-sm leading-relaxed whitespace-pre-line text-secondary-foreground">
            {introduction}
          </p>
        </BottomSheet>
      ) : null}
    </>
  );
}
