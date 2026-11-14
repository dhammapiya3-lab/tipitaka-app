"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { formatCount, suttaHref } from "@/lib/format";

interface Found {
  by: "number" | "book" | "title";
  items: { id: string; title: string; label: string }[];
}

const HEADING: Record<Found["by"], string> = {
  number: "경 번호로 찾은 경",
  book: "이 책의 경",
  title: "제목으로 찾은 경",
};
const FIRST = 8;

/** 경 번호(DN 22)·책 이름(법구경)·경 제목(대념처경)으로 찾은 경 — 본문 검색 결과 위에 */
export function NumberMatches({
  found,
  query,
}: {
  found: Found;
  query: string;
}) {
  const [all, setAll] = useState<string | null>(null);
  const open = all === query;
  const items = open ? found.items : found.items.slice(0, FIRST);
  return (
    <Card className="gap-0 p-0">
      <p className="border-b px-5 py-3 text-sm font-bold">
        {HEADING[found.by]}{" "}
        <span className="font-medium text-muted-foreground">
          {formatCount(found.items.length)}개
        </span>
      </p>
      <ul className="flex flex-col">
        {items.map((s) => (
          <li key={s.id}>
            <Link
              href={suttaHref(s.id)}
              className="flex items-center gap-3 border-b px-5 py-2.5 last:border-b-0 hover:bg-hover"
            >
              <span className="w-24 shrink-0 text-sm font-bold text-primary">
                {s.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{s.title}</span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
      {found.items.length > FIRST ? (
        <button
          type="button"
          onClick={() => setAll(open ? null : query)}
          className="px-5 py-2.5 text-left text-sm font-bold text-primary hover:bg-hover"
        >
          {open
            ? "접기"
            : `그 밖에 ${formatCount(found.items.length - FIRST)}개 모두 보기`}
        </button>
      ) : null}
    </Card>
  );
}

/** 경 번호 약어 — [약어, 책 이름, 다른 이름, 예] */
const ABBREVIATIONS: [string, string, string, string][] = [
  ["DN", "디가 니까야", "장부(長部) · 긴 경 모음", "DN 22"],
  ["MN", "맛지마 니까야", "중부(中部) · 중간 길이 경 모음", "MN 10"],
  ["SN", "상윳따 니까야", "상응부(相應部) · 주제별 경 모음", "SN 56.11"],
  ["AN", "앙굿따라 니까야", "증지부(增支部) · 숫자별 경 모음", "AN 3.65"],
  ["Kp", "쿳다까빠타", "소송경(小誦經)", "Kp 9"],
  ["Dhp", "담마빠다", "법구경(法句經)", "Dhp 183"],
  ["Ud", "우다나", "감흥어 · 자설경", "Ud 1.10"],
  ["Iti", "이띠웃따까", "여시어경(如是語經)", "Iti 27"],
  ["Snp", "숫따니빠따", "경집(經集)", "Snp 1.8"],
  ["Vv", "위마나왓투", "천궁사(天宮事)", "Vv 1"],
  ["Pv", "뻬따왓투", "아귀사(餓鬼事)", "Pv 5"],
  ["Thag", "테라가타", "장로게(長老偈)", "Thag 1.1"],
  ["Thig", "테리가타", "장로니게(長老尼偈)", "Thig 1.1"],
  ["Tha-ap", "테라 아빠다나", "장로 비유경", "Tha-ap 1"],
  ["Thi-ap", "테리 아빠다나", "장로니 비유경", "Thi-ap 1"],
  ["Bv", "붓다왕사", "불종성경(佛種姓經)", "Bv 1"],
  ["Cp", "짜리야삐따까", "소행장(所行藏)", "Cp 1"],
  ["Ja", "자따까", "본생경(本生經)", "Ja 547"],
  ["Mnd", "마하닛데사", "대의석(大義釋)", "Mnd 1"],
  ["Cnd", "쭐라닛데사", "소의석(小義釋)", "Cnd 1"],
  ["Ps", "빠띠삼비다막가", "무애해도(無礙解道)", "Ps 1.1"],
  ["Ne", "넷띠빠까라나", "넷띠 · 경 해석 지침서", "Ne 1"],
  ["Pe", "뻬따꼬빠데사", "경 해석 지침서", "Pe 1"],
  ["Mil", "밀린다빤하", "밀린다왕문경", "Mil 1"],
  ["Vism", "위숫디막가", "청정도론", "Vism 1 (1장)"],
];

/** 검색 화면 — 찾는 법 예시와 니까야·책 약어 설명 */
export function AbbreviationGuide({
  onPick,
}: {
  onPick: (example: string) => void;
}) {
  const examples = [
    ["본문의 말", "마음챙김"],
    ["빠알리 낱말", "satipatthana"],
    ["경 번호", "DN 22"],
    ["경 번호", "상윳따 56.11"],
    ["게송 번호", "법구경 183"],
    ["경 제목", "대념처경"],
    ["책 이름", "숫따니빠따"],
  ];
  return (
    <Card className="gap-4 p-5">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold">이렇게 찾을 수 있습니다</h2>
        <div className="flex flex-wrap gap-2">
          {examples.map(([what, ex]) => (
            <button
              key={ex}
              type="button"
              onClick={() => onPick(ex)}
              className="rounded-full border bg-card px-3 py-1 text-sm hover:border-amber-300 hover:bg-amber-50"
            >
              <span className="text-muted-foreground">{what}</span>{" "}
              <b className="text-primary">{ex}</b>
            </button>
          ))}
        </div>
        <p className="t-sub text-sm">
          경 번호는 약어(DN, SN …)나 책 이름(디가, 상윳따, 법구경 …) 뒤에 번호를
          씁니다. 띄어 써도, 붙여 써도 됩니다 (DN22 · DN 22 · 디가 22). 책
          이름만 넣으면 그 책의 경이 모두 나오고, 제목은 담마파다·밀린다팡하처럼
          표기가 조금 달라도 찾습니다.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold">니까야·책 약어</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-3">약어</th>
                <th className="py-1.5 pr-3">책</th>
                <th className="py-1.5 pr-3">다른 이름</th>
                <th className="py-1.5">예</th>
              </tr>
            </thead>
            <tbody className="t-sub">
              {ABBREVIATIONS.map(([abbr, name, other, ex], i) => (
                <tr key={abbr} className="border-t">
                  <td className="py-1.5 pr-3 font-bold text-foreground">
                    {abbr}
                  </td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {name}
                    {i === 4 ? (
                      <span className="block text-xs text-faint">
                        여기부터 쿳다까 니까야(소부)
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3">{other}</td>
                  <td className="py-1.5">
                    <button
                      type="button"
                      onClick={() => onPick(ex)}
                      className="font-medium whitespace-nowrap text-primary hover:underline"
                    >
                      {ex}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Card>
  );
}
