"use client";

import { BookA, History, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DictionaryPicker, WordLookupResult } from "@/components/dictionary/word-lookup";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRecentStore } from "@/store/recent";

/** 사전 화면 — 찾은 단어는 주소(?q=)에 남아 그대로 공유할 수 있다. */
export function DictionaryView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searched = params.get("q")?.trim() ?? "";
  const [query, setQuery] = useState(searched);

  function search(word: string) {
    const q = word.trim();
    setQuery(q);
    router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
  }

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
      >
        <div className="relative flex-1">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            lang="pi"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="빠알리어 단어 (예: satipatthana, bhikkhave)"
            aria-label="찾을 단어"
            className="h-10 pl-9"
          />
        </div>
        <Button type="submit" className="h-10">
          찾기
        </Button>
      </form>
      <DictionaryPicker />
      <RecentWords onSearch={search} />
      {searched ? (
        <WordLookupResult word={searched} onSearch={search} />
      ) : (
        <EmptyState
          icon={BookA}
          title="검색할 빠알리어 단어를 넣으세요"
          description="어미가 바뀐 형태도 찾습니다. 빠알리 자판이 없으면 ā·ṭ·ṃ 대신 a·t·m 으로 쳐도 됩니다."
        />
      )}
    </div>
  );
}

/** 최근 찾은 단어 — 누르면 다시 찾는다. 이 기기에만 저장된다. */
function RecentWords({ onSearch }: { onSearch: (word: string) => void }) {
  const words = useRecentStore((s) => s.words);
  const clear = useRecentStore((s) => s.clear);
  if (words.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="최근 찾은 단어">
      <History className="size-4 text-muted-foreground" aria-hidden />
      {words.slice(0, 15).map((w) => (
        <button
          key={w}
          type="button"
          lang="pi"
          onClick={() => onSearch(w)}
          className="rounded-md bg-muted px-2 py-0.5 text-sm font-medium text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          {w}
        </button>
      ))}
      <Button variant="ghost" size="xs" onClick={clear}>
        기록 지우기
      </Button>
    </div>
  );
}
