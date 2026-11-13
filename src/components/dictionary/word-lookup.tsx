"use client";

import { CloudOff, SearchX } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineText } from "@/components/sutta/inline-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  analyzeParts,
  fetchDpdFamily,
  fetchDpdFreqLayout,
  fetchDpdFrequency,
  fetchDpdTemplates,
  fetchInflections,
  lookupWord,
  type PartAnalysis,
  type SplitWays,
  type WordLookup,
} from "@/lib/content";
import { normalizeWord } from "@/lib/pali";
import { DICTIONARY_LABELS, DICTIONARY_ORDER, LICENSE_UNKNOWN } from "@/lib/constants";
import { parseInline } from "@/lib/segments";
import { cn } from "@/lib/utils";
import { useRecentStore } from "@/store/recent";
import { useSettingsStore } from "@/store/settings";
import type {
  DictionaryId,
  DpdEntry,
  DpdFamily,
  DpdFamilyKind,
  DpdFreqRow,
  DpdFrequency,
  DpdTemplate,
  PlainDictionaryId,
  PlainEntry,
} from "@/types";

/** 뜻풀이 글만 있는 사전들 — 표시 순서, 글 언어, 출처 */
const PLAIN_SECTIONS: { id: PlainDictionaryId; lang: string; credit: string | null }[] = [
  { id: "kpts", lang: "ko", credit: "K-PTSdic. 한글빠알리사전 · 원문 표기: 선운사대학원용 초역, 박경숙" },
  { id: "pts", lang: "en", credit: null },
  {
    id: "peu",
    lang: "en",
    credit: "Pāḷi Myanmar Abhidhān 영어 번역 (사람 번역 약 80%, 나머지는 기계 번역이라 어색한 문장이 섞여 있어요) · pm12e.pali.tools",
  },
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
    <>
      <ResolvedNote word={word} result={result} onSearch={onSearch} />
      {result.split.ways.length ? <AnalysisCard key={result.normalized || word} word={result.normalized || word} split={result.split} onSearch={onSearch} /> : null}
    </>
  );
  if (dictionaries.every((id) => count(id) === 0)) {
    if (result.split.ways.length) return resolved;
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
                  <DpdCard key={entry.id} entry={entry} onSearch={onSearch} />
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

type DpdTab = "grammar" | "examples" | "declension" | DpdFamilyKind | "frequency";

/** DPD 의견 보내기 (DPD 가 쓰는 구글 설문 — 낱말 번호·표제어를 미리 채운다) */
function dpdFeedbackUrl(entry: DpdEntry): string {
  return (
    "https://docs.google.com/forms/d/e/1FAIpQLSf9boBe7k5tCwq7LdWgBHHGIPVc4ROO5yjVDo1X5LDAxkmGWQ/viewform?usp=pp_url" +
    `&entry.438735500=${encodeURIComponent(`${entry.id} ${entry.lemma}`)}`
  );
}

const FAMILY_LABEL: Record<DpdFamilyKind, string> = {
  root: "root family",
  word: "word family",
  compound: "compound family",
  idiom: "idioms",
  set: "sets",
};

/** 원래 앱과 같은 DPD 표제어 — 호박색 표제어, 품사 + 굵은 뜻; lit. [구성] ✓, 아래에 동그란 단추들 */
function DpdCard({ entry, onSearch }: { entry: DpdEntry; onSearch?: (word: string) => void }) {
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
  const fam = entry.fam ?? {};
  const familyKeys = (kind: DpdFamilyKind): string[] => {
    const v = fam[kind];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  };

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
        {(["root", "word", "compound", "idiom", "set"] as const).map((kind) =>
          familyKeys(kind).length ? pill(kind, FAMILY_LABEL[kind]) : null,
        )}
        {pill("frequency", "frequency")}
        <a
          href={dpdFeedbackUrl(entry)}
          target="_blank"
          rel="noopener noreferrer"
          title="DPD 편집자에게 이 낱말에 대한 의견을 보냅니다 (구글 설문, 영어)"
          className="rounded-full border border-gray-300 px-3 py-1 font-pali text-sm font-semibold text-gray-600 transition-colors hover:border-amber-300 hover:bg-amber-50 dark:border-border dark:text-muted-foreground"
        >
          feedback ↗
        </a>
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
      {tab === "root" || tab === "word" || tab === "compound" || tab === "idiom" || tab === "set" ? (
        <div className="mt-1 flex flex-col gap-4 rounded-xl bg-gray-50 p-3 dark:bg-muted">
          {familyKeys(tab).map((key) => (
            <FamilyList key={`${tab}-${key}`} kind={tab} familyKey={key} self={entry.id} onSearch={onSearch} />
          ))}
        </div>
      ) : null}
      {tab === "frequency" ? (
        <div className="mt-1 rounded-xl bg-gray-50 p-3 dark:bg-muted">
          <FrequencyTable id={entry.id} />
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

/** DPD 가족 하나 — 머리(어근 뜻 등)와 낱말 목록. 낱말을 누르면 그 낱말을 찾는다 */
function FamilyList({
  kind,
  familyKey,
  self,
  onSearch,
}: {
  kind: DpdFamilyKind;
  familyKey: string;
  self: number;
  onSearch?: (word: string) => void;
}) {
  const [family, setFamily] = useState<DpdFamily | null | "error" | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    fetchDpdFamily(kind, familyKey).then(
      (f) => !cancelled && setFamily(f),
      () => !cancelled && setFamily("error"),
    );
    return () => {
      cancelled = true;
    };
  }, [kind, familyKey]);
  if (family === undefined) return <Skeleton className="h-24 w-full" />;
  if (family === "error" || family === null) return <p className="text-sm text-faint">가족 자료를 받지 못했습니다.</p>;
  const title = kind === "root" ? familyKey.split("|")[1] : familyKey;
  const what =
    kind === "root"
      ? "어근"
      : kind === "word"
        ? "낱말"
        : kind === "compound"
          ? "합성어"
          : kind === "idiom"
            ? "숙어"
            : "같은 묶음";
  return (
    <section>
      <p lang="pi" className="mb-2 font-pali text-[15px]">
        <b>{title}</b> {family.head ? <span className="text-muted-foreground">{family.head}</span> : null}{" "}
        <span className="font-sans text-xs text-faint">
          · {what} 가족 {family.words.length}개
        </span>
      </p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {family.words.map(([id, lemma, pos, meaning]) => (
              <tr key={id} className={cn("border-t first:border-t-0 align-top", id === self && "bg-brand-soft")}>
                <td lang="pi" className="px-3 py-1.5 font-pali font-semibold whitespace-nowrap">
                  {onSearch && id !== self ? (
                    <button
                      type="button"
                      onClick={() => onSearch(lemma.replace(/\s+\d+(\.\d+)?$/, ""))}
                      className="text-left text-primary hover:underline"
                    >
                      {lemma}
                    </button>
                  ) : (
                    lemma
                  )}
                </td>
                <td className="px-2 py-1.5 text-xs whitespace-nowrap text-muted-foreground">{pos}</td>
                <td className="py-1.5 pr-3">{meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const FREQ_EDITIONS = [
  { src: "c", name: "CST", title: "Chaṭṭha Saṅgāyana Tipiṭaka (미얀마 6차 결집본)", cols: ["M", "A", "Ṭ"] },
  { src: "b", name: "BJT", title: "Buddha Jayanti Tipiṭaka (스리랑카)", cols: ["M", "A"] },
  { src: "s", name: "SYA", title: "Syāmaraṭṭha 1927 (태국 왕실본)", cols: ["M", "A"] },
  { src: "m", name: "MST", title: "Mahāsaṅgīti Tipiṭaka (수따센트럴)", cols: ["M"] },
] as const;

/** DPD 와 같은 빈도표 — 판본(CST·BJT·SYA·MST) × 경·주석·복주석, 책 묶음별 출현 횟수. 많을수록 진한 색 */
function FrequencyTable({ id }: { id: number }) {
  const [data, setData] = useState<{ freq: DpdFrequency | null; layout: DpdFreqRow[] } | "error" | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchDpdFrequency(id), fetchDpdFreqLayout()]).then(
      ([freq, layout]) => !cancelled && setData({ freq, layout }),
      () => !cancelled && setData("error"),
    );
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (data === null) return <Skeleton className="h-40 w-full" />;
  if (data === "error") return <p className="text-sm text-faint">빈도 자료를 받지 못했습니다.</p>;
  const { freq, layout } = data;
  if (!freq) return <p className="text-sm text-faint">이 낱말은 합성어 안에서만 나오거나 빈도 자료가 없습니다.</p>;
  const all = [...freq.c, ...(freq.b ?? []), ...(freq.s ?? []), ...(freq.m ?? [])];
  const max = Math.max(1, ...all);
  const shade = (n: number) => (n === 0 ? 0 : Math.max(1, Math.ceil((Math.log(n + 1) / Math.log(max + 1)) * 10)));
  return (
    <div className="flex flex-col gap-2">
      <p lang="pi" className="font-pali text-[15px]">
        <Rich text={freq.h} />
      </p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="border-collapse text-right text-xs tabular-nums">
          <thead>
            <tr>
              <th colSpan={2} />
              {FREQ_EDITIONS.map((e, k) => (
                <Fragment key={e.src}>
                  {k ? <th className="w-2" /> : null}
                  <th colSpan={e.cols.length} title={e.title} className="px-1 pt-2 text-center font-bold">
                    {e.name}
                  </th>
                </Fragment>
              ))}
            </tr>
            <tr>
              <th colSpan={2} />
              {FREQ_EDITIONS.map((e, k) => (
                <Fragment key={e.src}>
                  {k ? <th /> : null}
                  {e.cols.map((c) => (
                    <th key={c} title={{ M: "경 (mūla)", A: "주석서 (aṭṭhakathā)", Ṭ: "복주석서 (ṭīkā)" }[c]} className="px-1.5 pb-1 font-semibold text-muted-foreground">
                      {c}
                    </th>
                  ))}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {layout.map((row, r) =>
              row.group ? (
                <tr key={r}>
                  <th
                    rowSpan={row.groupSpan}
                    className="border-t px-1 align-middle text-[10px] font-bold text-muted-foreground [writing-mode:vertical-rl] rotate-180"
                  >
                    {row.group}
                  </th>
                </tr>
              ) : (
                <tr key={r}>
                  <th lang="pi" className="border-t px-2 py-0.5 text-left font-pali font-semibold whitespace-nowrap">
                    {row.label}
                  </th>
                  {row.cells.map((cell, k) => {
                    if ("gap" in cell) return <td key={k} className="w-2" />;
                    if ("void" in cell) return <td key={k} />;
                    const n = freq[cell.src]?.[cell.i] ?? 0;
                    const g = shade(n);
                    return (
                      <td
                        key={k}
                        rowSpan={cell.rs}
                        className="border border-background px-1.5 py-0.5"
                        style={{
                          backgroundColor: g ? `color-mix(in oklab, var(--color-primary) ${g * 8}%, transparent)` : undefined,
                          color: g >= 7 ? "var(--color-primary-foreground)" : undefined,
                        }}
                      >
                        {n || "-"}
                      </td>
                    );
                  })}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-faint">
        낱말과 그 모든 어형이 각 책 묶음에 나온 횟수예요 (합성어·연음 속에 든 것은 세지 않음). 출처: Digital Pāḷi Dictionary ·{" "}
        <a href="https://digitalpalidictionary.github.io/features/frequency/" target="_blank" rel="noopener noreferrer" className="underline">
          계산 방법
        </a>
      </p>
    </div>
  );
}

/**
 * 낱말 분석 (Digital Pāḷi Reader 의 Analysis 처럼) — 연음·합성으로 붙은 낱말을 나누는 방법들과, 조각마다 DPD 의 짧은 뜻·어미 문법.
 * 나누기는 DPD Splitter 결과(없으면 이 사이트 프로그램), 뜻·문법은 DPD 사전과 어형 변화표.
 */
function AnalysisCard({ word, split, onSearch }: { word: string; split: SplitWays; onSearch?: (word: string) => void }) {
  const [way, setWay] = useState(0);
  const parts = split.ways[Math.min(way, split.ways.length - 1)];
  const [analysis, setAnalysis] = useState<{ key: string; parts: PartAnalysis[] } | "error" | null>(null);
  const key = parts.join("+");
  useEffect(() => {
    let cancelled = false;
    analyzeParts(parts).then(
      (a) => !cancelled && setAnalysis({ key, parts: a }),
      () => !cancelled && setAnalysis("error"),
    );
    return () => {
      cancelled = true;
    };
    // parts 는 key 로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const ready = analysis && analysis !== "error" && analysis.key === key ? analysis.parts : null;
  return (
    <section className="rounded-2xl border bg-card px-5 py-4 shadow-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">
          낱말 분석 <span className="font-pali text-sm font-normal text-faint">Analysis · Splitter</span>
        </h3>
        {split.ways.length > 1 ? (
          <div role="group" aria-label="나누는 방법" className="flex flex-wrap gap-1">
            {split.ways.map((w, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={i === way}
                title={w.join(" + ")}
                onClick={() => setWay(i)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-xs font-bold",
                  i === way ? "border-transparent bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-hover",
                )}
              >
                {`나눔 ${i + 1}`}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <p lang="pi" className="font-pali text-lg font-bold text-amber-800 dark:text-amber-300">
        {word}
      </p>
      <p lang="pi" className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-pali text-lg">
        {parts.map((p, i) => (
          <Fragment key={i}>
            {i ? <span className="text-faint">+</span> : null}
            <span>{p}</span>
          </Fragment>
        ))}
      </p>
      {ready ? (
        <div className="mt-3 overflow-x-auto rounded-xl border">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {ready.map(({ part, entries }, i) => (
                <tr key={i} className="border-t align-top first:border-t-0">
                  <th lang="pi" className="w-28 bg-gray-50 px-3 py-2 text-left font-pali font-bold whitespace-nowrap dark:bg-muted">
                    {part}
                  </th>
                  <td className="px-3 py-2">
                    {entries.length === 0 ? (
                      <span className="text-faint">DPD 에 없는 조각</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {entries.map(({ entry, grammar }) => (
                          <li key={entry.id}>
                            {onSearch ? (
                              <button
                                type="button"
                                onClick={() => onSearch(entry.lemma.replace(/\s+\d+(\.\d+)?$/, ""))}
                                className="font-pali font-semibold text-primary hover:underline"
                              >
                                {entry.lemma}
                              </button>
                            ) : (
                              <span className="font-pali font-semibold">{entry.lemma}</span>
                            )}{" "}
                            <span className="text-xs text-muted-foreground">{entry.pos}.</span>{" "}
                            <span>{(entry.meaning1 || entry.meaning2).replace(/<[^>]+>/g, "")}</span>
                            {grammar.length ? (
                              <span className="ml-1 rounded bg-brand-soft px-1.5 py-0.5 text-xs font-semibold text-primary">
                                {[...new Set(grammar)].join(" · ")}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : analysis === "error" ? (
        <p className="mt-2 text-sm text-faint">조각의 뜻을 불러오지 못했습니다.</p>
      ) : (
        <Skeleton className="mt-3 h-20 w-full" />
      )}
      <p className="t-meta mt-2 border-t pt-2">
        {split.byDpd
          ? "나누기: DPD Splitter (프로그램이 만든 결과라 틀릴 수 있어요) · 뜻·문법: DPD"
          : "나누기: 이 사이트 프로그램이 연음 규칙으로 자동으로 나눈 것이라 틀릴 수 있어요 · 뜻·문법: DPD"}
        . 표제어를 누르면 그 낱말을 찾아요.
      </p>
    </section>
  );
}
