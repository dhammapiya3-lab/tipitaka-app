import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * 다 읽은 경 — 경 번호(suttaId) → 다 읽음으로 표시한 때 (ISO 문자열).
 * 사용자가 직접 눌러서만 표시·해제한다(자동으로 표시하지 않는다).
 *
 * 경 번호에 붙여 저장하므로, 나중에 경 번호 체계를 바꾸면(예: VRI 번호) 옛 번호 → 새 번호
 * 대응표로 이 기록도 함께 옮겨야 한다.
 */
export type ReadRecord = Record<string, string>;

interface ReadState {
  items: ReadRecord;
  /** 다 읽음 표시 ↔ 해제 */
  toggle: (suttaId: string) => void;
  /** 내보낸 파일에서 가져오기 — 이 기기에 없던 경만 더한다. 더한 수를 돌려준다. */
  importItems: (items: ReadRecord) => number;
}

/** 이 기기에만 저장한다(localStorage). 저장값은 화면이 뜬 뒤 불러온다(SettingsHydrator). */
export const useReadStore = create<ReadState>()(
  persist(
    (set, get) => ({
      items: {},
      toggle: (suttaId) =>
        set(({ items }) => {
          const next = { ...items };
          if (next[suttaId]) delete next[suttaId];
          else next[suttaId] = new Date().toISOString();
          return { items: next };
        }),
      importItems: (incoming) => {
        const items = get().items;
        const added = Object.keys(incoming).filter((id) => !items[id]);
        set({ items: { ...incoming, ...items } });
        return added.length;
      },
    }),
    {
      name: "read-suttas",
      storage: createJSONStorage(() => window.localStorage),
      skipHydration: true,
    },
  ),
);
