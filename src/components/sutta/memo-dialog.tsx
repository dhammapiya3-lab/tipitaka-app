"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/** 문장 메모 쓰기 — 저장하면 책갈피도 함께 남는다. 비우고 저장하면 메모만 지운다. */
export function MemoDialog({
  open,
  label,
  initial,
  onSave,
  onClose,
}: {
  open: boolean;
  /** 어느 문장인지 (예: DN 22:1.2) */
  label: string;
  initial: string;
  onSave: (memo: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <MemoForm
            key={label}
            label={label}
            initial={initial}
            onSave={onSave}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MemoForm({
  label,
  initial,
  onSave,
  onClose,
}: {
  label: string;
  initial: string;
  onSave: (memo: string) => void;
  onClose: () => void;
}) {
  const [memo, setMemo] = useState(initial);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(memo);
        onClose();
      }}
    >
      <DialogHeader>
        <DialogTitle>메모 — {label}</DialogTitle>
        <DialogDescription>
          이 기기에만 저장되고, 책갈피 화면에서 함께 볼 수 있습니다.
        </DialogDescription>
      </DialogHeader>
      <Textarea
        autoFocus
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={5}
        placeholder="이 문장에 대한 생각, 공부한 내용…"
        aria-label="메모"
      />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" disabled={memo.trim() === initial.trim()}>
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}
