import { ChevronDown } from "lucide-react";
import { LazyGroup } from "@/components/suttas/lazy-group";
import { SuttaRow } from "@/components/suttas/sutta-row";
import { HIDE_WHEN_ONLY_READABLE } from "@/lib/constants";
import { collect, hasKorean } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { CatalogNode, CatalogSutta } from "@/types";

/**
 * 경전 목록 나무 — 원래 앱처럼 품·상윳따 카드를 눌러 아래로 펼친다(<details>).
 * lazy 면 맨 아래 묶음의 경 목록은 펼칠 때 불러온다(경이 많은 니까야).
 */
export function CatalogTree({
  nikaya,
  nodes,
  lazy = false,
}: {
  nikaya: string;
  nodes: CatalogNode[];
  lazy?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {nodes.map((node, i) => (
        <CatalogGroup
          key={node.id}
          nikaya={nikaya}
          node={node}
          index={i + 1}
          depth={0}
          lazy={lazy}
        />
      ))}
    </div>
  );
}

function GroupHeader({
  node,
  index,
  depth,
}: {
  node: CatalogNode;
  index: number;
  depth: number;
}) {
  const title = node.nameKo ?? node.name ?? node.id;
  return (
    <>
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
          depth === 0 ? "bg-primary" : "bg-amber-600",
        )}
      >
        {index}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-baseline gap-x-1.5">
          <h3 className="text-base font-bold">{title}</h3>
          {node.description && node.name && node.name !== title ? (
            <span lang="pi" className="text-xs text-faint">
              {node.name}
            </span>
          ) : null}
        </div>
        {/* 범위는 설명 줄 끝에 (경전 목록 카드와 같은 모양) */}
        {node.description ||
        (node.name && node.name !== title) ||
        node.range ? (
          <p className="font-pali text-xs break-keep text-muted-foreground">
            {node.description ??
              (node.name && node.name !== title ? (
                <span lang="pi">{node.name}</span>
              ) : null)}
            {node.range ? (
              <span className="whitespace-nowrap">
                {node.description || (node.name && node.name !== title)
                  ? " · "
                  : ""}
                <span className="font-bold text-primary">{node.range}</span>
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </>
  );
}

function CatalogGroup({
  nikaya,
  node,
  index,
  depth,
  lazy,
}: {
  nikaya: string;
  node: CatalogNode;
  index: number;
  depth: number;
  lazy: boolean;
}) {
  // "한글 번역이 있는 경만 보기"를 켜면 한글 번역이 하나도 없는 묶음은 가린다
  const hide = !collect(node).some(hasKorean) && HIDE_WHEN_ONLY_READABLE;

  // 경이 많은 니까야의 맨 아래 묶음은 펼칠 때 불러온다
  if (lazy && node.suttas.length > 0 && node.children.length === 0) {
    return (
      <LazyGroup
        nikaya={nikaya}
        groupId={node.id}
        nested={depth > 0}
        className={hide || undefined}
        header={<GroupHeader node={node} index={index} depth={depth} />}
      />
    );
  }

  return (
    <details className={cn("group/g", hide)}>
      <summary
        className={cn(
          "block cursor-pointer list-none rounded-2xl border bg-card p-4 shadow-sm transition-shadow outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden",
          depth > 0 && "ml-4",
        )}
      >
        <div className="flex items-center gap-3">
          <GroupHeader node={node} index={index} depth={depth} />
          <ChevronDown
            className="size-5 shrink-0 text-faint transition-transform group-open/g:rotate-180"
            aria-hidden
          />
        </div>
      </summary>
      <div className={cn("mt-2 flex flex-col gap-2", depth > 0 && "ml-4")}>
        {node.children.map((child, i) => (
          <CatalogGroup
            key={child.id}
            nikaya={nikaya}
            node={child}
            index={i + 1}
            depth={depth + 1}
            lazy={lazy}
          />
        ))}
        {node.suttas.map((s) => (
          <SuttaRow key={s.id} sutta={rowData(s)} />
        ))}
      </div>
    </details>
  );
}

function rowData(s: CatalogSutta) {
  return { id: s.id, name: s.name, nameKo: s.nameKo, editions: s.editions };
}
