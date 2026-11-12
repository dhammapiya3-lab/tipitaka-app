import type { Metadata } from "next";
import { Suspense } from "react";
import { SuttaReader } from "@/components/sutta/sutta-reader";
import { editions } from "@/lib/data";

export const metadata: Metadata = { title: "경 읽기" };

/**
 * 경 읽기 — 페이지 하나가 주소의 ?id= 를 보고 그 경을 그린다.
 * 경마다 페이지를 미리 만들면 파일이 너무 많아(경 5천여 개 × 5) 호스팅 한도를 넘기 때문이다.
 * 경 목록은 public/data/sutta-index.json 을 한 번 받아 쓴다.
 */
export default function SuttaPage() {
  return (
    <Suspense>
      <SuttaReader editions={editions} />
    </Suspense>
  );
}
