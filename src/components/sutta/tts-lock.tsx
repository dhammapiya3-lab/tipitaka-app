"use client";

import { Lock, LockOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

/**
 * 듣기 잠금 — 소리로 듣는 동안 화면을 잠근다.
 * - 화면 위에 덮개를 씌워, 주머니 속이나 손에 쥐고 있을 때 잘못 눌려 멈추거나 넘어가지 않게 한다.
 * - 화면이 저절로 꺼지지 않게 한다 (Screen Wake Lock — 휴대폰 화면이 꺼지면 브라우저 소리 읽기가 멈추기 때문).
 * - 풀 때는 단추를 1초 동안 누르고 있어야 한다.
 */
export function TtsLockOverlay({
  sentence,
  playing,
  onUnlock,
}: {
  /** 지금 읽는 문장 (덮개에 크게 보인다) */
  sentence: string;
  playing: boolean;
  onUnlock: () => void;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // 화면 꺼짐 막기 — 다른 앱에 갔다 오면 다시 건다
  useEffect(() => {
    let sentinel: WakeLockSentinelLike | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } };
    const request = () => {
      nav.wakeLock
        ?.request("screen")
        .then((s) => {
          sentinel = s;
        })
        .catch(() => {
          // 지원하지 않거나 허락되지 않으면 덮개만 쓴다
        });
    };
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    // 뒤 화면이 움직이지 않게
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      document.body.style.overflow = overflow;
      void sentinel?.release().catch(() => undefined);
    };
  }, []);

  const start = () => {
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      onUnlock();
    }, 1000);
  };
  const cancel = () => {
    setHolding(false);
    window.clearTimeout(timer.current);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="듣기 잠금"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-between bg-black/95 px-6 py-10 text-white select-none print:hidden"
      onContextMenu={(e) => e.preventDefault()}
      onWheel={(e) => e.preventDefault()}
      onTouchMove={(e) => e.preventDefault()}
    >
      <p className="flex items-center gap-2 text-sm font-bold text-white/80">
        <Lock className="size-4" aria-hidden />
        화면 잠금 중 · {playing ? "소리는 계속 나와요" : "잠시 멈춤"}
      </p>
      <p lang="pi" className="max-w-2xl text-center font-pali text-xl leading-relaxed text-white/90">
        {sentence}
      </p>
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          aria-label="잠금 풀기 (1초 동안 누르고 있기)"
          onPointerDown={start}
          onPointerUp={cancel}
          onPointerLeave={cancel}
          onPointerCancel={cancel}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onUnlock()}
          className="relative grid size-20 place-items-center overflow-hidden rounded-full border-2 border-white/60 bg-white/10"
        >
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 bg-primary/80"
            style={{ height: holding ? "100%" : "0%", transition: holding ? "height 1s linear" : "height 0.15s" }}
          />
          <LockOpen className="relative size-7" aria-hidden />
        </button>
        <span className="text-xs text-white/70">풀려면 1초 동안 누르고 있으세요</span>
      </div>
    </div>
  );
}
