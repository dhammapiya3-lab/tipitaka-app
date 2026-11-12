"use client";

import { ChevronDown, CloudOff, SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineText } from "@/components/sutta/inline-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchInflections, lookupWord, type WordLookup } from "@/lib/content";
import { normalizeWord } from "@/lib/pali";
import { DICTIONARY_LABELS, DICTIONARY_ORDER, LICENSE_UNKNOWN } from "@/lib/constants";
import { parseInline } from "@/lib/segments";
import { cn } from "@/lib/utils";
import { useRecentStore } from "@/store/recent";
import { useSettingsStore } from "@/store/settings";
import type { DictionaryId, DpdEntry, PlainDictionaryId, PlainEntry } from "@/types";

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
}: {
  word: string;
  onSearch?: (word: string) => void;
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
    <div className="flex flex-col gap-6">
      {resolved}
      {dictionaries.includes("dpd") && result.dpd.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionTitle id="dpd" />
          {result.dpd.map((entry) => (
            <DpdCard key={entry.id} entry={entry} />
          ))}
          <p className="t-meta">Digital Pāḷi Dictionary 제공 · CC BY-NC-SA 4.0</p>
        </section>
      ) : null}
      {PLAIN_SECTIONS.map(({ id, lang, credit }) =>
        dictionaries.includes(id) && result[id].length > 0 ? (
          <section key={id} className="flex flex-col gap-3">
            <SectionTitle id={id} />
            {result[id].map((entry) => (
              <PlainCard key={entry.headword} entry={entry} lang={lang} />
            ))}
            <p className="t-meta">
              {credit ? `${credit} · ` : ""}이용 조건 {LICENSE_UNKNOWN}
            </p>
          </section>
        ) : null,
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

function DpdCard({ entry }: { entry: DpdEntry }) {
  const [open, setOpen] = useState(false);
  const rows: [string, string][] = [
    ["문법", entry.grammar],
    ["어근", entry.root],
    ["어기", entry.base],
    ["구성", entry.construction],
    ["파생", entry.derivative],
    ["합성어", entry.compound],
    ["반의어", entry.antonym],
    ["동의어", entry.synonym],
    ["이형", entry.variant],
    ["주석", entry.commentary],
    ["참고", entry.notes],
    ["산스크리트", entry.sanskrit],
  ];
  const meaning = entry.meaning1 || entry.meaning2;

  return (
    <article className="rounded-xl border bg-card p-4">
      <p>
        <span lang="pi" className="font-bold">
          {entry.lemma}
        </span>{" "}
        <span className="t-sub">{entry.pos}.</span>{" "}
        {entry.meaning1 ? (
          <strong className="font-bold">
            <Rich text={meaning} />
          </strong>
        ) : (
          <Rich text={meaning} />
        )}
        {entry.meaningLit && !entry.meaning2.includes("; lit.") ? (
          <span>; lit. {entry.meaningLit}</span>
        ) : null}
        {entry.constructionSummary ? (
          <span lang="pi" className="text-muted-foreground">
            {" "}
            [{entry.constructionSummary}]
          </span>
        ) : null}
      </p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2 flex items-center gap-1 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
        {open ? "접기" : "문법·용례 보기"}
      </button>

      {open ? (
        <div className="mt-3 flex flex-col gap-4">
          <table className="t-sub w-full">
            <tbody>
              {rows
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <tr key={label} className="border-t align-top first:border-t-0">
                    <th className="w-20 py-1.5 pr-3 text-left font-semibold whitespace-nowrap">
                      {label}
                    </th>
                    <td lang={label === "문법" ? undefined : "pi"} className="py-1.5 whitespace-pre-line">
                      <Rich text={value} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {entry.examples.map((ex, i) => (
            <blockquote key={i} className="border-l-2 border-line-strong pl-3">
              <p lang="pi" className="whitespace-pre-line">
                <Rich text={ex.text} />
              </p>
              <p className="t-meta mt-1">{ex.source}</p>
            </blockquote>
          ))}
          {entry.hasInflections ? <Inflections id={entry.id} /> : null}
        </div>
      ) : null}
    </article>
  );
}

function Inflections({ id }: { id: number }) {
  const [forms, setForms] = useState<string[] | "loading" | "error" | null>(null);
  if (forms === null) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          setForms("loading");
          fetchInflections(id).then(setForms, () => setForms("error"));
        }}
      >
        어형 변화 보기
      </Button>
    );
  }
  if (forms === "loading") return <Skeleton className="h-10 w-full" />;
  if (forms === "error") return <p className="t-sub">어형 변화를 불러오지 못했습니다.</p>;
  return (
    <div>
      <h4 className="t-sub mb-1 font-semibold">어형 변화 {forms.length}개</h4>
      <p lang="pi" className="t-sub">
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
