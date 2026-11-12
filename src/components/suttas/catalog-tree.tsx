import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { collect } from "@/lib/data";
import { HIDE_WHEN_ONLY_READABLE } from "@/lib/constants";
import { formatCount, suttaHref, suttaLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CatalogNode, CatalogSutta } from "@/types";

/**
 * 경전 목록 나무 — 품·상윳따 같은 묶음은 접고 펼 수 있다(<details>, 자바스크립트 없이).
 * 본문이 있는 경이 든 묶음만 처음부터 펼쳐 둔다.
 * groupHref 가 있으면 맨 아래 묶음은 경 목록 대신 그 묶음 페이지로 가는 줄이 된다.
 */
export function CatalogTree({
  nodes,
  groupHref,
}: {
  nodes: CatalogNode[];
  groupHref?: (node: CatalogNode) => string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {nodes.map((node) => (
        <CatalogGroup key={node.id} node={node} depth={0} groupHref={groupHref} />
      ))}
    </div>
  );
}

function GroupTitle({ node, depth }: { node: CatalogNode; depth: number }) {
  const suttas = collect(node);
  const readable = suttas.filter((s) => s.editions.length > 0).length;
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={depth === 0 ? "t-card" : "font-semibold"}>
          {node.nameKo ?? node.name ?? node.id}
          {node.nameKo && node.name ? (
            <span lang="pi" className="ml-2 t-sub font-medium">
              {node.name}
            </span>
          ) : null}
        </span>
        {node.description ? <span className="t-sub">{node.description}</span> : null}
      </span>
      <span className="t-meta shrink-0 text-right">
        {node.range ? `${node.range} · ` : ""}
        {formatCount(suttas.length)}경
        {readable > 0 ? ` · 읽기 ${formatCount(readable)}` : ""}
      </span>
    </>
  );
}

function CatalogGroup({
  node,
  depth,
  groupHref,
}: {
  node: CatalogNode;
  depth: number;
  groupHref?: (node: CatalogNode) => string;
}) {
  const hasReadable = collect(node).some((s) => s.editions.length > 0);
  const frame = cn(
    depth === 0 ? "rounded-2xl border bg-card shadow-xs" : "border-t first:border-t-0",
    // "읽을 수 있는 경만 보기"를 켜면 본문 있는 경이 하나도 없는 묶음은 가린다
    !hasReadable && HIDE_WHEN_ONLY_READABLE,
  );

  if (groupHref && node.suttas.length > 0) {
    return (
      <Link
        href={groupHref(node)}
        className={`flex items-center gap-3 px-5 py-3.5 outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50 ${frame}`}
      >
        <GroupTitle node={node} depth={depth} />
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    );
  }

  return (
    <details
      open={hasReadable}
      className={`group ${frame}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-hover [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden
        />
        <GroupTitle node={node} depth={depth} />
      </summary>
      <div className={depth === 0 ? "border-t" : "pl-5"}>
        {node.children.map((child) => (
          <CatalogGroup key={child.id} node={child} depth={depth + 1} groupHref={groupHref} />
        ))}
        {node.suttas.length > 0 ? <SuttaList suttas={node.suttas} /> : null}
      </div>
    </details>
  );
}

export function SuttaList({ suttas }: { suttas: CatalogSutta[] }) {
  return (
    <ul className="flex flex-col py-1">
      {suttas.map((sutta) => (
        <SuttaItem key={sutta.id} sutta={sutta} />
      ))}
    </ul>
  );
}

function SuttaItem({ sutta }: { sutta: CatalogSutta }) {
  const readable = sutta.editions.length > 0;
  const body = (
    <>
      <span className="t-meta w-24 shrink-0">{suttaLabel(sutta.id)}</span>
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        {sutta.nameKo ? <span className="truncate">{sutta.nameKo}</span> : null}
        <span lang="pi" className={sutta.nameKo ? "t-sub truncate" : "truncate"}>
          {sutta.name}
        </span>
      </span>
    </>
  );

  if (!readable) {
    return (
      <li className={cn("flex items-center gap-3 px-5 py-2 text-muted-foreground", HIDE_WHEN_ONLY_READABLE)}>
        {body}
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
          준비 중
        </span>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={suttaHref(sutta.id)}
        className="flex items-center gap-3 px-5 py-2 font-semibold outline-none hover:bg-hover focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {body}
        <ChevronRight className="size-4 shrink-0 text-primary" aria-hidden />
      </Link>
    </li>
  );
}
