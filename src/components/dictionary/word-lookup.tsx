"use client";

import { CloudOff, SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineText } from "@/components/sutta/inline-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDpdTemplates, fetchInflections, lookupWord, type WordLookup } from "@/lib/content";
import { normalizeWord } from "@/lib/pali";
import { DICTIONARY_LABELS, DICTIONARY_ORDER, LICENSE_UNKNOWN } from "@/lib/constants";
import { parseInline } from "@/lib/segments";
import { cn } from "@/lib/utils";
import { useRecentStore } from "@/store/recent";
import { useSettingsStore } from "@/store/settings";
import type { DictionaryId, DpdEntry, DpdTemplate, PlainDictionaryId, PlainEntry } from "@/types";

/** 뜻풀이 글만 있는 사전들 — 표시 순서, 글 언어, 출처 */
const PLAIN_SECTIONS: { id: PlainDictionaryId; lang: string; credit: string | null }[] = [
  { id: "kpts", lang: "ko", credit: "K-PTSdic. 한글빠알리사전 · 원문 표기: 선운사대학원용 초역, 박경숙" },
  { id: "pts", lang: "en", credit: null },
  { id: "mm", lang: "my", credit: null },
];

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; result: WordLookup };

/** 사전 선택 칩 — 경 읽기의 단어 창과 사전 화면이 같이 쓴다. */
export function DictionaryPicker() {
  const dictionaries = useSettingsStore((s) => s.dictionaries);
  const toggle = useSettingsStore((s) => s.toggleDictionary);
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="사전 선택">
      {DICTIONARY_ORDER.map((id) => {
        const on = dictionaries.includes(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(id)}
            className={cn(
              "h-8 rounded-lg border px-2.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              on
                ? "border-transparent bg-brand-soft font-semibold text-brand-ink"
                : "border-line-strong bg-card font-medium text-muted-foreground hover:bg-hover",
            )}
          >
            {DICTIONARY_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * 단어 하나의 사전 결과.
 * onSearch 가 있으면 자판 글자로 찾았을 때 다른 형태를 눌러 다시 찾을 수 있다.
 */
export function WordLookupResult({
  word,
  onSearch,
  columns = false,
}: {
  word: string;
  onSearch?: (word: string) => void;
  /** 넓은 칸(컴퓨터 아래 칸): 사전들을 옆으로 나란히 */
  columns?: boolean;
}) {
  const dictionaries = useSettingsStore((s) => s.dictionaries);
  const dictKey = DICTIONARY_ORDER.filter((d) => dictionaries.includes(d)).join(",");
  const [state, setState] = useState<State & { key: string }>({ status: "loading", key: "" });
  const [attempt, setAttempt] = useState(0);
  const key = `${word}|${dictKey}|${attempt}`;

  useEffect(() => {
    let cancelled = false;
    const dicts = DICTIONARY_ORDER.filter((d) => dictKey.split(",").includes(d));
    lookupWord(word, dicts)
      .then((result) => {
        if (cancelled) return;
        setState({ status: "ready", result, key });
        // 사전 화면의 "최근 찾은 단어"에 남긴다 (실제로 찾은 형태로)
        useRecentStore.getState().add(result.normalized || word);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: e instanceof Error ? e.message : "사전을 받지 못했습니다",
            key,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [word, dictKey, key]);

  if (state.key !== key || state.status === "loading") {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <EmptyState
        icon={CloudOff}
        title="사전 검색에 실패했습니다"
        description={state.message}
        action={<Button onClick={() => setAttempt((n) => n + 1)}>다시 시도</Button>}
      />
    );
  }

  const { result } = state;
  const count = (id: DictionaryId) => (id === "dpd" ? result.dpd : result[id]).length;
  const resolved = (
    <ResolvedNote word={word} result={result} onSearch={onSearch} />
  );
  if (dictionaries.every((id) => count(id) === 0)) {
    return (
      <>
      {resolved}
      <EmptyState
        icon={SearchX}
        title={`“${word}”의 사전 검색 결과가 없습니다`}
        description="다른 사전을 켜거나 기본형으로 찾아 보세요."
      />
      </>
    );
  }

  return (
    <div className={columns ? "grid items-start gap-4 xl:grid-cols-2 [&>*:first-child:not(section)]:col-span-full" : "flex flex-col gap-6"}>
      {resolved}
      {/* 사전은 고른 차례대로 (먼저 켠 사전이 앞) */}
      {dictionaries.map((id) =>
        id === "dpd" ? (
          result.dpd.length > 0 ? (
            <section key="dpd" className="rounded-2xl border bg-card px-5 pt-4 pb-3 shadow-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="font-pali text-base font-bold">{DICTIONARY_LABELS.dpd}</h3>
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">English</span>
              </div>
              <div className="flex flex-col divide-y">
                {result.dpd.map((entry) => (
                  <DpdCard key={entry.id} entry={entry} />
                ))}
              </div>
              <p className="t-meta mt-2">Digital Pāḷi Dictionary 제공 · CC BY-NC-SA 4.0</p>
            </section>
          ) : null
        ) : (
          (() => {
            const sec = PLAIN_SECTIONS.find((x) => x.id === id);
            if (!sec || result[id].length === 0) return null;
            return (
              <section key={id} className="flex flex-col gap-3">
                <SectionTitle id={id} />
                {result[id].map((entry) => (
                  <PlainCard key={entry.headword} entry={entry} lang={sec.lang} />
                ))}
                <p className="t-meta">
                  {sec.credit ? `${sec.credit} · ` : ""}이용 조건 {LICENSE_UNKNOWN}
                </p>
              </section>
            );
          })()
        ),
      )}
    </div>
  );
}

/** 빠알리 자판 없이 쳐서 다른 형태로 찾았을 때 알리고, 다른 후보를 고르게 한다 */
function ResolvedNote({
  word,
  result,
  onSearch,
}: {
  word: string;
  result: WordLookup;
  onSearch?: (word: string) => void;
}) {
  if (result.normalized === normalizeWord(word) && result.alternatives.length === 0) return null;
  return (
    <div className="t-sub flex flex-wrap items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2">
      <span>
        “{word}” → <strong lang="pi" className="font-bold text-foreground">{result.normalized}</strong> 로
        찾았습니다.
      </span>
      {result.alternatives.length > 0 && onSearch ? (
        <>
          <span>다른 형태:</span>
          {result.alternatives.slice(0, 8).map((alt) => (
            <button
              key={alt}
              type="button"
              lang="pi"
              onClick={() => onSearch(alt)}
              className="rounded-md border border-line-strong bg-card px-1.5 text-sm font-medium hover:bg-hover"
            >
              {alt}
            </button>
          ))}
        </>
      ) : null}
    </div>
  );
}

function SectionTitle({ id }: { id: DictionaryId }) {
  return <h3 className="t-card">{DICTIONARY_LABELS[id]}</h3>;
}

/** 글자 속 <b>·<i> 를 안전하게 그린다 */
function Rich({ text }: { text: string }) {
  return <InlineText parts={parseInline(text)} />;
}

type DpdTab = "grammar" | "examples" | "declension";

/** DPD 누리집에서 이 낱말 찾기 (어근 가족·합성어 가족·숙어·빈도·의견 보내기는 그곳에서) */
function dpdUrl(lemma: string): string {
  return `https://www.dpdict.net/?q=${encodeURIComponent(lemma.replace(/\s+\d+(\.\d+)?$/, ""))}`;
}

/** 원래 앱과 같은 DPD 표제어 — 호박색 표제어, 품사 + 굵은 뜻; lit. [구성] ✓, 아래에 동그란 단추들 */
function DpdCard({ entry }: { entry: DpdEntry }) {
  const [tab, setTab] = useState<DpdTab | null>(null);
  const rows: [string, string][] = [
    ["Grammar", entry.grammar],
    ["Root", entry.root],
    ["Base", entry.base],
    ["Construction", entry.construction],
    ["Derivative", entry.derivative],
    ["Compound", entry.compound],
    ["Antonym", entry.antonym],
    ["Synonym", entry.synonym],
    ["Variant", entry.variant],
    ["Commentary", entry.commentary],
    ["Notes", entry.notes],
    ["Sanskrit", entry.sanskrit],
  ];
  const meaning = entry.meaning1 || entry.meaning2;
  const verb = /^(pr|aor|fut|opt|imp|cond|perf)$/.test(entry.pos);
  const pill = (id: DpdTab, label: string) => (
    <button
      key={id}
      type="button"
      aria-expanded={tab === id}
      onClick={() => setTab((t) => (t === id ? null : id))}
      className={cn(
        "rounded-full border px-3 py-1 font-pali text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        tab === id
          ? "border-primary bg-brand-soft text-primary"
          : "border-gray-300 text-gray-600 hover:border-amber-300 hover:bg-amber-50 dark:border-border dark:text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
  const link = (label: string) => (
    <a
      key={label}
      href={dpdUrl(entry.lemma)}
      target="_blank"
      rel="noopener noreferrer"
      title="DPD 누리집에서 보기"
      className="rounded-full border border-gray-300 px-3 py-1 font-pali text-sm font-semibold text-gray-600 transition-colors hover:border-amber-300 hover:bg-amber-50 dark:border-border dark:text-muted-foreground"
    >
      {label}
    </a>
  );

  return (
    <article className="flex flex-col gap-2 py-3 first:pt-1">
      <h4 lang="pi" className="font-pali text-lg font-bold text-amber-800 dark:text-amber-300">
        {entry.lemma}
      </h4>
      <p className="font-pali leading-relaxed">
        <span>{entry.pos}.</span>{" "}
        {entry.meaning1 ? (
          <strong className="font-bold">
            <Rich text={meaning} />
          </strong>
        ) : (
          <Rich text={meaning} />
        )}
        {entry.meaningLit && !entry.meaning2.includes("; lit.") ? <span>; lit. {entry.meaningLit}</span> : null}
        {entry.constructionSummary ? (
          <span lang="pi"> [{entry.constructionSummary}]</span>
        ) : null}
        {entry.meaning1 ? (
          <span className="ml-1 text-faint" title="DPD 에서 확인된 뜻">
            ✓
          </span>
        ) : null}
      </p>

      <div className="flex flex-wrap gap-2">
        {pill("grammar", "grammar")}
        {entry.examples.length > 0 ? pill("examples", entry.examples.length === 1 ? "example" : "examples") : null}
        {entry.hasInflections ? pill("declension", verb ? "conjugation" : "declension") : null}
        {link("root family")}
        {link("compound family")}
        {link("idioms")}
        {link("frequency")}
        {link("feedback")}
      </div>

      {tab === "grammar" ? (
        <table className="mt-1 w-full rounded-xl bg-gray-50 text-sm dark:bg-muted">
          <tbody>
            {rows
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <tr key={label} className="border-t border-gray-200 align-top first:border-t-0 dark:border-border">
                  <th className="w-28 px-3 py-1.5 text-left font-semibold whitespace-nowrap text-muted-foreground">{label}</th>
                  <td lang={label === "Grammar" ? undefined : "pi"} className="py-1.5 pr-3 font-pali whitespace-pre-line">
                    <Rich text={value} />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : null}
      {tab === "examples" ? (
        <div className="mt-1 flex flex-col gap-3 rounded-xl bg-gray-50 p-3 dark:bg-muted">
          {entry.examples.map((ex, i) => (
            <blockquote key={i}>
              <p lang="pi" className="font-pali whitespace-pre-line">
                <Rich text={ex.text} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{ex.source}</p>
            </blockquote>
          ))}
        </div>
      ) : null}
      {tab === "declension" ? (
        <div className="mt-1 rounded-xl bg-gray-50 p-3 dark:bg-muted">
          <Inflections entry={entry} verb={verb} />
        </div>
      ) : null}
    </article>
  );
}

function Inflections({ entry, verb }: { entry: DpdEntry; verb: boolean }) {
  const [templates, setTemplates] = useState<Record<string, DpdTemplate> | "error" | null>(null);
  useEffect(() => {
    if (!entry.pattern) return;
    let cancelled = false;
    fetchDpdTemplates().then(
      (t) => !cancelled && setTemplates(t),
      () => !cancelled && setTemplates("error"),
    );
    return () => {
      cancelled = true;
    };
  }, [entry.pattern]);
  const template = entry.pattern && templates && templates !== "error" ? templates[entry.pattern] : undefined;
  if (!entry.pattern || templates === "error" || (templates && !template)) return <InflectionList id={entry.id} />;
  if (!template) return <Skeleton className="h-24 w-full" />;
  return <InflectionTable entry={entry} template={template} verb={verb} />;
}

/** DPD 와 같은 어형 변화표 — 어간 + 어미(굵게). 이 낱말 자신은 강조 */
function InflectionTable({ entry, template, verb }: { entry: DpdEntry; template: DpdTemplate; verb: boolean }) {
  const stem = entry.stem ?? "";
  const lemma = entry.lemma.replace(/\s+\d.*$/, "");
  const num = entry.lemma.match(/\s+(\d.*)$/)?.[1];
  const [head, ...body] = template.rows;
  const cols = head.flatMap((_, i) => (i % 2 === 1 ? [i] : []));
  return (
    <div className="flex flex-col gap-3">
      <p lang="pi" className="font-pali text-[15px]">
        <b>{lemma}</b>
        {num ? <sup>{num}</sup> : null} is <b>{entry.pattern}</b> {verb ? "conjugation" : "declension"}
        {template.like && template.like !== "irreg" ? (
          <>
            {" "}
            (like <b>{template.like}</b>)
          </>
        ) : template.like === "irreg" ? (
          " (irregular)"
        ) : null}
      </p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table lang="pi" className="w-full border-collapse text-center font-pali text-sm">
          <thead>
            <tr className="bg-amber-50/70 dark:bg-muted">
              <th className="border-b px-3 py-2" />
              {cols.map((c) => (
                <th key={c} className="border-b border-l px-3 py-2 font-sans text-xs font-bold whitespace-nowrap">
                  {head[c].join(", ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r} className="even:bg-gray-50/60 dark:even:bg-muted/40">
                <th className="border-t px-3 py-2 font-sans text-xs font-bold whitespace-nowrap">{row[0]?.join(", ")}</th>
                {cols.map((c) => (
                  <td key={c} title={row[c + 1]?.join(", ")} className="border-t border-l px-3 py-1.5 align-middle">
                    {(row[c] ?? []).map((ending, k) => {
                      const word = `${stem}${ending}`;
                      const self = word === lemma;
                      return (
                        <span
                          key={k}
                          className={cn(
                            "block whitespace-nowrap",
                            self && "mx-auto w-fit rounded-md bg-amber-100 px-1.5 text-amber-900 ring-1 ring-amber-300",
                          )}
                        >
                          {stem}
                          <b>{ending}</b>
                        </span>
                      );
                    })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Digital Pāḷi Dictionary 어형 변화표</p>
    </div>
  );
}

function InflectionList({ id }: { id: number }) {
  const [forms, setForms] = useState<string[] | "error" | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchInflections(id).then(
      (f) => !cancelled && setForms(f),
      () => !cancelled && setForms("error"),
    );
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (forms === null) return <Skeleton className="h-10 w-full" />;
  if (forms === "error") return <p className="t-sub">어형 변화를 불러오지 못했습니다.</p>;
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold text-muted-foreground">어형 {forms.length}개</h4>
      <p lang="pi" className="font-pali text-sm leading-relaxed">
        {forms.join(", ")}
      </p>
    </div>
  );
}


function PlainCard({ entry, lang }: { entry: PlainEntry; lang: string }) {
  return (
    <article className="rounded-xl border bg-card p-4">
      <p lang="pi" className="mb-2 font-bold">
        {entry.headword}
      </p>
      <div className="flex flex-col gap-3">
        {entry.definitions.map((text, i) => (
          <p key={i} lang={lang} className="t-sub whitespace-pre-line wrap-anywhere">
            {text}
          </p>
        ))}
      </div>
    </article>
  );
}
