"use client";

import { Check, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import { editionBadgeClass, orderEditions } from "@/components/suttas/sutta-row";
import { FONT_SIZES, LINE_HEIGHTS } from "@/lib/constants";
import { fetchEditionInfo } from "@/lib/content";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settings";
import type { AnalysisKind, Edition, EditionInfo, InlinePart, Language } from "@/types";

const LANGUAGE_NAME: Record<Language, string> = { ko: "한국어", pli: "빠알리어", en: "영어" };

type SheetProps = { open: boolean; onOpenChange: (open: boolean) => void };

/** 판본 선택 — 언어별로 묶어 여러 개를 고르면 문장마다 번갈아 비교한다 (원래 앱과 같다) */
export function EditionPickerSheet({
  open,
  onOpenChange,
  editions,
  shownIds,
  onToggle,
  commentary,
  commentaryFirst = false,
}: SheetProps & {
  editions: Edition[];
  shownIds: string[];
  onToggle: (id: string) => void;
  /** 주석서·복주석서 판본(VRI 원문과 번역자) — 있으면 아래(또는 위)에 따로 고른다 */
  commentary?: { editions: Edition[]; shownIds: string[]; onToggle: (id: string) => void };
  /** 주석서·복주석서 탭에서 열면 주석 판본을 먼저 */
  commentaryFirst?: boolean;
}) {
  const sections = [
    { key: "sutta", title: commentary ? "경" : null, editions, shownIds, onToggle },
    ...(commentary ? [{ key: "commentary", title: "주석서 · 복주석서", ...commentary }] : []),
  ];
  if (commentaryFirst) sections.reverse();
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="판본 선택"
      subtitle="여러 판본을 선택하면 문장별로 비교할 수 있습니다"
    >
      <div className="flex flex-col gap-6">
        {sections.map((sec) => (
          <div key={sec.key} className="flex flex-col gap-4">
            {sec.title ? (
              <h2 className="border-b pb-2 text-base font-bold text-primary">{sec.title}</h2>
            ) : null}
            <EditionGroups editions={sec.editions} shownIds={sec.shownIds} onToggle={sec.onToggle} />
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

function EditionGroups({
  editions,
  shownIds,
  onToggle,
}: {
  editions: Edition[];
  shownIds: string[];
  onToggle: (id: string) => void;
}) {
  const groups = (["ko", "pli", "en"] as const)
    .map((lang) => ({ lang, items: editions.filter((e) => e.language === lang) }))
    .filter((g) => g.items.length > 0);
  return groups.map((g) => (
    <div key={g.lang}>
      <h3 className="mb-2 px-2 text-sm font-bold">{LANGUAGE_NAME[g.lang]}</h3>
      <div className="flex flex-col gap-2">
        {g.items.map((e) => {
          const on = shownIds.includes(e.id);
          return (
            <button
              key={e.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(e.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-4 py-3 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                on ? "bg-primary text-primary-foreground" : "bg-gray-50 text-secondary-foreground hover:bg-gray-100 dark:bg-muted",
              )}
            >
              <span className="text-left text-sm font-bold">{e.label}</span>
              {on ? <Check className="size-4" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </div>
  ));
}

/** 판본 배지를 누르면 — 판본 정보 */
/**
 * 판본 정보 — 판본 칩(본문)이나 대역·문법분석의 저자 이름을 누르면 연다.
 * kind 가 대역·문법분석이면 그 소개를 먼저 보이고, 없으면 본문 소개를 보인다.
 */
export function EditionInfoSheet({
  open,
  onOpenChange,
  edition,
  kind = "text",
}: SheetProps & { edition: Edition | null; kind?: "text" | AnalysisKind }) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="판본 정보">
      {edition ? (
        <div className="flex flex-col gap-5 py-1">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold text-white",
                editionBadgeClass(edition),
              )}
            >
              {edition.badge})
            </span>
            <div>
              <p className="text-base font-semibold">{edition.label}</p>
              <p className="mt-0.5 text-xs text-faint">{LANGUAGE_NAME[edition.language]}</p>
            </div>
          </div>
          <div className="border-t" />
          <EditionInfoBody editionId={edition.id} kind={kind} />
          {edition.allowCopy ? null : (
            <p className="text-sm leading-relaxed text-secondary-foreground">
              이 번역은 저작권자의 뜻에 따라 복사·인쇄할 수 없습니다.
            </p>
          )}
          <Link href="/about#editions" className="text-sm font-bold text-primary hover:underline">
            모든 판본의 출처와 저작권 보기 →
          </Link>
        </div>
      ) : null}
    </BottomSheet>
  );
}

/** 판본 소개 글 (번역자 소개 · 번역본 출처 · 저작권 안내 …) — 창을 열 때 받는다 */
const GROUP_LABEL = { text: "번역", nissaya: "대역", grammar: "문법분석" } as const;

function EditionInfoBody({ editionId, kind }: { editionId: string; kind: "text" | AnalysisKind }) {
  const [state, setState] = useState<{ id: string; info: EditionInfo | null } | null>(null);
  useEffect(() => {
    let alive = true;
    fetchEditionInfo(editionId)
      .then((info) => alive && setState({ id: editionId, info }))
      .catch(() => alive && setState({ id: editionId, info: null }));
    return () => {
      alive = false;
    };
  }, [editionId]);
  if (!state || state.id !== editionId) return <p className="text-sm text-faint">불러오는 중…</p>;
  if (!state.info) return null;
  // 고른 쪽(본문·대역·문법분석) 소개를 맨 앞에. 소개가 여러 묶음이면 묶음 이름을 단다.
  const groups = [...state.info.groups].sort((a, b) => Number(b.kind === kind) - Number(a.kind === kind));
  return (
    <div className="flex flex-col gap-8">
      {groups.map((group, g) => (
        <div key={group.kind} className="flex flex-col gap-8">
          {groups.length > 1 ? (
            <p className={cn("-mb-3 text-xs font-bold tracking-wide text-primary", g > 0 && "border-t pt-6")}>
              {GROUP_LABEL[group.kind]}
            </p>
          ) : null}
          {group.sections.map((section, i) => (
            <section key={i} className="flex flex-col gap-4">
              <h3 className="font-pali text-lg font-semibold text-gray-900 dark:text-foreground">{section.title}</h3>
              {section.paragraphs.map((parts, j) => (
                <p key={j} className="text-[15px] leading-7 whitespace-pre-line text-gray-600 dark:text-muted-foreground">
                  <InfoText parts={parts} />
                </p>
              ))}
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}

function InfoText({ parts }: { parts: InlinePart[] }) {
  return parts.map((part, i) =>
    part.type === "bold" ? (
      <strong key={i} className="font-pali font-bold text-gray-900 dark:text-foreground">
        {part.text}
      </strong>
    ) : part.type === "note" ? null : part.type === "em" ? (
      <em key={i}>{part.text}</em>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  );
}

export interface TocEntry {
  paragraph: string;
  label: string;
  title?: string;
}

/** 목차 — 문단 번호(와 단락 제목). 누르면 그 문단으로 */
export function TocSheet({
  open,
  onOpenChange,
  title,
  items,
  onPick,
}: SheetProps & { title: string; items: TocEntry[]; onPick: (paragraph: string) => void }) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="목차" subtitle={title}>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <button
            key={item.paragraph}
            type="button"
            onClick={() => onPick(item.paragraph)}
            className="w-full rounded-xl border bg-gray-50 px-4 py-3 text-left transition-colors outline-none hover:border-amber-200 hover:bg-amber-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-muted"
          >
            <span className="text-sm text-secondary-foreground">
              {item.label}
              {item.title ? <span className="ml-2 font-medium">{item.title}</span> : null}
            </span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

/** 텍스트 설정 — 글자 크기·줄 간격 (원래 앱과 같은 범위) + 인쇄 */
export function TextSettingsSheet({
  open,
  onOpenChange,
  onWordLinksOn,
}: SheetProps & { onWordLinksOn?: () => void }) {
  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const setLineHeight = useSettingsStore((s) => s.setLineHeight);
  const wordLinks = useSettingsStore((s) => s.wordLinks);
  const noteFontSize = useSettingsStore((s) => s.noteFontSize);
  const panelFontSize = useSettingsStore((s) => s.panelFontSize);
  const setNoteFontSize = useSettingsStore((s) => s.setNoteFontSize);
  const setPanelFontSize = useSettingsStore((s) => s.setPanelFontSize);
  const setWordLinks = useSettingsStore((s) => s.setWordLinks);
  const style = { fontSize, lineHeight };
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="텍스트 설정">
      <div className="flex flex-col gap-6">
        <PageEditionsPicker />
        <WordLinksSwitch
          on={wordLinks}
          onChange={(on) => {
            if (on) onWordLinksOn?.();
            setWordLinks(on);
          }}
        />
        <div>
          <label htmlFor="font-size" className="mb-3 block text-sm font-bold">
            글자 크기: {fontSize}px
          </label>
          <input
            id="font-size"
            type="range"
            min={FONT_SIZES[0]}
            max={FONT_SIZES.at(-1)}
            step={1}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="mt-1 flex justify-between text-xs text-faint">
            <span>{FONT_SIZES[0]}px</span>
            <span>{FONT_SIZES.at(-1)}px</span>
          </div>
        </div>
        <div>
          <label htmlFor="line-height" className="mb-3 block text-sm font-bold">
            줄 간격: {lineHeight}
          </label>
          <input
            id="line-height"
            type="range"
            min={LINE_HEIGHTS[0]}
            max={LINE_HEIGHTS.at(-1)}
            step={0.25}
            value={lineHeight}
            onChange={(e) => setLineHeight(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <div className="mt-1 flex justify-between text-xs text-faint">
            <span>좁게</span>
            <span>넓게</span>
          </div>
        </div>
        <SizeSlider id="note-size" label="각주 글자 크기" value={noteFontSize} onChange={setNoteFontSize} />
        <SizeSlider
          id="panel-size"
          label="풀이 창 글자 크기 (문법분석·대역·사전)"
          value={panelFontSize}
          onChange={setPanelFontSize}
        />
        <div className="rounded-xl border bg-gray-50 p-4 dark:bg-muted">
          <p lang="pi" className="font-pali" style={style}>
            Manopubbaṅgamā dhammā, manoseṭṭhā manomayā;
          </p>
          <p className="mt-2 font-pali text-muted-foreground" style={style}>
            마음이 모든 법의 선두이며, 마음이 으뜸이고, 마음으로 이루어진다.
          </p>
          <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-muted-foreground" style={{ fontSize: noteFontSize }}>
            <span className="mr-1 font-semibold text-primary">1)</span>각주는 이 크기로 보입니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-bold text-secondary-foreground hover:bg-muted"
        >
          <Printer className="size-4" aria-hidden />이 경 인쇄하기
        </button>
      </div>
    </BottomSheet>
  );
}

/** 머리 아래 판본 배지 줄 (누르면 판본 정보) */
export function EditionBadges({ editions, onInfo }: { editions: Edition[]; onInfo: (e: Edition) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 print:hidden">
      {orderEditions(editions).map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => onInfo(e)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white active:opacity-75",
            editionBadgeClass(e),
          )}
        >
          {e.badge}) {e.label}
        </button>
      ))}
    </div>
  );
}

/** 주석 연결 낱말 켜기·끄기 — 빠알리 원문에서 주석이 풀이한 낱말에 점선 밑줄, 누르면 그 주석 줄 */
export function WordLinksSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-muted"
    >
      <span>
        <span className="block text-sm font-bold">주석 연결 낱말</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          빠알리 원문에서 주석서·복주석서가 풀이한 낱말에{" "}
          <span className="text-amber-800 underline decoration-amber-500 decoration-dotted decoration-2 underline-offset-4">
            점선 밑줄
          </span>
          을 긋고, 누르면 그 풀이를 보여 줍니다.
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          on ? "bg-primary" : "bg-gray-300 dark:bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
            on ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function SizeSlider({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (size: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-3 block text-sm font-bold">
        {label}: {value}px
      </label>
      <input
        id={id}
        type="range"
        min={FONT_SIZES[0]}
        max={FONT_SIZES.at(-1)}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

const PAGE_EDITIONS = [
  { ed: "P", label: "PTS" },
  { ed: "M", label: "미얀마 6차" },
  { ed: "T", label: "태국" },
  { ed: "V", label: "VRI 인쇄본" },
] as const;

/** 책 쪽 번호 표시 — 인쇄본의 쪽이 바뀌는 문장 옆에 작게 (논문·책 인용용) */
function PageEditionsPicker() {
  const eds = useSettingsStore((s) => s.pageEditions);
  const setEds = useSettingsStore((s) => s.setPageEditions);
  return (
    <div className="rounded-xl border px-4 py-3">
      <p className="text-sm font-bold">책 쪽 번호</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        인쇄본의 쪽이 바뀌는 문장 옆에 쪽 번호를 작게 보입니다 (VRI 원문이 있는 경). 인용할 때 쓰세요.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PAGE_EDITIONS.map(({ ed, label }) => {
          const on = eds.includes(ed);
          return (
            <button
              key={ed}
              type="button"
              aria-pressed={on}
              onClick={() => setEds(on ? eds.filter((x) => x !== ed) : [...eds, ed])}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors",
                on ? "border-transparent bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-gray-50",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
