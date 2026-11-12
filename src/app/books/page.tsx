import { BookText } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "서적" };

export default function BooksPage() {
  return (
    <ComingSoon
      title="서적"
      description="테라와다불교 법보시 도서"
      icon={BookText}
      note="법보시 도서를 쪽 단위로 읽을 수 있게 올릴 예정입니다. 영어·미얀마어 원문이 있는 책은 원문과 한 줄씩 대조해 읽을 수 있습니다."
    />
  );
}
