import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Bookmark {
  suttaId: string;
  /** 문장 번호 (dn22:1.2) */
  key: string;
  suttaTitle: string;
  /** 저장할 때 보이던 문장 (번역이 있으면 번역, 없으면 원문) */
  snippet: string;
  /** 저장한 때 (ISO 문자열) */
  savedAt: string;
  /** 문장에 남긴 메모 (없으면 빈 문자열이나 undefined) */
  memo?: string;
}

type BookmarkBase = Omit<Bookmark, "savedAt" | "memo">;

interface BookmarksState {
  items: Bookmark[];
  toggle: (bookmark: BookmarkBase) => void;
  remove: (suttaId: string, key: string) => void;
  /** 메모 남기기 — 북마크가 없던 문장이면 북마크도 함께 만든다. 빈 메모는 메모만 지운다. */
  setMemo: (bookmark: BookmarkBase, memo: string) => void;
  /** 내보낸 파일에서 가져오기 — 같은 문장은 가져온 쪽으로 바꾸고, 없던 것은 더한다. 더한 수를 돌려준다. */
  importItems: (items: Bookmark[]) => number;
}

const same = (a: { suttaId: string; key: string }, b: { suttaId: string; key: string }) =>
  a.suttaId === b.suttaId && a.key === b.key;

/**
 * 북마크·메모 — 이 기기에만 저장한다(localStorage). 다른 기기로는 북마크 화면에서
 * 파일로 내보내고 가져와 옮긴다. 저장값은 화면이 뜬 뒤 불러온다(SettingsHydrator).
 */
export const useBookmarksStore = create<BookmarksState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (bookmark) =>
        set(({ items }) =>
          items.some((b) => same(b, bookmark))
            ? { items: items.filter((b) => !same(b, bookmark)) }
            : { items: [{ ...bookmark, savedAt: new Date().toISOString() }, ...items] },
        ),
      remove: (suttaId, key) =>
        set(({ items }) => ({ items: items.filter((b) => !same(b, { suttaId, key })) })),
      setMemo: (bookmark, memo) =>
        set(({ items }) => {
          const text = memo.trim();
          if (items.some((b) => same(b, bookmark))) {
            return { items: items.map((b) => (same(b, bookmark) ? { ...b, memo: text } : b)) };
          }
          if (!text) return { items };
          return { items: [{ ...bookmark, memo: text, savedAt: new Date().toISOString() }, ...items] };
        }),
      importItems: (incoming) => {
        const before = get().items;
        const added = incoming.filter((n) => !before.some((b) => same(b, n))).length;
        const merged = [
          ...incoming,
          ...before.filter((b) => !incoming.some((n) => same(n, b))),
        ].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
        set({ items: merged });
        return added;
      },
    }),
    {
      name: "bookmarks",
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
      partialize: ({ items }) => ({ items }),
    },
  ),
);
