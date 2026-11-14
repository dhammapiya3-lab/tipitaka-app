"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchVriPaths, type VriPaths } from "@/lib/content";
import { suttaHref, suttaLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/** 낱말 비교용 — 머리말 줄이 경로 줄과 같은 제목인지 볼 때 */
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/ṁ/g, "ṃ")
    .split(/[^a-zāīūṃṅñṭḍṇḷ]+/)
    .filter(Boolean);

/** 이 니까야의 VRI 경로들 (없으면 null) */
export function useVriPaths(nikaya: string | undefined): VriPaths | null {
  const [state, setState] = useState<{
    nikaya: string;
    data: VriPaths | null;
  } | null>(null);
  useEffect(() => {
    if (!nikaya) return;
    let alive = true;
    fetchVriPaths(nikaya).then((data) => alive && setState({ nikaya, data }));
    return () => {
      alive = false;
    };
  }, [nikaya]);
  return state && state.nikaya === nikaya ? state.data : null;
}

/** 머리말 줄 가운데 경로 줄과 같은 제목 줄(책·품 이름)인지 — 그런 줄은 화면에서 따로 보이지 않는다(데이터는 그대로) */
export function coveredByPath(line: string, path: string[]): boolean {
  const have = new Set(path.flatMap(words));
  const ws = words(line);
  return ws.length > 0 && ws.every((w) => have.has(w));
}

/**
 * 경로 줄 (Digital Pali Reader 처럼) — 화면 맨 위 머리말 자리.
 * (SN 1.1) Saṃyuttanikāyo, Sagāthāvaggo, 1. Devatāsaṃyuttaṃ, 1. Naḷavaggo, 1. Oghataraṇasuttaṃ
 * 이름은 VRI 원본 그대로(번호 포함). 이름을 누르면 그 단계의 목록이 펼쳐지고, 끝에는 지금 읽는 자리의 소제목.
 */
export function VriPathLine({
  suttaId,
  paths,
  paragraphs,
  current,
  onGoParagraph,
  layer,
}: {
  /** 주석서·복주석서 칸이면 그 층 — 그 책의 경로를 보이고, 목록에서 고르면 그 경의 같은 층으로 */
  layer?: "attha" | "tika";
  suttaId: string;
  paths: VriPaths;
  /** 경 문단 차례 */
  paragraphs: string[];
  /** 지금 읽는 문단 */
  current: string | null;
  onGoParagraph: (paragraph: string) => void;
}) {
  const router = useRouter();
  const mine = paths.byId.get(suttaId);
  if (!mine) return null;
  const path = layer ? (mine.layers[layer] ?? []) : mine.path;
  const heads = layer ? [] : mine.heads;
  if (!path.length) return null;
  const pathOf = (id: string) => {
    const e = paths.byId.get(id)!;
    return layer ? (e.layers[layer] ?? []) : e.path;
  };
  // 지금 읽는 자리의 소제목 — 그 문단이거나 그 앞에서 가장 가까운 소제목
  const at = Math.max(0, current ? paragraphs.indexOf(current) : 0);
  const head = heads.reduce<[string, string] | null>((found, h) => {
    const i = paragraphs.indexOf(h[0]);
    return i >= 0 && i <= at ? h : found;
  }, null);

  /** i 번째 이름과 같은 단계의 목록 — 위 단계가 같은 경들 가운데 이름마다 첫 경 */
  const optionsAt = (i: number) => {
    const seen = new Map<string, string>();
    for (const id of paths.order) {
      const p = pathOf(id);
      if (p.length <= i) continue;
      if (!path.slice(0, i).every((name, k) => p[k] === name)) continue;
      if (!seen.has(p[i])) seen.set(p[i], id);
    }
    return [...seen];
  };

  const menuClass =
    "max-h-80 w-auto max-w-[min(24rem,90vw)] font-pali" as const;
  return (
    <nav
      aria-label="경로"
      lang="pi"
      className="py-2 text-center font-pali text-sm leading-relaxed text-secondary-foreground print:hidden"
    >
      <span className="mr-1 font-sans text-xs font-bold text-faint">
        ({suttaLabel(suttaId)})
      </span>
      {path.map((name, i) => {
        const options = optionsAt(i);
        return (
          <span key={`${i}-${name}`}>
            {i > 0 ? ", " : null}
            {options.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="rounded px-0.5 hover:text-foreground data-popup-open:text-primary"
                  title={`${name} — 같은 단계의 목록에서 고르기`}
                >
                  {name}
                </DropdownMenuTrigger>
                <DropdownMenuContent className={menuClass}>
                  {options.map(([label, id]) => (
                    <DropdownMenuItem
                      key={label}
                      onClick={() =>
                        router.push(suttaHref(id, undefined, layer))
                      }
                      className={cn(label === name && "font-bold text-primary")}
                    >
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="px-0.5">{name}</span>
            )}
          </span>
        );
      })}
      {head ? (
        <span>
          {", "}
          {heads.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded px-0.5 font-bold text-primary hover:underline"
                title="이 경의 소제목 — 고르면 그 자리로"
              >
                {head[1]}
              </DropdownMenuTrigger>
              <DropdownMenuContent className={menuClass}>
                {heads.map(([p, label]) => (
                  <DropdownMenuItem
                    key={`${p}-${label}`}
                    onClick={() => onGoParagraph(p)}
                    className={cn(
                      p === head[0] &&
                        label === head[1] &&
                        "font-bold text-primary",
                    )}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="px-0.5 font-bold text-primary">{head[1]}</span>
          )}
        </span>
      ) : null}
    </nav>
  );
}
