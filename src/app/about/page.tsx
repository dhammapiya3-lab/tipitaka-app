import type { Metadata } from "next";
import { TopLevelPage } from "@/components/layout/page-header";
import { EditionInfoDialog } from "@/components/about/edition-details";
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
          <CardTitle>판본</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full min-w-[480px] text-left">
            <thead className="bg-surface-2 text-[13px] font-semibold text-muted-foreground">
              <tr>
                <th className="px-5 py-3">판본</th>
                <th className="px-3 py-3 whitespace-nowrap">언어</th>
                <th className="px-3 py-3">실린 경</th>
                <th className="px-5 py-3 whitespace-nowrap">이용 조건</th>
              </tr>
            </thead>
            <tbody className="t-sub">
              {editions
                .filter((e) => e.language === "pli")
                .map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-5 py-3 font-semibold text-foreground">
                      <EditionInfoDialog
                        id={e.id}
                        title={e.source ?? e.label}
                        label={e.source ?? e.label}
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {e.sourceLanguage ?? LANGUAGE_LABELS[e.language]}
                    </td>
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
                    <td className="min-w-[6rem] px-5 py-3">
                      {e.license ?? LICENSE_UNKNOWN}
                    </td>
                  </tr>
                ))}
              <tr className="border-t">
                <td className="px-5 py-3 font-semibold text-foreground">
                  <EditionInfoDialog
                    title={
                      <>
                        자따까 새 복주석서 (
                        <span lang="pi">Jātaka-abhinavaṭīkā</span>)
                      </>
                    }
                    label={
                      <>
                        <span lang="pi">Jātaka-abhinavaṭīkā</span>
                        <br />
                        (자따까 새 복주석서)
                      </>
                    }
                  >
                    <div className="flex flex-col gap-3 text-[15px] leading-7 text-gray-600 dark:text-muted-foreground">
                      <p>
                        자따까의 &ldquo;복주석서&rdquo; 탭에는 VRI 공식 원문에
                        들어 있지 않은 자따까 새 복주석서를 따로 실었습니다.
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">
                          지은이와 때
                        </span>{" "}
                        — 미얀마 만달레이의 빤냐사미(
                        <span lang="pi">Paññāsāmī</span>) 스님이 미얀마력
                        1230년(서기 1868년)에 지은 복주석서입니다. 자따까
                        주석서(
                        <span lang="pi">Jātaka-aṭṭhakathā</span>)의 낱말과
                        구절을 풀이합니다.
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">
                          실은 범위
                        </span>{" "}
                        — 다섯 권(<span lang="pi">Jātaka-abhinavaṭīkā</span>
                        -1~5) 전체를 실었습니다. 자따까 547개 가운데 복주석서가
                        풀이한 519개에 붙어 있고, 나머지 28개는 복주석서가 따로
                        풀이하지 않은 자따까입니다. 책 머리말은 자따까 1번
                        복주석서의 &ldquo;앞 부분&rdquo;에 있습니다.
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">
                          자리를 정한 방법
                        </span>{" "}
                        — 복주석서 안의 자따까 제목(예:
                        &ldquo;1-apaṇṇakajātakavaṇṇanā (1)&rdquo;)에 적힌 번호로
                        자리를 찾았습니다. 번호가 잘못 적힌 한 곳(53번 자따까가
                        &ldquo;(43)&rdquo;으로 적힘)은 앞뒤 차례에 맞춰
                        바로잡았습니다.
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">
                          글에 대해
                        </span>{" "}
                        — 내용은 바꾸지 않고 표기만 다듬었습니다. 문장 끝의
                        &ldquo;..&rdquo;을 &ldquo;.&rdquo;로, &ldquo;l̤&rdquo;를
                        같은 글자인 &ldquo;ḷ&rdquo;로 바꾸었고, 내용 없이 번호만
                        남은 인쇄본 각주 번호를 지웠습니다.
                      </p>
                      <p>
                        <span className="font-semibold text-foreground">
                          출처와 이용 조건
                        </span>{" "}
                        — E-Piṭaka (github.com/dhammanana/epitaka_app), CC BY-NC
                        4.0 (비영리, 출처 표시)
                      </p>
                    </div>
                  </EditionInfoDialog>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">빠알리어</td>
                <td className="px-3 py-3">
                  JA 519개 (자따까 화면의 &ldquo;복주석서&rdquo; 탭)
                </td>
                <td className="px-5 py-3">
                  E-Piṭaka — CC BY-NC 4.0 (비영리, 출처 표시)
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card id="translators" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>저자·번역자</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <table className="w-full min-w-[560px] text-left">
            <thead className="bg-surface-2 text-[13px] font-semibold text-muted-foreground">
              <tr>
                <th className="px-5 py-3">저자·번역자</th>
                <th className="px-3 py-3 whitespace-nowrap">언어</th>
                <th className="px-3 py-3">번역</th>
                <th className="px-3 py-3">실린 경</th>
                <th className="px-5 py-3 whitespace-nowrap">이용 조건</th>
              </tr>
            </thead>
            <tbody className="t-sub">
              {editions
                .filter((e) => e.language !== "pli")
                .map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-5 py-3 font-semibold text-foreground">
                      <EditionInfoDialog
                        id={e.id}
                        title={e.source ?? e.label}
                        label={e.source ?? e.label}
                      />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {e.sourceLanguage ?? LANGUAGE_LABELS[e.language]}
                    </td>
                    <td className="px-3 py-3">
                      {e.translator ? (
                        <EditionInfoDialog
                          id={e.id}
                          title={e.source ?? e.label}
                          label={e.translator}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
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
                    <td className="min-w-[6rem] px-5 py-3">
                      {e.license ?? LICENSE_UNKNOWN}
                    </td>
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
            — 보디라사(Bodhirasa) 스님과 기여자들이 만드는 빠알리-영어
            사전입니다. 사전 자료, 문법 모듈, 화면 양식을 DPD에서 가져왔습니다.
            매달 고쳐지는 진행 중인 작업입니다. (사용한 판: v0.4.20261026, 이용
            조건 CC BY-NC-SA 4.0){" "}
            <a
              href="https://www.dpdict.net/"
              className="font-semibold text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              dpdict.net
            </a>
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
            — Pn Daza 스님이 만드신 Tipiṭaka App과 Tipiṭaka Abidan의 자료를
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
