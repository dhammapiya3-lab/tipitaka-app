"use client";

import { Copy, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PALI_EDITION } from "@/lib/constants";
import { analyzeParts, fetchSuttaText, lookupWord, type PartAnalysis } from "@/lib/content";
import { plainText } from "@/lib/segments";
import { normalizeWord, splitWords } from "@/lib/pali";
import { cn } from "@/lib/utils";

/** 단어장 한 줄 — 본문 낱말, 나눔(있으면), 조각마다 DPD 표제어·뜻·어미 문법 */
interface GlossRow {
  word: string;
  parts: PartAnalysis[];
  /** 연음으로 붙은 낱말을 나눈 것이면 true */
  split: boolean;
}

/** 한 줄의 뜻 요약 (Anki 뒷면·복사용) */
function summary(row: GlossRow): string {
  return row.parts
    .map(({ part, entries }) => {
      const e = entries[0];
      if (!e) return `${part}: ?`;
      const meaning = (e.entry.meaning1 || e.entry.meaning2).replace(/<[^>]+>/g, "");
      const grammar = [...new Set(e.grammar)].join(", ");
      return `${row.split ? `${part} = ` : ""}${e.entry.lemma} (${e.entry.pos}${grammar ? `; ${grammar}` : ""}) ${meaning}`;
    })
    .join(" + ");
}

/** 낱말 하나 풀기 — 사전에 그 어형이 있으면 그 표제어들, 없으면 낱말 나누기(Splitter)의 첫 나눔으로 */
async function glossWord(word: string): Promise<GlossRow> {
  const own = await analyzeParts([word]);
  const exact = own[0]?.entries.filter((e) => e.grammar.length > 0 || normalizeWord(e.entry.lemma.replace(/\s+\d.*$/, "")) === word);
  if (exact?.length) return { word, parts: [{ part: word, entries: exact }], split: false };
  const looked = await lookupWord(word, ["dpd"]);
  const way = looked.split.ways[0];
  if (way && way.length > 1) return { word, parts: await analyzeParts(way), split: true };
  return { word, parts: own, split: false };
}

/**
 * 단어장(Gloss) — 문단 하나의 빠알리 낱말을 모두 뽑아 DPD 뜻을 붙인 목록.
 * 예습·번역 참고표로 보고, 복사하거나 Anki(낱말 카드 암기 앱) 파일로 내려받는다. Simsapa 의 Gloss 와 같은 쓰임.
 */
