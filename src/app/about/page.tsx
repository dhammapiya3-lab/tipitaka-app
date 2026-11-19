import type { Metadata } from "next";
import { TopLevelPage } from "@/components/layout/page-header";
import { EditionInfoDialog } from "@/components/about/edition-details";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LANGUAGE_LABELS, LICENSE_UNKNOWN } from "@/lib/constants";
import { allSuttas, editions, peuVersion, sinhalaVersion } from "@/lib/data";
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
                <th className="min-w-[17rem] px-5 py-3">저자·번역자</th>
                <th className="px-3 py-3 whitespace-nowrap">언어</th>
                <th className="px-3 py-3">실린 경</th>
                <th className="px-5 py-3 whitespace-nowrap">이용 조건</th>
              </tr>
            </thead>
            <tbody className="t-sub">
              {editions
                .filter((e) => e.language !== "pli")
                .map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="min-w-[17rem] px-5 py-3 font-semibold text-foreground">
                      {/* 저자와 번역자가 다르면 "저자 · 번역자" (예: 한국마하시 사야도 · 담마간다 스님) */}
                      <EditionInfoDialog
                        id={e.id}
                        title={e.source ?? e.label}
                        label={
                          e.source && e.translator && e.translator !== e.source
                            ? `${e.source} · ${e.translator}`
                            : (e.source ?? e.label)
                        }
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
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card id="dictionaries" className="scroll-mt-20">
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
            무진, 원우. 사용 허락: 자비선사 초기불교승가대학원(법인 스님)의
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
              A Dictionary of Pāli (Cone)
            </span>{" "}
            — Margaret Cone 지음, Pali Text Society 펴냄. 제1권(a–kh, 2001),
            제2권(g–n), 제3권(p–bh, 2020)까지 나온 부분입니다. Pali Text
            Society가 2024년 3월부터 gandhari.org(gandhari.org/dop)에서 누구나
            무료로 찾아보고 쓸 수 있게 공개했고, 이 사이트는 Digital Pāḷi
            Dictionary가 배포한 디지털판을 가져왔습니다. 저작권: © Pali Text
            Society. 이용 조건: PTS는 &ldquo;누구나 무료로 찾아보고 쓸 수
            있다&rdquo;고 밝혔으며, 별도의 공개 라이선스(CC 등)는 밝히지
            않았습니다.
          </p>
          <p>
            <span className="font-semibold text-foreground">
              Pali English Abhidhan (PEA)
            </span>{" "}
            — 예전 이름 Pali English Ultimate(PEU). 27권이 넘는 『Pāḷi Myanmar
            Abhidhān』을 영어로 옮기며 크게 줄인 사전으로,{" "}
            <a
              href="https://apps.microsoft.com/detail/9mth9td82tgr?hl=ko-KR&gl=KR"
              className="font-semibold text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Tipitaka Pali Reader (TPR)
            </a>
            를 위해 만들어졌습니다. 번역 작업은 pm12e 프로젝트
            (pm12e.pali.tools)에서 했고, 약 80%는 사람이, 나머지는 기계가
            번역했습니다. 이용 조건: 오픈 소스이며, 출처를 밝히면 자유롭게 쓸 수
            있습니다(Bhante Subhuti 스님 답장). (사용한 판: pm12e 자료{" "}
            {peuVersion}, 매달 새 자료를 확인합니다)
          </p>
          <p>
            TPR은 빠알리 삼장을 읽으며 여러 사전을 바로 찾아볼 수 있는 무료
            앱입니다. Windows·Mac·Linux·iOS·Android에서 쓸 수 있습니다.
          </p>
          <p>
            <span className="font-semibold text-foreground">
              빠알리-싱할라 사전 (Buddhadatta · Sumaṅgala)
            </span>{" "}
            — Path Nirvana Foundation이 정리해 GitHub
            (github.com/pnfo/pali-sinhala-dictionary)에 공개한 두 사전입니다.
            Buddhadatta 사전 약 1만 9천 항목, Sumaṅgala 사전 약 2만 3천
            항목이며, 뜻풀이는 싱할라어입니다. 싱할라 글자 표제어를 로마자로 옮겨
            찾게 했고, 뜻풀이 첫 줄에 원래 표제어(와 원서 쪽)를 그대로 둡니다.
            사용 허락: Path Nirvana Foundation이 사용을 허락하며, 계속 오류를
            고치고 있으니 저장소의 최신 자료를 쓰도록 요청했습니다(2026-11). 그래서
            매달 저장소의 새 자료를 확인합니다. 저장소에는 따로 라이선스 파일이
            없습니다. (사용한 판: {sinhalaVersion})
          </p>
          <p>
            <span className="font-semibold text-foreground">
              Tipiṭaka Pāḷi-Myanmar Abhidhān
            </span>{" "}
            — 『တိပိဋက ပါဠိ-မြန်မာ အဘိဓာန်』. 삼장의 빠알리어를 미얀마어로 풀이한
            사전입니다.
          </p>
          <p>
            <span className="text-foreground">기획·출판:</span> 1950년대에
            편찬을 시작했습니다. 제1권은 1964년 버마 연방 불교교단
            평의회(Union of Burma Buddha Sāsana Council)가 펴냈고, 그 뒤의
            권들은 미얀마 종교부 교법 진흥·포교국(Department for the Promotion
            and Propagation of the Sāsana)이 펴냈습니다.
          </p>
          <p>
            <span className="text-foreground">편찬:</span> 학승 다섯 팀이
            알파벳을 나누어 맡았고, 만달레이 마소예인(Masoeyein) 사원이 5·6권과
            15·16권을 썼습니다. 우 실라난다(U Sīlānanda, 1927–2005) 스님이 편찬
            책임자(chief compiler)로 소개됩니다.
          </p>
          <p>
            <span className="text-foreground">진행:</span> 2023년에 편찬을
            마쳤습니다. a부터 ḷa까지 25권(29책), 표제어는 약 21만 5천 개입니다.
          </p>
          <p>
            <span className="text-foreground">이 사이트의 자료:</span> Pn Daza
            스님이 만드신 Tipiṭaka App과 Tipiṭaka Abidan의 자료(Pn Daza 스님께
            받은 2026-02-06 판)를 가져와 다듬었습니다. 디지털로 옮기는 작업이
            아직 끝나지 않아, 낱말 약 18만 개 가운데 약 2만 8천 개는 뜻풀이 대신
            &ldquo;원본 사전을 보라&rdquo;는 안내만 있습니다. 사전 데이터를
            사용하고자 하는 분은 Pn Daza 스님께 허락을 받아 사용하시기
            바랍니다(mrpndaza@gmail.com).
          </p>
          <p>
            <span className="text-foreground">함께 볼 곳:</span>{" "}
            <a
              href="https://abhidhana.buddha-dhamma.net/"
              className="font-semibold text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Tipiṭaka Pāḷi-Myanmā Abhidhāna (abhidhana.buddha-dhamma.net)
            </a>{" "}
            — 스페인 불교학 연구소(IEBH)가 25권 전체를 글자 인식(OCR)으로
            디지털화한 사이트입니다. 낱말마다 권·쪽과 인쇄본 쪽 그림을 함께
            보여 주고, 영어·스페인어 뜻풀이는 아직 검토하지 않은 AI
            번역입니다. 이 사이트의 사전 자료로 쓰지는 않았습니다.
          </p>
          <p>
            <span className="font-semibold text-foreground">
              미얀마어 위키낱말사전 (my.wiktionary.org)
            </span>{" "}
            — 미얀마어 사전의 뜻풀이처럼 미얀마어로 된 글에서 낱말을 누르면
            나오는 미얀마어 뜻과 영어 뜻입니다. 위키미디어 덤프(2026-11-01)에서
            미얀마어 낱말 약 2만 1천 개를 가져왔습니다. 미얀마어는 띄어쓰기가 거의
            없어서 사전에 있는 가장 긴 낱말부터 맞춰 낱말을 나누므로, 미얀마
            글자로 적은 빠알리어 낱말이 엉뚱하게 나뉠 수 있습니다. 이용 조건: CC
            BY-SA 4.0 (출처를 밝히고 같은 조건으로 공유).
          </p>
          <p>
            <span className="font-semibold text-foreground">
              우 호크 세인 『미얀마어-영어-빠알리어 사전』 (U Hoke Sein, The
              Universal Burmese-English-Pali Dictionary)
            </span>{" "}
            — 우 호크 세인(ဦးဟုတ်စိန်, 1890–1984)이 펴낸 미얀마어 낱말의 영어 뜻과
            빠알리어 대응어 사전입니다. 미얀마어 글에서 낱말을 누르면 위키낱말사전과
            함께 나옵니다. 자료: Pn Daza 스님의 MEP Dictionary 앱 저장소
            (github.com/pndaza/mep_dictionary, 2026-05-30판, 71,427항목). 그
            저장소에 따르면 자료는 붓다쩨따만(ဗုဒ္ဓစေတမန်)이 낸 iOS 앱에서 가져왔고,
            원서 약 300쪽은 아직 입력되지 않았습니다. 저장소에는 라이선스가 적혀
            있지 않습니다. 같은 자료를 정리한 Hugging Face 공개본
            (huggingface.co/datasets/freococo/myanmar-english-pali-dictionary)은
            &ldquo;연구와 교육 목적으로만 공유&rdquo;하며 &ldquo;상업적 이용은
            권리자의 추가 허락이 필요할 수 있다&rdquo;고 밝히고 있습니다.
          </p>
        </CardContent>
      </Card>

      <Card id="sources" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>저작권</CardTitle>
        </CardHeader>
        <CardContent className="t-sub flex flex-col gap-2">
          <p>
            각 번역의 저작권은 번역자에게 있습니다. 이용 조건은 확인되는 대로 위
            표에 적습니다.
          </p>
          <p>
            본 사이트(앱)에 올라와 있는 번역들은 모두 법보시 자료이며 이용
            조건을 준수하는 한에서 복사, 배포가 가능합니다.
          </p>
          <p>
            단, 출판사에 계약되어 있으며 양해를 얻어 게시하는 번역(법현 스님 번역본)은
            이 사이트(앱)에서 복사하지 못하도록 했습니다.
          </p>
        </CardContent>
      </Card>

      <Card id="settings" className="scroll-mt-20">
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
