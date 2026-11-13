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
            — 사전 자료, 문법 모듈, 화면 양식은 Ven. Bodhirasa 스님과 기여자들이
            만든{" "}
            <a
              href="https://www.dpdict.net/"
              className="font-semibold text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Digital Pāḷi Dictionary
            </a>
            에서 가져왔습니다. 이용 조건은 CC BY-NC-SA 4.0입니다. (사용한 판:
            v0.4.20261026)
          </p>
          <p>
            <span className="font-semibold text-foreground">
              K-PTS 빠알리–한국어 사전
            </span>{" "}
            — K-PTSdic. 한글빠알리사전, 원문 표기: 선운사대학원용 초역, 박경숙,
            편집: 빅쿠 재연, 환성, 성륜, 성각, 진일, 법이, 원경, 대산, 보적,
            무진, 원우. 이용 조건: 자비선사 초기불교승가대학원(법인 스님)의
            법보시 공유 허락을 받았습니다.
          </p>
          <p>
            <span className="font-semibold text-foreground">
              Pāḷi Text Society’s Pāḷi-English Dictionary (PTS PED)
            </span>{" "}
            — K.R. Norman, William Pruitt, Peter Jackson이 교정하여 The Pāḷi
            Text Society에서 펴낸 2015년 수정 재판을 바탕으로, Buddhadust가
            디지털로 옮긴 PTS 사전 자료를 가져와 다듬었습니다. (CC BY-NC 3.0)
          </p>
          <p>
            <span className="font-semibold text-foreground">
              Tipiṭaka Pāḷi-Myanmar (Abhidhān) 자료
            </span>{" "}
            — Ven. Pn Daza 스님이 만드신 Tipiṭaka App과 Tipiṭaka Abidan의 자료를
            가져와 다듬었습니다.
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