export function GlossDialog({
  open,
  title,
  pali: givenPali,
  suttaId,
  keys,
  onClose,
  onWord,
}: {
  open: boolean;
  /** 예: 전법륜경 2 */
  title: string;
  /** 문단의 빠알리 글 (화면에 빠알리 판본이 없으면 빈 글 — 그때는 suttaId·keys 로 원문을 받아 온다) */
  pali: string;
  suttaId: string;
  /** 문단의 문장 번호들 */
  keys: string[];
  onClose: () => void;
  /** 낱말을 누르면 사전 (선택) */
  onWord?: (word: string) => void;
}) {
  // 화면에 빠알리 판본이 없으면 원문(마하상기띠본)을 받아 온다
  const [fetched, setFetched] = useState<string | null>(null);
  useEffect(() => {
    if (givenPali || !open) return;
    let cancelled = false;
    fetchSuttaText(suttaId, PALI_EDITION).then(
      (t) =>
        !cancelled &&
        setFetched(
          t.segments
            .filter((s) => keys.includes(s.key))
            .map((s) => plainText(s.parts))
            .join("\n"),
        ),
      () => !cancelled && setFetched(""),
    );
    return () => {
      cancelled = true;
    };
  }, [givenPali, open, suttaId, keys]);
  const pali = givenPali || fetched || "";
  // 나온 차례대로, 같은 낱말은 한 번만
  const words = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const piece of splitWords(pali)) {
      if (!piece.word) continue;
      const w = normalizeWord(piece.text);
      if (w.length < 2 || seen.has(w)) continue;
      seen.add(w);
      out.push(w);
    }
    return out;
  }, [pali]);
  const [rows, setRows] = useState<Record<string, GlossRow | "error">>({});
  const [skip, setSkip] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // 한꺼번에 너무 많이 받지 않게 여섯 개씩
    (async () => {
      for (let i = 0; i < words.length; i += 6) {
        const batch = words.slice(i, i + 6);
        const done = await Promise.all(batch.map((w) => glossWord(w).catch(() => "error" as const)));
        if (cancelled) return;
        setRows((r) => ({ ...r, ...Object.fromEntries(batch.map((w, k) => [w, done[k]])) }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, words]);

  const ready = words.filter((w) => rows[w] && rows[w] !== "error");
  const chosen = ready.filter((w) => !skip.has(w)).map((w) => rows[w] as GlossRow);
  const tsv = chosen.map((r) => `${r.word}\t${summary(r)}`).join("\n");

  const download = () => {
    // Anki 가져오기: 탭으로 나눈 글 (앞면 = 빠알리 낱말, 뒷면 = 뜻)
    const body = `#separator:tab\n#html:false\n#tags:${title.replace(/\s+/g, "_")}\n${tsv}\n`;
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `단어장-${title.replace(/[\\/:*?"<>|\s]+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`낱말 ${chosen.length}개를 Anki 파일로 내려받았습니다.`);
  };
  const copy = () =>
    navigator.clipboard.writeText(tsv).then(
      () => toast.success(`낱말 ${chosen.length}개를 복사했습니다. 엑셀·구글 시트에 붙여 넣으면 표가 됩니다.`),
      () => toast.error("복사하지 못했습니다."),
    );

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>단어장 — {title}</DialogTitle>
          <DialogDescription>
            이 문단의 빠알리 낱말 {words.length}개와 DPD 뜻이에요. 예습·번역 참고표로 보거나, 복사하거나, Anki(낱말 카드 암기 앱)
            파일로 내려받을 수 있어요. 빼고 싶은 낱말은 왼쪽 칸을 끄세요.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs text-muted-foreground dark:bg-muted">
              <tr>
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2">낱말</th>
                <th className="px-2 py-2">기본형 · 뜻 (DPD)</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w) => {
                const row = rows[w];
                return (
                  <tr key={w} className={cn("border-t align-top", skip.has(w) && "opacity-40")}>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        aria-label={`${w} 넣기`}
                        checked={!skip.has(w)}
                        onChange={() =>
                          setSkip((s) => {
                            const n = new Set(s);
                            if (n.has(w)) n.delete(w);
                            else n.add(w);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td lang="pi" className="px-2 py-2 font-pali font-semibold whitespace-nowrap">
                      {onWord ? (
                        <button type="button" className="text-primary hover:underline" onClick={() => onWord(w)}>
                          {w}
                        </button>
                      ) : (
                        w
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {row === undefined ? (
                        <Skeleton className="h-4 w-2/3" />
                      ) : row === "error" ? (
                        <span className="text-faint">불러오지 못했습니다</span>
                      ) : row.parts.every((p) => p.entries.length === 0) ? (
                        <span className="text-faint">DPD 에 없는 낱말</span>
                      ) : (
                        <ul className="flex flex-col gap-0.5">
                          {row.split ? (
                            <li lang="pi" className="font-pali text-xs text-muted-foreground">
                              {row.parts.map((p) => p.part).join(" + ")}
                            </li>
                          ) : null}
                          {row.parts.map(({ part, entries }, i) =>
                            entries.slice(0, row.split ? 1 : 2).map(({ entry, grammar }) => (
                              <li key={`${i}-${entry.id}`}>
                                <span lang="pi" className="font-pali font-semibold">
                                  {entry.lemma}
                                </span>{" "}
                                <span className="text-xs text-muted-foreground">{entry.pos}.</span>{" "}
                                {(entry.meaning1 || entry.meaning2).replace(/<[^>]+>/g, "")}
                                {grammar.length ? (
                                  <span className="ml-1 rounded bg-brand-soft px-1 text-xs text-primary">
                                    {[...new Set(grammar)].join(" · ")}
                                  </span>
                                ) : null}
                                {row.split ? <span className="ml-1 text-xs text-faint">← {part}</span> : null}
                              </li>
                            )),
                          )}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-faint">
            {ready.length < words.length ? `뜻 찾는 중… ${ready.length}/${words.length}` : `낱말 ${chosen.length}개 고름`} · 뜻: Digital Pāḷi
            Dictionary (CC BY-NC-SA)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copy} disabled={!chosen.length}>
              <Copy aria-hidden /> 표 복사
            </Button>
            <Button size="sm" onClick={download} disabled={!chosen.length}>
              <Download aria-hidden /> Anki 파일로 내려받기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
