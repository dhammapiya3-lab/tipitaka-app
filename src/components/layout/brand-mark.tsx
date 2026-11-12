import { cn } from "@/lib/utils";

/** 로고 마크 — 세 바구니(삼장)를 뜻하는 세 줄. 이미지 파일 대신 인라인 SVG. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      className={cn("size-6 shrink-0 text-primary", className)}
    >
      <rect width="48" height="48" rx="12" fill="currentColor" />
      <g fill="var(--primary-foreground)">
        <rect x="12" y="12" width="24" height="6" rx="3" />
        <rect x="12" y="21" width="24" height="6" rx="3" opacity="0.7" />
        <rect x="12" y="30" width="24" height="6" rx="3" opacity="0.45" />
      </g>
    </svg>
  );
}
