import type { Metadata } from "next";
import { TopLevelPage } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LANGUAGE_LABELS, LICENSE_UNKNOWN } from "@/lib/constants";
import { allSuttas, editions } from "@/lib/data";
import { suttaLabel } from "@/lib/format";

export const metadata: Metadata = { title: "정보" };

/** 경 번호 목록을 짧게: 같은 책이 셋 이상이면 "DHP 26개" 처럼 묶는다 */
function summarize(ids: string[], prefix = ""): string {
  if (ids.length === 0) return "";
  const byBook = new Map<string, string[]>();
  for (const id of ids) {
    const book = id.match(/^[a-z-]+/)?.[0] ?? id;
    byBook.set(book, [...(byBook.get(book) ?? []), id]);
  }
  const text = [...byBook]
    .map(([book, list]) =>
      list.length > 2
        ? `${book.toUpperCase()} ${list.length}개`
        : list.map(suttaLabel).join(", "),
    )
    .join(", ");
  return prefix ? `${prefix} ${text}` : text;
}

export default function AboutPage() {
  return (
    <TopLevelPage title="정보">
      <Card id="editions" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>판본 정보</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-surface-2 text-[13px] font-semibold text-muted-foreground">
              <tr>
                <th className="px-5 py-3">판본</th>
                <th className="px-3 py-3">언어</th>
                <th className="px-3 py-3">번역</th>
                <th className="px-3 py-3">실린 경</th>
                <th className="px-5 py-3">이용 조건</th>
              </tr>
            </thead>
            <tbody className="t-sub">
              {editions.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-5 py-3 font-semibold text-foreground">
                    {e.label}
                  </td>
                  <td className="px-3 py-3">{LANGUAGE_LABELS[e.language]}</td>
                  <td className="px-3 py-3">{e.translator ?? "—"}</td>
                  <td className="px-3 py-3">
                    {[
                      summarize(
                        allSuttas
                          .filter((s) => s.editions.includes(e.id))
                          .map((s) => s.id),
                      ),
                      summarize(
                        allSuttas
                          .filter((s) => s.nissaya.includes(e.id))
                          .map((s) => s.id),
                        "대역",
                      ),
                      summarize(
                        allSuttas
                          .filter((s) => s.grammar.includes(e.id))
                          .map((s) => s.id),
                        "문법분석",
                      ),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </td>
                  <td className="px-5 py-3">{e.license ?? LICENSE_UNKNOWN}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>사전</CardTitle>
        </CardHeader>
        <CardContent className="t-sub flex flex-col gap-2">
          <p>
            <span lang="pi" className="font-semibold text-foreground">
              Digital Pāḷi Dictionary (DPD)
            </span>{" "}
            — DPD dictionary data, grammatical modules, and styles obtained from{" "}
            <a
              href="https://www.dpdict.net/"
              className="font-semibold text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Digital Pāḷi Dictionary
            </a>{" "}
            by Ven. Bodhirasa and contributors, licensed under CC BY-NC-SA 4.0.
            (사용한 판: v0.4.20261026)
          </p>
          <p>
            <span className="font-semibold text-foreground">
              K-PTS 빠알리–한국어 사전
            </span>{" "}
            — K-PTSdic. 한글빠알리사전, 원문 표기: 선운사대학원용 초역, 박경숙
            (원래 앱의 자료). 이용 조건 {LICENSE_UNKNOWN}.
          </p>
          <p>
            <span className="font-semibold text-foreground">
              Pāḷi Text Society&apos;s Pāḷi-English Dictionary (PTS PED)
            </span>{" "}
            — Digitized PTS dictionary data adapted from Buddhadust, based on
            the corrected 2015 reprint by K.R. Norman, William Pruitt, and Peter
            Jackson, published by The Pāḷi Text Society (CC BY-NC 3.0).
          </p>
          <p>
            <span className="font-semibold text-foreground">
              Tipiṭaka Pāḷi-Myanmar (Abhidhān) Data
            </span>{" "}
            — Adapted from Tipiṭaka App &amp; Tipiṭaka Abidan developed by Ven.
            Pn Daza.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>출처</CardTitle>
        </CardHeader>
        <CardContent className="t-sub flex flex-col gap-2">
          <p>
            경전 목록과 판본 자료는{" "}
            <a
              href="https://theravada-application.vercel.app/"
              className="font-semibold text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Theravāda Tipiṭaka 앱
            </a>
            의 자료를 바탕으로 합니다.
          </p>
          <p>
            각 번역의 저작권은 번역자에게 있습니다. 이용 조건은 확인되는 대로 위
            표에 적습니다.
          </p>
          <p>
            원래 앱에서 복사를 막은 번역(법현 스님)은 이 앱에서도 글자를 선택할
            수 없게 했습니다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>읽기 설정</CardTitle>
        </CardHeader>
        <CardContent className="t-sub">
          고른 판본과 글자 크기·줄 간격은 이 기기의 브라우저에만 저장됩니다.
          다른 기기와는 공유되지 않습니다.
        </CardContent>
      </Card>
    </TopLevelPage>
  );
}
