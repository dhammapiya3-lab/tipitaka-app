import type { ReactNode } from "react";

/** 모든 화면 맨 위 — 제목(24/700) + 오른쪽 주요 버튼. 부제는 꼭 필요할 때만 한 줄. */
export function PageHeader({
  title,
  titleLang,
  description,
  actions,
}: {
  title: string;
  /** 제목이 빠알리어면 "pi" — 빠알리 글꼴로 표시 */
  titleLang?: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="t-title" lang={titleLang}>
          {title}
        </h1>
        {description ? <p className="t-sub mt-1">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
