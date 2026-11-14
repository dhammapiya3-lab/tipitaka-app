"use client";

import { TtsLockOverlay } from "@/components/sutta/tts-lock";
import { GlossDialog } from "@/components/dictionary/gloss-dialog";
import { SuttaEndNav } from "@/components/sutta/sutta-end";
import { LayerTabs } from "@/components/sutta/layer-tabs";
import {
  ParagraphParallels,
  parallelsByParagraph,
  useParallels,
} from "@/components/sutta/parallels";
import { TopicChips } from "@/components/topics/topic-chips";
import {
  BookA,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Headphones,
  List,
  Pause,
  Play,
  SkipBack,
  Lock,
  SkipForward,
  Square,
  Type,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { toast } from "sonner";
import {
  WordSheet,
  type AnalysisEditions,
  type WordTarget,
} from "@/components/dictionary/word-sheet";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DESKTOP_QUERY,
  useMediaQuery,
} from "@/components/shared/use-media-query";
import {
  BarButton,
  Breadcrumb,
  type CrumbItem,
  SubBar,
} from "@/components/layout/app-bar";
import {
  bookIndexOf,
  bookLabel,
  BookSwitch,
  CommentaryCard,
  CommentaryView,
  LAYER_NAME,
  VRI_ID,
} from "@/components/sutta/commentary-view";
import { WordBottomDock } from "@/components/dictionary/word-dock-bottom";
import { MemoDialog } from "@/components/sutta/memo-dialog";
import {
  InlineText,
  type InlineHighlight,
} from "@/components/sutta/inline-text";
import {
  editionsIn,
  HighlightMenu,
  SelectionToolbar,
  selectedCellText,
} from "@/components/sutta/selection-toolbar";
import { ReaderSide, type SidePanel } from "@/components/sutta/reader-side";
import {
  NoteBox,
  SegmentRow,
  type SentenceActions,
} from "@/components/sutta/segment-row";
import {
  EditionBadges,
  EditionPickerSheet,
  TextSettingsSheet,
  TocSheet,
  type TocEntry,
} from "@/components/sutta/reader-sheets";
import { orderEditions } from "@/components/suttas/sutta-row";
import { ANALYSIS_LABEL } from "@/components/dictionary/analysis-panel";
import { useReaderKeys } from "@/components/sutta/use-reader-keys";
import { useTts, type TtsLang } from "@/components/sutta/use-tts";
import {
  useAnalysisKeys,
  useSuttaNotes,
  useSuttaTexts,
} from "@/components/sutta/use-sutta-content";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PALI_EDITION } from "@/lib/constants";
import { foldPali } from "@/lib/pali";
import { fetchCommentary, fetchPageMarks } from "@/lib/content";
import { suttaHref, suttaLabel } from "@/lib/format";
import { sentenceCopyText, wordsOf } from "@/lib/reader";
import {
  alignEditions,
  compareSegmentKeys,
  paragraphOf,
  plainText,
  rowKind,
  unitOf,
  type AlignedRow,
} from "@/lib/segments";
import { pageMark, type PageMark } from "@/lib/page-marks";
import { cn } from "@/lib/utils";
import { useBookmarksStore } from "@/store/bookmarks";
import { useHighlightsStore } from "@/store/highlights";
import { useReadingStore } from "@/store/reading";
import { useSettingsStore } from "@/store/settings";
import type {
  AnalysisKind,
  CommentaryLayer,
  Edition,
  SuttaCommentary,
} from "@/types";

export interface SuttaLink {
  id: string;
  title: string;
}

/** 머리에 쓰는 경 정보 — 제목·부제·위치 줄·← 단추가 갈 곳 */
export interface SuttaHead {
  title: string;
  titleLang?: string;
  crumbs: CrumbItem[];
  backHref: string;
}

/** 화면 위 고정 칸(맨 위 띠) 높이 — 이보다 아래에 있는 첫 문장을 "읽는 곳"으로 본다 */
const TOP_OFFSET = 80;

export function SuttaView({
  suttaId,
  suttaTitle,
  editions,
  noteEditions,
  analysisEditions,
  prev,
  next,
  head,
  initialEdition,
  initialFocus,
  commentary = [],
  paliName,
  initialLayer,
}: {
  /** 주석에서 앞뒤 경으로 넘어왔으면 그 층 (?layer=) */
  initialLayer?: "attha" | "tika" | null;
  /** 목록의 빠알리 경 이름 (빠알리 판본 제목을 아직 못 읽었을 때) */
  paliName?: string;
  /** 이어 붙인 주석서·복주석서 */
  commentary?: CommentaryLayer[];
  head: SuttaHead;
  /** 경 목록에서 고른 판본 (?ed=) */
  initialEdition?: string | null;
  /** 문단별로 보기로 열기 — 앞 경에서 '다음'으로 넘어오면 첫 문단, 뒤 경에서 '이전'이면 마지막 문단 */
  initialFocus?: "first" | "last" | null;
  suttaId: string;
  suttaTitle: string;
  /** 이 경에 있는 판본 (빠알리 → 한국어 → 영어 순) */
  editions: Edition[];
  noteEditions: string[];
  /** 대역·문법분석이 있는 판본 */
  analysisEditions: AnalysisEditions;
  prev: SuttaLink | null;
  next: SuttaLink | null;
}) {
  const router = useRouter();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const compareMode = useSettingsStore((s) => s.compareMode);
  const setCompareMode = useSettingsStore((s) => s.setCompareMode);

  /**
   * 보이는 판본 — 경을 그냥 열면 목록 맨 위 번역 하나만 (한국어 → 빠알리 → 영어 순서의 첫째).
   * 경 목록에서 판본을 골라 들어왔으면(?ed=) 그 판본. 판본 선택 창에서 더하거나 뺄 수 있다(이 경을 보는 동안만).
   */
  const [picked, setPicked] = useState<string[]>(() => {
    const first = orderEditions(editions)[0]?.id;
    return initialEdition && editions.some((e) => e.id === initialEdition)
      ? [initialEdition]
      : first
        ? [first]
        : [];
  });
  const shownIds = editions
    .map((e) => e.id)
    .filter((id) => picked.includes(id));
  // 화면에는 원래 앱처럼 한국어 → 빠알리 → 영어 순서로
  const shown = orderEditions(editions.filter((e) => shownIds.includes(e.id)));
  const togglePick = (id: string) =>
    setPicked((cur) => {
      const next = cur.includes(id)
        ? cur.filter((e) => e !== id)
        : [...cur, id];
      return next.length > 0 ? next : cur; // 마지막 하나는 끌 수 없다
    });

  const { texts, error, retry } = useSuttaTexts(suttaId, shownIds);
  const { notes, load: loadNotes } = useSuttaNotes(suttaId);
  const [openNotes, setOpenNotes] = useState<ReadonlySet<string>>(new Set());
  /** 사전 창에 띄울 빠알리 단어와 그 문장 */
  const [word, setWord] = useState<WordTarget | null>(null);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const analysisIds = useMemo(
    () => ({
      nissaya: analysisEditions.nissaya.map((e) => e.id),
      grammar: analysisEditions.grammar.map((e) => e.id),
    }),
    [analysisEditions],
  );
  const analysisKeys = useAnalysisKeys(suttaId, analysisIds);
  /** 마지막으로 본 풀이(대역·문법분석) — 문장을 누르면 이것부터 연다 */
  const [lastKind, setLastKind] = useState<AnalysisKind>("nissaya");
  /** 키보드로 고른 문장과 그 안의 빠알리 단어 순번 */
  const [active, setActive] = useState<{ key: string; word: number } | null>(
    null,
  );
  /** 메모를 쓰는 문장 */
  const [memoRow, setMemoRow] = useState<AlignedRow | null>(null);
  /** 문단 보기: 이 문단 하나만 크게 보고 이전·다음 문단으로 넘긴다. null 이면 경 전체를 이어서 읽기 */
  const [focus, setFocus] = useState<string | null>(null);
  /** 경 · 주석서 · 복주석서 */
  const [layer, setLayer] = useState<"sutta" | "attha" | "tika">(
    // 청정도론은 주석서 칸이 따로 없다 (본문 칸이 곧 주석서) — 주소의 layer=attha 는 본문 칸으로
    initialLayer === "attha" && /^vism\d/.test(suttaId)
      ? "sutta"
      : (initialLayer ?? "sutta"),
  );
  /**
   * 주석 문헌(청정도론) — 본문 칸(경 칸 자리)이 곧 주석서라 단추 이름을 '주석서'로, 복주석서 칸에 마하띠까.
   * 본문 칸을 그대로 쓰므로 주석 낱말·주석 나란히 보기·문단별로 보기가 경과 똑같이 된다.
   */
  const commentaryOnly = /^vism\d/.test(suttaId);
  const rootName = commentaryOnly ? "주석서" : "경";
  /** 이어 붙인 주석서·복주석서 (작은 파일이라 경을 열 때 함께 받는다) */
  const [comm, setComm] = useState<
    Partial<Record<CommentaryLayer, SuttaCommentary>>
  >({});
  useEffect(() => {
    let alive = true;
    for (const l of commentary) {
      fetchCommentary(suttaId, l)
        .then((data) => alive && setComm((cur) => ({ ...cur, [l]: data })))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [commentary, suttaId]);
  /**
   * 경 문단 → 그 문단을 풀이한 주석 줄들 (문단마다 묶음). 한국어 번역이 있는 줄이 하나라도 있어야
   * 문단 머리에 "주석"·"복주석" 단추를 둔다.
   */
  const koCommentary = useMemo(() => {
    const out = new Map<
      string,
      Partial<
        Record<
          CommentaryLayer,
          { para: SuttaCommentary["paras"][number]; lines: number[] }[]
        >
      >
    >();
    for (const l of ["attha", "tika"] as const) {
      const data = comm[l];
      if (!data) continue;
      for (const para of data.paras) {
        const byRef = new Map<string, number[]>();
        para.lineRefs.forEach((refs, i) =>
          refs.forEach((r) => byRef.set(r, [...(byRef.get(r) ?? []), i])),
        );
        for (const [ref, lines] of byRef) {
          if (!lines.some((i) => Object.values(para.tr).some((t) => t[i])))
            continue;
          const row = out.get(ref) ?? {};
          (row[l] ??= []).push({ para, lines });
          out.set(ref, row);
        }
      }
    }
    return out;
  }, [comm]);
  /** 주석 판본 — VRI 원문과 번역자들 (주석서·복주석서를 합쳐서) */
  const commEditions = useMemo(() => {
    const vri = editions.find((e) => e.id === VRI_ID) ?? {
      id: VRI_ID,
      label: "VRI 제6차 결집본",
      badge: "V",
      language: "pli" as const,
      translator: null,
      license: null,
      allowCopy: true,
    };
    const seen = new Map<string, Edition>();
    for (const l of ["attha", "tika"] as const)
      comm[l]?.editions.forEach((e) => seen.has(e.id) || seen.set(e.id, e));
    return [...seen.values(), vri];
  }, [comm, editions]);
  /** 고른 주석 판본 — 처음에는 목록 맨 위 하나 (번역이 있으면 번역, 없으면 VRI 원문). 경과 같은 방식 */
  const [commPickedState, setCommPicked] = useState<string[] | null>(null);
  const commPicked = commPickedState ?? [commEditions[0].id];
  const toggleCommPick = (id: string) =>
    setCommPicked(() => {
      const cur = commPicked;
      const next = cur.includes(id)
        ? cur.filter((e) => e !== id)
        : [...cur, id];
      return next.length > 0 ? next : cur;
    });
  /** 문단 아래에 펼친 주석 번역 (문단 → 펼친 층) */
  const [openKo, setOpenKo] = useState<Record<string, CommentaryLayer[]>>({});
  const toggleKo = (p: string, l: CommentaryLayer) =>
    setOpenKo((cur) => {
      const now = cur[p] ?? [];
      return {
        ...cur,
        [p]: now.includes(l) ? now.filter((x) => x !== l) : [...now, l],
      };
    });
  // ── 책 쪽 번호 (텍스트 설정에서 고른 인쇄본) ──
  const pageEditions = useSettingsStore((s) => s.pageEditions);
  const [pageData, setPageData] = useState<{
    id: string;
    marks: [string, string, string][];
  } | null>(null);
  useEffect(() => {
    if (pageEditions.length === 0) return;
    let alive = true;
    fetchPageMarks(suttaId)
      .then((marks) => alive && setPageData({ id: suttaId, marks }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pageEditions.length, suttaId]);
  const pageMarksOf = useMemo(() => {
    const map = new Map<string, PageMark[]>();
    if (pageEditions.length === 0 || pageData?.id !== suttaId) return map;
    for (const [key, ed, n] of pageData.marks) {
      if (!pageEditions.includes(ed)) continue;
      map.set(key, [...(map.get(key) ?? []), pageMark(suttaId, key, ed, n)]);
    }
    return map;
  }, [pageData, pageEditions, suttaId]);
  /** 주석 연결 낱말 (켜고 끄기는 텍스트 설정·탭 줄) */
  const wordLinksSaved = useSettingsStore((s) => s.wordLinks);
  /*
   * 단추로 바꾼 값은 먼저 여기(화면 안 상태)에 두고 바로 그린 뒤, 저장(설정)은 조금 뒤에 한다 —
   * 설정 저장은 화면 전체를 한꺼번에 다시 그리게 해서, 긴 경에서 단추가 늦게 바뀌었다.
   */
  const [wordLinksPending, setWordLinksPending] = useState<boolean | null>(
    null,
  );
  const wordLinksNow = wordLinksPending ?? wordLinksSaved;
  const wordLinksOn = useDeferredValue(wordLinksNow);
  const setWordLinks = useSettingsStore((s) => s.setWordLinks);
  /** 경 문장 → 그 문장에서 주석이 풀이한 낱말들 (첫 낱말을 접어 맞춘다: pabbajitenā ↔ pabbajitena) */
  const linkIndex = useMemo(() => {
    const map = new Map<
      string,
      {
        fold: string;
        word: string;
        layer: CommentaryLayer;
        para: number;
        line: number;
      }[]
    >();
    for (const l of ["attha", "tika"] as const) {
      for (const link of comm[l]?.links ?? []) {
        const first = link.word.split(" ")[0];
        const list = map.get(link.key) ?? [];
        list.push({
          fold: foldPali(first),
          word: link.word,
          layer: l,
          para: link.para,
          line: link.line,
        });
        map.set(link.key, list);
      }
    }
    return map;
  }, [comm]);
  const linkHits = (key: string, word: string) => {
    const f = foldPali(word);
    return (linkIndex.get(key) ?? []).filter((h) => h.fold === f);
  };
  /** 밑줄은 빠알리 원문에만 긋는다 — 켤 때 빠알리 판본이 안 보이면 VRI(없으면 첫 빠알리 판본)를 함께 띄운다 */
  function showPaliForLinks() {
    if (shown.some((e) => e.language === "pli")) return;
    const pli =
      editions.find((e) => e.id === "pli-vri") ??
      editions.find((e) => e.language === "pli");
    if (pli)
      setPicked((cur) => (cur.includes(pli.id) ? cur : [...cur, pli.id]));
  }
  /** 누른 연결 낱말과 그 주석 줄들 */
  const [linkView, setLinkView] = useState<{
    key: string;
    word: string;
    hits: ReturnType<typeof linkHits>;
  } | null>(null);
  /** 컴퓨터 화면: 경 · 주석서 · 복주석서를 문단마다 나란히 (Digital Pāḷi Reader 처럼) */
  const [parallelPref, setParallel] = useState(false);
  /** 나란히 볼 칸 — 경·주석서·복주석서 중 둘 이상 (경+주석, 경+복주석, 주석+복주석, 셋 다) */
  const [parallelCols, setParallelCols] = useState<
    ("sutta" | CommentaryLayer)[]
  >(["sutta", "attha", "tika"]);
  /** 열려 있는 아래 창 */
  const [sheet, setSheet] = useState<"editions" | "toc" | "text" | null>(null);
  /** 오른쪽 칸(넓은 화면)에서 고른 탭과, 고를 때 열려 있던 풀이 — 그 뒤 새 문장·단어를 누르면 다시 풀이를 보인다 */
  const [chosen, setChosen] = useState<{
    panel: SidePanel;
    for: WordTarget | null;
  }>({
    panel: "toc",
    for: null,
  });
  const panel = word && word !== chosen.for ? "analysis" : chosen.panel;
  /** 병행 경전 (SuttaCentral) — 문단 번호 옆 "⇄ n" 과 '참고 경전' 목록 */
  const parallels = useParallels(suttaId);
  /** 지금 화면 맨 위에 있는 문단 (목차에서 호박색) */
  const [currentParagraph, setCurrentParagraph] = useState<string | null>(null);

  const bookmarks = useBookmarksStore((s) => s.items);
  const toggleBookmark = useBookmarksStore((s) => s.toggle);
  const setMemo = useBookmarksStore((s) => s.setMemo);
  const mine = new Map(
    bookmarks.filter((b) => b.suttaId === suttaId).map((b) => [b.key, b]),
  );
  // ── 밑줄·형광펜 ──
  const allHighlights = useHighlightsStore((s) => s.items);
  const addHighlight = useHighlightsStore((s) => s.add);
  const removeHighlight = useHighlightsStore((s) => s.remove);
  const recolorHighlight = useHighlightsStore((s) => s.recolor);
  const highlightsByCell = useMemo(() => {
    const map = new Map<string, InlineHighlight[]>();
    for (const h of allHighlights) {
      if (h.suttaId !== suttaId) continue;
      const k = `${h.editionId}|${h.key}`;
      map.set(k, [
        ...(map.get(k) ?? []),
        { id: h.id, start: h.start, end: h.end, color: h.color },
      ]);
    }
    return map;
  }, [allHighlights, suttaId]);
  const [hlMenu, setHlMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const getArticle = useCallback(() => articleRef.current, []);
  const saveReading = useReadingStore((s) => s.save);
  const tikaBook = useSettingsStore((s) => s.tikaBook);
  const setTikaBook = useSettingsStore((s) => s.setTikaBook);

  const loaded = shown.flatMap((e) => (texts[e.id] ? [texts[e.id]] : []));
  const rows = alignEditions(
    Object.fromEntries(loaded.map((t) => [t.editionId, t.segments])),
  ).filter((row) => rowKind(row.key, suttaId) !== "hidden");
  const textRows = rows.filter((row) => rowKind(row.key, suttaId) === "text");

  // ── 소리로 듣기 (TTS) — 한국어 번역 또는 빠알리 원문을 문장마다 읽는다 ──
  const ttsLangs: TtsLang[] = [
    ...(shown.some((e) => e.language !== "pli") ? (["ko"] as const) : []),
    ...(shown.some((e) => e.language === "pli") ? (["pli"] as const) : []),
  ];
  const [ttsLangPick, setTtsLang] = useState<TtsLang>("ko");
  const ttsLang: TtsLang = ttsLangs.includes(ttsLangPick)
    ? ttsLangPick
    : (ttsLangs[0] ?? "ko");
  const ttsEdition = shown.find((e) =>
    ttsLang === "pli" ? e.language === "pli" : e.language !== "pli",
  );
  /** 단어장(Gloss) — 문단의 빠알리 낱말 목록 */
  const [glossFor, setGlossFor] = useState<{
    title: string;
    pali: string;
    keys: string[];
  } | null>(null);
  /** 듣기 잠금 (화면 덮개 + 화면 꺼짐 막기) */
  const [ttsLocked, setTtsLocked] = useState(false);
  const ttsItems = textRows.flatMap((row) => {
    const cell = ttsEdition ? row.cells[ttsEdition.id] : undefined;
    const text = cell ? plainText(cell.parts).replace(/\s+/g, " ").trim() : "";
    return text ? [{ key: row.key, text }] : [];
  });
  // 문단별로 보기면 읽는 문장이 있는 문단으로 넘긴다
  const tts = useTts(
    ttsItems,
    (key) => {
      const p = paragraphOf(key, suttaId);
      setFocus((f) => (f && f !== p ? p : f));
    },
    () =>
      toast.error(
        ttsLang === "ko"
          ? "이 기기에서 한국어 음성을 낼 수 없습니다. 기기 설정에서 한국어 음성(TTS)을 설치해 주세요."
          : "이 기기에서 빠알리를 읽을 음성을 찾지 못했습니다.",
      ),
  );
  function listenFrom(key: string) {
    // 듣기를 처음 시작하면 잠금은 풀린 채로 (지난번 잠금이 남아 있지 않게)
    if (!tts.current) setTtsLocked(false);
    tts.speakFrom(key, { lang: ttsLang, rate: tts.rate });
  }
  const waiting = loaded.length === 0 && !error;

  // 본문이 늦게 그려지므로, 주소의 #문장번호(책갈피·목차·검색 링크)로 한 번만 이동한다.
  const scrolled = useRef(false);
  useEffect(() => {
    if (waiting || scrolled.current) return;
    scrolled.current = true;
    const target = decodeURIComponent(window.location.hash.slice(1));
    if (target) document.getElementById(target)?.scrollIntoView();
  }, [waiting]);

  // 이어 읽기: 스크롤이 멈추면 화면 맨 위 문장을 기억한다.
  const rowKeys = textRows.map((r) => r.key).join(",");
  useEffect(() => {
    if (!rowKeys) return;
    const keys = rowKeys.split(",");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const remember = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const key =
          keys.find(
            (k) =>
              (document.getElementById(k)?.getBoundingClientRect().bottom ??
                0) > TOP_OFFSET,
          ) ?? keys[0];
        saveReading({ suttaId, suttaTitle, key });
      }, 600);
    };
    remember();
    window.addEventListener("scroll", remember, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", remember);
    };
  }, [rowKeys, suttaId, suttaTitle, saveReading]);

  // 오른쪽 목차에서 지금 읽는 문단을 표시한다 (스크롤이 멈추면 화면 맨 위 문단)
  const paragraphIds = rowKeys
    ? [...new Set(rowKeys.split(",").map((k) => paragraphOf(k, suttaId)))].join(
        ",",
      )
    : "";
  useEffect(() => {
    if (!paragraphIds) return;
    const ids = paragraphIds.split(",");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const id = ids.find(
          (p) =>
            (document.getElementById(`section-${p}`)?.getBoundingClientRect()
              .bottom ?? 0) > TOP_OFFSET,
        );
        setCurrentParagraph(id ?? ids[0]);
      }, 150);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", update);
    };
  }, [paragraphIds, suttaId]);

  /** 책갈피·메모에 남길 문장: 번역이 있으면 첫 번역, 없으면 원문 (복사를 막아 둔 번역은 쓰지 않는다) */
  function baseOf(row: AlignedRow) {
    const usable = shown.filter((e) => e.allowCopy);
    const order = [...usable.filter((e) => e.language !== "pli"), ...usable];
    const cell = order.map((e) => row.cells[e.id]).find(Boolean);
    return {
      suttaId,
      key: row.key,
      suttaTitle,
      snippet: cell ? plainText(cell.parts) : "",
    };
  }

  const rowLabel = (key: string) =>
    `${suttaLabel(key.slice(0, key.indexOf(":")))}:${key.slice(key.indexOf(":") + 1)}`;

  // ── 대역·문법분석: 문단 배지와 문장 누르기 ───────────────────────
  /** 문단 번호 → 그 문단의 본문 문장 번호들 (차례대로) */
  const paragraphs = new Map<string, string[]>();
  for (const row of textRows) {
    const p = paragraphOf(row.key, suttaId);
    paragraphs.set(p, [...(paragraphs.get(p) ?? []), row.key]);
  }
  const paragraphList = [...paragraphs.keys()];
  // 앞뒤 경에서 문단별로 보기로 넘어왔으면, 문단 목록이 생긴 뒤 한 번만 그 문단을 연다
  const [pendingFocus, setPendingFocus] = useState(initialFocus ?? null);
  if (pendingFocus && paragraphList.length) {
    setPendingFocus(null);
    setFocus(
      pendingFocus === "first"
        ? paragraphList[0]
        : paragraphList[paragraphList.length - 1],
    );
  }
  /** 문단 → 그 문단과 같은 대목이 있는 경 (경 전체가 이어진 경은 첫 문단에) */
  const parallelsAt = parallels
    ? parallelsByParagraph(suttaId, parallels.links, paragraphList)
    : new Map<string, never[]>();
  const focusIndex = focus ? paragraphList.indexOf(focus) : -1;
  function openParagraph(p: string) {
    setFocus(p);
    window.scrollTo({ top: 0 });
  }
  /** 문단 보기를 마치면 보던 문단으로 돌아간다 (전체가 다시 그려진 다음 프레임에) */
  function closeParagraph() {
    const target = focus ? `section-${focus}` : null;
    setFocus(null);
    if (target) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          document.getElementById(target)?.scrollIntoView({ block: "start" }),
        ),
      );
    }
  }
  /** 이 문장들 가운데 풀이가 있는 종류 (게송 첫 줄에 게송 전체를 넣은 판본도 있어 게송 단위로도 본다) */
  function kindsFor(keys: string[]): AnalysisKind[] {
    const units = new Set(keys.map((k) => unitOf(k, suttaId)));
    return (["nissaya", "grammar"] as const).filter((kind) =>
      [...analysisKeys[kind]].some(
        (k) =>
          keys.includes(k) ||
          (units.has(unitOf(k, suttaId)) && unitOf(k, suttaId) !== null),
      ),
    );
  }
  function paliOf(keys: string[]): string {
    const root =
      texts[PALI_EDITION] ??
      shown
        .filter((e) => e.language === "pli")
        .map((e) => texts[e.id])
        .find(Boolean);
    if (!root) return "";
    return root.segments
      .filter((seg) => keys.includes(seg.key))
      .map((seg) => plainText(seg.parts))
      .join("\n");
  }
  function openAnalysis(keys: string[], kind: AnalysisKind, title: string) {
    setLastKind(kind);
    setWord({
      word: null,
      rowKey: keys[0],
      keys,
      tab: kind,
      title,
      pali: paliOf(keys),
    });
  }
  /** 문장을 누르면 그 문장 하나의 대역·문법분석 (풀이가 있는 문장만) */
  function onSentence(row: AlignedRow) {
    const kinds = kindsFor([row.key]);
    if (kinds.length === 0) return;
    const kind = kinds.includes(lastKind) ? lastKind : kinds[0];
    openAnalysis([row.key], kind, rowLabel(row.key));
  }
  function paragraphTitle(paragraph: string): string {
    return paragraph.includes(":")
      ? `${rowLabel(paragraph)} 문단`
      : `${unitLabel(paragraph)} 게송`;
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error(
        "복사하지 못했습니다. 브라우저가 클립보드 사용을 막았을 수 있습니다.",
      );
    }
  }

  function actionsFor(row: AlignedRow): SentenceActions {
    const url = `${window.location.origin}${suttaHref(suttaId, row.key)}`;
    return {
      saved: mine.has(row.key),
      memo: mine.get(row.key)?.memo || null,
      onBookmark: () => toggleBookmark(baseOf(row)),
      onMemo: () => setMemoRow(row),
      onCopyLink: () => copy(url, "문장 링크를 복사했습니다."),
      onListen: tts.supported ? () => listenFrom(row.key) : undefined,
      onCopyText: () => {
        const { text, skipped } = sentenceCopyText(
          row,
          shown,
          `${rowLabel(row.key)} ${suttaTitle}`,
          url,
        );
        void copy(
          text,
          skipped.length
            ? `복사했습니다. (${skipped.join(", ")} 번역은 복사를 막아 두어 뺐습니다)`
            : "원문과 번역을 복사했습니다.",
        );
      },
    };
  }

  function toggleNote(editionId: string, key: string, mark: string) {
    const id = `${editionId} ${key} ${mark}`;
    if (!openNotes.has(id)) loadNotes(editionId);
    setOpenNotes((prevSet) => {
      const nextSet = new Set(prevSet);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });
  }

  // ── 키보드로 읽기 ───────────────────────────────────────────
  const activeRow = active
    ? textRows.find((r) => r.key === active.key)
    : undefined;
  const paliWords = activeRow?.cells[PALI_EDITION]
    ? wordsOf(activeRow.cells[PALI_EDITION].parts)
    : [];
  useReaderKeys({
    moveSentence: (step) => {
      if (textRows.length === 0) return;
      let i = textRows.findIndex((r) => r.key === active?.key);
      if (i < 0) {
        // 처음에는 지금 화면에 보이는 첫 문장부터
        i = textRows.findIndex(
          (r) =>
            (document.getElementById(r.key)?.getBoundingClientRect().bottom ??
              0) > TOP_OFFSET,
        );
        i = Math.max(0, step === 1 ? i - 1 : i);
      }
      const nextRow =
        textRows[Math.min(textRows.length - 1, Math.max(0, i + step))];
      setActive({ key: nextRow.key, word: 0 });
      document.getElementById(nextRow.key)?.scrollIntoView({ block: "center" });
    },
    moveWord: (step) => {
      if (!active) return false;
      setActive({
        key: active.key,
        word: Math.min(
          Math.max(0, active.word + step),
          Math.max(0, paliWords.length - 1),
        ),
      });
      return true;
    },
    lookup: () => {
      const w = paliWords[active?.word ?? 0];
      if (active && w) {
        setWord({
          word: w,
          rowKey: active.key,
          keys: [active.key],
          tab: "dictionary",
          title: "",
          pali: paliOf([active.key]),
        });
      }
    },
    bookmark: () => {
      if (activeRow) {
        const saved = mine.has(activeRow.key);
        toggleBookmark(baseOf(activeRow));
        toast.success(saved ? "책갈피를 지웠습니다." : "책갈피에 넣었습니다.");
      }
    },
    copy: () => {
      if (activeRow) actionsFor(activeRow).onCopyText();
    },
    escape: () => {
      if (word) setWord(null);
      else setActive(null);
    },
    prevSutta: () => {
      if (prev) router.push(suttaHref(prev.id));
    },
    nextSutta: () => {
      if (next) router.push(suttaHref(next.id));
    },
  });

  const noteFontSize = useSettingsStore((s) => s.noteFontSize);
  /** 복사·공유할 때 끝에 붙이는 출처 — 경 이름, 번역자(원문 판본), 주소 */
  function attribution(editionIds: string[]): string {
    const eds = editionIds
      .map((id) => editions.find((e) => e.id === id))
      .filter((e): e is Edition => Boolean(e));
    const tr = eds.filter((e) => e.language !== "pli").map((e) => e.label);
    const pli = eds.filter((e) => e.language === "pli").map((e) => e.label);
    const who = [
      tr.length ? `번역: ${tr.join(", ")}` : "",
      pli.length ? `원문: ${pli.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const url = `${window.location.origin}${suttaHref(suttaId)}`;
    return `— ${editionTitle ?? head.title} (${suttaLabel(suttaId)})${who ? ` · ${who}` : ""}\n${url}`;
  }

  const articleStyle = {
    fontSize,
    lineHeight,
    "--note-fs": `${noteFontSize}px`,
  } as CSSProperties;
  /** 넓은 화면에서 판본을 여럿 고르면 칸으로 나란히 (폰은 문장마다 번갈아) */
  /** 경 · 주석서 · 복주석서 나란히 (컴퓨터, 주석이 있는 경, 경 탭에서) — 이때 판본은 칸 대신 문장마다 번갈아 */
  const parallel =
    isDesktop && parallelPref && commentary.length > 0 && layer === "sutta";
  const parallelLayers = commentary.filter(
    (l) => comm[l] && parallelCols.includes(l),
  );
  const withSutta = parallelCols.includes("sutta");
  const parallelGrid = `${withSutta ? "minmax(0,1.15fr) " : ""}repeat(${parallelLayers.length}, minmax(0,1fr))`;
  /** 나란히 보기에서 칸 하나 켜고 끄기 — 둘보다 적게는 끌 수 없다 */
  /** 판본 대조 방식을 고를 수 있는 때 (컴퓨터, 판본 둘 이상, 주석 나란히 보기가 아닐 때) */
  const canCompare = isDesktop && shown.length > 1 && !parallel;
  const columns = canCompare && compareMode === "side";
  /**
   * 본문 폭 — 게송처럼 짧은 줄은 어플처럼 가운데 알맞은 폭으로 모으고, 판본을 나란히 놓으면 그만큼 넓힌다.
   * (게송 경: 법구경처럼 경 안에 게송 번호가 있는 경)
   */
  const verse = textRows.some((r) => unitOf(r.key, suttaId) !== null);
  const readWidth = parallel
    ? "max-w-none"
    : columns
      ? shown.length === 2
        ? verse
          ? "max-w-3xl"
          : "max-w-5xl"
        : "max-w-none"
      : verse
        ? "max-w-[30rem]"
        : "max-w-2xl";

  // 단락 제목(.0 줄)을 그 다음 문단에 붙인다 — 문단 카드 위 제목과 목차, 문단 보기의 제목에 쓴다
  const headingOf = new Map<string, string>();
  /** 제목 줄 자체 (각주 표시를 그대로 보여 주려고) — 문단 → 제목 줄과 그 글을 가진 판본 */
  const headingRowOf = new Map<string, { row: AlignedRow; edition: Edition }>();
  {
    let pending: { row: AlignedRow; edition: Edition } | null = null;
    for (const row of rows) {
      if (rowKind(row.key, suttaId) === "heading") {
        const edition = [
          ...shown.filter((e) => e.language !== "pli"),
          ...shown,
        ].find((e) => row.cells[e.id]);
        if (edition) pending = { row, edition };
      } else if (pending) {
        const p = paragraphOf(row.key, suttaId);
        headingRowOf.set(p, pending);
        headingOf.set(
          p,
          plainText(pending.row.cells[pending.edition.id]!.parts),
        );
        pending = null;
      }
    }
  }
  const toc: TocEntry[] = paragraphList.map((p) => ({
    paragraph: p,
    label: paragraphMark(p),
    title: headingOf.get(p),
  }));
  const rowByKey = new Map(rows.map((r) => [r.key, r]));
  const firstTranslation = shown.find((e) => e.language !== "pli");
  /**
   * 경 제목 — 원래 앱처럼 처음 고른 번역의 제목(0.x 줄의 마지막 글, 예: 담마간다 스님 "무아특성경",
   * 한국테라와다불교 교단 "무아상경(無我相經)"). 번역이 없거나 아직 불러오지 못했으면 목록의 이름.
   */
  const titleText = firstTranslation ? texts[firstTranslation.id] : undefined;
  const editionTitle = titleText?.segments
    .filter((seg) => rowKind(seg.key, suttaId) === "hidden")
    .map((seg) => plainText(seg.parts).trim())
    .filter(Boolean)
    .at(-1);

  const onCommentaryWord = (w: string) =>
    setWord({
      word: w,
      rowKey: "commentary",
      keys: [],
      tab: "dictionary",
      title: "",
      pali: "",
    });
  /** 나란히 보기에서 경 문단마다 붙일 주석 문단 — 풀이하는 첫 경 문단에 둔다 */
  const commentaryRows = new Map<
    string,
    Partial<Record<CommentaryLayer, number[]>>
  >();
  for (const l of parallelLayers) {
    comm[l]!.paras.forEach((para, i) => {
      const at = paragraphList.includes(para.refs[0] ?? "")
        ? para.refs[0]
        : paragraphList[0];
      if (!at) return;
      const row = commentaryRows.get(at) ?? {};
      (row[l] ??= []).push(i);
      commentaryRows.set(at, row);
    });
  }
  /** 문단 보기: 이 문단을 풀이한 주석 문단 전부 */
  const commentaryFor = (p: string) =>
    Object.fromEntries(
      parallelLayers.map((l) => [
        l,
        comm[l]!.paras.flatMap((para, i) =>
          para.lineRefs.some((refs) => refs.includes(p)) ? [i] : [],
        ),
      ]),
    ) as Partial<Record<CommentaryLayer, number[]>>;
  const commentaryCards = (
    l: CommentaryLayer,
    ids: number[] | undefined,
    label?: boolean,
    only?: string,
  ) =>
    (ids ?? [])
      .filter(
        (i) =>
          tikaBook === null ||
          comm[l]!.books.length < 2 ||
          bookIndexOf(comm[l]!, comm[l]!.paras[i].book) === tikaBook,
      )
      .map((i) => (
        <CommentaryCard
          onlyLines={
            only
              ? comm[l]!.paras[i].lineRefs.flatMap((refs, j) =>
                  refs.includes(only) ? [j] : [],
                )
              : undefined
          }
          key={`${l}-${i}`}
          layer={l}
          index={i}
          para={comm[l]!.paras[i]}
          onWord={onCommentaryWord}
          label={label ? LAYER_NAME[l] : undefined}
          bookBadge={bookLabel(comm[l]!, comm[l]!.paras[i].book)}
          picked={commPicked}
          editions={comm[l]!.editions}
          bookId={comm[l]!.book}
          pageMarksOf={(k) => pageMarksOf.get(k)}
          rootName={rootName}
        />
      ));
  /** 경 문단 하나와 그 주석을 한 줄에 (나란히 보기) */
  const parallelRow = (
    p: string,
    cells: Partial<Record<CommentaryLayer, number[]>>,
    card: React.ReactNode,
  ) =>
    !withSutta && !parallelLayers.some((l) => cells[l]?.length) ? null : (
      <div
        key={p}
        className="grid items-start gap-4"
        style={{ gridTemplateColumns: parallelGrid }}
      >
        {withSutta ? (
          <div className="flex min-w-0 flex-col gap-2">{card}</div>
        ) : null}
        {parallelLayers.map((l) => (
          <div key={l} className="flex min-w-0 flex-col gap-3 text-[0.94em]">
            {commentaryCards(l, cells[l], false, focus ?? undefined)}
          </div>
        ))}
      </div>
    );

  /** 나란히 보기의 "경" 칸 이름 — 가장 먼저 고른 빠알리 판본의 경 제목 (없으면 목록의 빠알리 이름) */
  const firstPali = picked
    .map((id) => editions.find((e) => e.id === id))
    .find((e) => e?.language === "pli");
  const paliTitle =
    (firstPali
      ? texts[firstPali.id]?.segments
          .filter((seg) => rowKind(seg.key, suttaId) === "hidden")
          .map((seg) => plainText(seg.parts).trim())
          .filter(Boolean)
          .at(-1)
      : undefined) ?? paliName;
  const parallelHeader = (
    <div
      className="sticky top-0 z-10 -mb-1 grid gap-4 bg-background/95 py-2 text-sm font-bold backdrop-blur"
      style={{ gridTemplateColumns: parallelGrid }}
    >
      {withSutta ? (
        <span className="truncate">
          {rootName}{" "}
          {paliTitle ? (
            <span className="font-pali text-xs font-medium text-faint">
              {paliTitle}
            </span>
          ) : null}
        </span>
      ) : null}
      {parallelLayers.map((l) => (
        <span key={l} className="flex min-w-0 items-center gap-2">
          <span className="truncate">
            {LAYER_NAME[l]}{" "}
            <span className="font-pali text-xs font-medium text-faint">
              {(tikaBook !== null && comm[l]!.books.length > 1
                ? comm[l]!.books[tikaBook]?.name
                : null) ?? comm[l]!.bookName}
            </span>
          </span>
          <BookSwitch
            data={comm[l]!}
            value={tikaBook}
            onChange={setTikaBook}
            className="ml-auto shrink-0"
          />
        </span>
      ))}
    </div>
  );

  // 읽는 문장을 따라 화면을 옮긴다 (문단별로 보기면 그 문단으로 넘긴다)
  const ttsCurrent = tts.current;
  useEffect(() => {
    if (!ttsCurrent) return;
    requestAnimationFrame(() =>
      document
        .getElementById(ttsCurrent)
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
  }, [ttsCurrent]);

  function paragraphCard(p: string, inFocus: boolean) {
    const keys = paragraphs.get(p) ?? [];
    const kinds = kindsFor(keys);
    const header = (
      <>
        {/* 문단 번호 바로 옆에 VRI 문단·게송 번호 — 본문에서 뗀 번호를 여기에 (VRI 원문을 볼 때만) */}
        <span className="flex items-center gap-2">
          <h3 className="text-sm font-bold transition-colors group-hover/head:text-primary">
            {paragraphMark(p)}
          </h3>
          {picked.includes(VRI_ID) && texts[VRI_ID]?.vriNumbers?.[p] ? (
            <span
              className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-semibold text-brand-ink"
              title="VRI 제6차 결집본의 번호"
            >
              VRI {VERSE_BOOKS.test(suttaId) ? "게송" : "문단"}{" "}
              {texts[VRI_ID]!.vriNumbers![p]}
            </span>
          ) : null}
          {parallels && parallelsAt.get(p)?.length ? (
            <ParagraphParallels
              items={parallelsAt.get(p)!}
              names={parallels.names}
            />
          ) : null}
        </span>
        {/* 마우스를 올리면 누를 수 있다는 것을 알린다 */}
        <span className="mr-auto hidden items-center gap-0.5 text-xs font-medium text-primary opacity-0 transition-opacity group-hover/head:opacity-100 group-focus-visible/head:opacity-100 sm:inline-flex print:hidden">
          {inFocus ? "장 전체 보기" : "문단별로 보기"}
          <ChevronRight className="size-3.5" aria-hidden />
        </span>
        <div className="flex items-center gap-1.5 print:hidden">
          {(["attha", "tika"] as const).map((l) =>
            koCommentary.get(p)?.[l] ? (
              <button
                key={l}
                type="button"
                title={`이 문단의 ${LAYER_NAME[l]} 번역 ${openKo[p]?.includes(l) ? "접기" : "보기"}`}
                aria-pressed={openKo[p]?.includes(l) ?? false}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleKo(p, l);
                }}
                className={cn(
                  "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                  openKo[p]?.includes(l)
                    ? "bg-amber-600 text-white"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300",
                )}
              >
                {l === "attha" ? "주석" : "복주석"}
              </button>
            ) : null,
          )}
          <button
            type="button"
            title="이 문단의 빠알리 낱말을 모두 뽑아 뜻을 붙인 단어장 (복사·Anki 파일)"
            onClick={(e) => {
              e.stopPropagation();
              setGlossFor({
                title: paragraphTitle(p),
                pali: paliOf(keys),
                keys,
              });
            }}
            className="inline-flex items-center justify-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-muted dark:text-muted-foreground"
          >
            단어장
          </button>
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              title={`${ANALYSIS_LABEL[k]} 보기`}
              onClick={(e) => {
                e.stopPropagation();
                openAnalysis(keys, k, paragraphTitle(p));
              }}
              className={cn(
                "inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                k === "nissaya"
                  ? "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300"
                  : "bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-300",
              )}
            >
              {ANALYSIS_LABEL[k]}
            </button>
          ))}
        </div>
      </>
    );
    return (
      <div
        key={p}
        id={`section-${p}`}
        className="scroll-mt-4 overflow-hidden rounded-2xl border bg-card shadow-sm break-inside-avoid"
      >
        {/* 원래 앱처럼 문단 머리를 누르면 그 문단부터 한 문단씩 본다 — 문단별로 보기에서 다시 누르면 장 전체로 돌아간다 */}
        <div
          role="button"
          tabIndex={0}
          title={
            inFocus ? "장 전체 보기로 돌아가기" : "이 문단부터 문단별로 보기"
          }
          onClick={() => (inFocus ? closeParagraph() : openParagraph(p))}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (inFocus) closeParagraph();
              else openParagraph(p);
            }
          }}
          className="group/head flex cursor-pointer items-center justify-between gap-3 border-b border-gray-100 px-5 pt-4 pb-2 transition-colors outline-none hover:bg-amber-50 focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border dark:hover:bg-amber-950/40"
        >
          {header}
        </div>
        <div className={inFocus ? "px-5 py-4" : "px-5 py-3"}>
          {columns ? (
            <div
              className="grid gap-x-6 pb-1 pr-7 font-sans text-xs font-bold"
              style={{
                gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`,
              }}
            >
              {shown.map((e) => (
                <span
                  key={e.id}
                  className={cn(
                    e.language === "ko"
                      ? "text-primary"
                      : "text-gray-600 dark:text-muted-foreground",
                    !e.allowCopy && "print:invisible",
                  )}
                >
                  {e.badge}) {e.label}
                </span>
              ))}
            </div>
          ) : null}
          {keys.map((key) => {
            const row = rowByKey.get(key);
            if (!row) return null;
            const unit = unitOf(row.key, suttaId);
            return (
              <Fragment key={row.key}>
                <SegmentRow
                  row={row}
                  heading={false}
                  unitLabel={null}
                  active={active?.key === row.key || tts.current === row.key}
                  activeWord={active?.key === row.key ? active.word : null}
                  actions={actionsFor(row)}
                  shown={shown}
                  texts={texts}
                  noteEditions={noteEditions}
                  notes={notes}
                  openNotes={openNotes}
                  onNote={toggleNote}
                  onWord={(w) =>
                    setWord({
                      word: w,
                      rowKey: row.key,
                      keys: [row.key],
                      tab: "dictionary",
                      title: "",
                      pali: paliOf([row.key]),
                    })
                  }
                  onSentence={() => onSentence(row)}
                  unit={unit}
                  columns={columns}
                  linked={
                    wordLinksOn && linkIndex.has(row.key)
                      ? (w) => linkHits(row.key, w).length > 0
                      : undefined
                  }
                  bookmarked={mine.has(row.key)}
                  pageMarks={pageMarksOf.get(row.key)}
                  highlightsFor={(editionId) =>
                    highlightsByCell.get(`${editionId}|${row.key}`) ?? []
                  }
                  onHighlight={(id, target) => {
                    const r = target.getBoundingClientRect();
                    setHlMenu({ id, x: r.left + r.width / 2, y: r.bottom });
                  }}
                  onLinked={(w) =>
                    setLinkView((cur) =>
                      cur?.key === row.key && cur.word === w
                        ? null
                        : { key: row.key, word: w, hits: linkHits(row.key, w) },
                    )
                  }
                />
                {linkView?.key === row.key ? linkBox(linkView) : null}
              </Fragment>
            );
          })}
        </div>
        {(openKo[p] ?? []).map((l) => koBlock(p, l))}
      </div>
    );
  }

  /** 펼친 주석에 보일 번역자 — 고른 번역자 중 이 문단에 번역이 있는 사람, 없으면 번역이 있는 모든 사람 */
  function koShown(para: SuttaCommentary["paras"][number]) {
    const have = commEditions.filter((e) => para.tr[e.id]);
    const mine = have.filter((e) => commPicked.includes(e.id));
    return mine.length ? mine : have;
  }

  /** 문단 아래에 펼치는 주석·복주석 번역 — 빠알리 한 줄, 그 아래 한국어 */
  function koBlock(p: string, l: CommentaryLayer) {
    const groups = koCommentary.get(p)?.[l];
    const data = comm[l];
    if (!groups || !data) return null;
    const other: CommentaryLayer = l === "attha" ? "tika" : "attha";
    const otherGroups = koCommentary.get(p)?.[other];
    const ref = (g: { para: { para: number } }[]) =>
      `${(l === "attha" ? data : comm[other]!).book} ${g.map((x) => x.para.para).join(", ")}`;
    return (
      <div
        key={l}
        className="border-t border-gray-100 bg-gray-50/70 px-5 py-4 dark:border-border dark:bg-muted/30 print:hidden"
      >
        <button
          type="button"
          onClick={() => toggleKo(p, l)}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-amber-800 hover:underline dark:text-amber-300"
        >
          <span aria-hidden>▾</span> 이 문단의 {LAYER_NAME[l]} 접기
        </button>
        <div className="flex flex-col gap-4 border-l-2 border-amber-300 pl-4">
          <p className="text-xs text-faint">
            {[data.title, data.nameKo].filter(Boolean).join(" · ") ||
              data.bookName}{" "}
            ({data.book} {groups.map((g) => g.para.para).join(", ")})
          </p>
          {groups.flatMap(({ para, lines }) =>
            lines.map((i) => (
              <div key={`${para.para}-${i}`} className="flex flex-col gap-1">
                <p
                  lang="pi"
                  className="font-pali text-amber-900 dark:text-amber-200"
                >
                  {i === 0 && para.vripara ? `${para.vripara}. ` : ""}
                  <InlineText parts={para.lines[i]} onWord={onCommentaryWord} />
                </p>
                {koShown(para).map((e) =>
                  para.tr[e.id]?.[i] ? (
                    <p
                      key={e.id}
                      className="text-[0.9em] leading-relaxed text-gray-600 dark:text-muted-foreground"
                    >
                      {koShown(para).length > 1 ? (
                        <span className="mr-1.5 inline-flex rounded bg-primary px-1 align-middle text-[10px] font-bold text-primary-foreground">
                          {e.badge})
                        </span>
                      ) : null}
                      <InlineText parts={para.tr[e.id]![i]!} />
                    </p>
                  ) : null,
                )}
              </div>
            )),
          )}
          {otherGroups && !(openKo[p] ?? []).includes(other) ? (
            <button
              type="button"
              onClick={() => toggleKo(p, other)}
              className="w-fit rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-gray-50"
            >
              {LAYER_NAME[other]}도 보기 ({ref(otherGroups)})
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  /** 주석 연결 낱말을 누르면 — 각주처럼 그 문장 바로 아래에 펼친다 (다시 누르면 접힌다) */
  function linkBox(view: NonNullable<typeof linkView>) {
    return (
      <aside
        aria-label={`주석: ${view.word}`}
        className="mt-1 mb-2 flex flex-col gap-3 rounded-lg border-l-2 border-amber-300 bg-amber-50/60 px-3 py-2.5 text-[length:var(--note-fs,0.9em)] dark:bg-amber-950/30"
      >
        {view.hits.map((h, i) => {
          const data = comm[h.layer];
          const para = data?.paras[h.para];
          if (!data || !para) return null;
          return (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-xs font-bold text-primary">
                {LAYER_NAME[h.layer]}{" "}
                <span className="font-normal text-faint">
                  {data.book} {para.para}
                </span>
              </p>
              <p
                lang="pi"
                className="font-pali text-amber-900 dark:text-amber-200"
              >
                <InlineText
                  parts={para.lines[h.line]}
                  onWord={onCommentaryWord}
                />
              </p>
              {koShown(para).map((e) =>
                para.tr[e.id]?.[h.line] ? (
                  <p
                    key={e.id}
                    className="leading-relaxed text-gray-600 dark:text-muted-foreground"
                  >
                    <InlineText parts={para.tr[e.id]![h.line]!} />
                  </p>
                ) : null,
              )}
              <button
                type="button"
                onClick={() => {
                  setLinkView(null);
                  setLayer(h.layer);
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() =>
                      document
                        .getElementById(`${h.layer}-${h.para}`)
                        ?.scrollIntoView({ block: "start" }),
                    ),
                  );
                }}
                className="w-fit text-xs font-bold text-primary hover:underline"
              >
                {LAYER_NAME[h.layer]}에서 이어 읽기 →
              </button>
            </div>
          );
        })}
      </aside>
    );
  }

  /** 이야기·단락 제목 — 가운데 호박색 글자, 양옆에 옅은 선. 각주 표시를 누르면 아래에 각주가 열린다 */
  function headingBlock(p: string) {
    const h = headingRowOf.get(p);
    if (!h) return null;
    const { row, edition } = h;
    const parts = row.cells[edition.id]!.parts;
    const marks = new Set(
      parts.flatMap((part) =>
        part.type === "note" &&
        openNotes.has(`${edition.id} ${row.key} ${part.mark}`)
          ? [part.mark]
          : [],
      ),
    );
    return (
      <div id={row.key} className="scroll-mt-32">
        <h2 className="flex items-center gap-3 px-2 pt-3 pb-1 font-sans">
          <span
            aria-hidden
            className="h-px min-w-6 flex-1 bg-amber-200 dark:bg-amber-900"
          />
          <span
            lang={edition.language === "pli" ? "pi" : undefined}
            className={cn(
              "max-w-[80%] text-center text-[0.9em] font-bold tracking-wide text-balance break-keep text-amber-800 dark:text-amber-300",
              !edition.allowCopy && "select-none print:invisible",
            )}
            onCopy={edition.allowCopy ? undefined : (e) => e.preventDefault()}
          >
            <InlineText
              parts={parts}
              openMarks={marks}
              onNote={
                noteEditions.includes(edition.id)
                  ? (mark) => toggleNote(edition.id, row.key, mark)
                  : undefined
              }
            />
          </span>
          <span
            aria-hidden
            className="h-px min-w-6 flex-1 bg-amber-200 dark:bg-amber-900"
          />
        </h2>
        {[...marks].map((mark) => (
          <div key={mark} className="px-2">
            <NoteBox mark={mark} state={notes[edition.id]} rowKey={row.key} />
          </div>
        ))}
      </div>
    );
  }

  const navButton =
    "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-bold text-primary transition-colors hover:bg-brand-soft disabled:pointer-events-none disabled:opacity-30";

  /** 이전 · 다음 — 문단 보기에서는 문단, 아니면 경 (주석서·복주석서에서는 그 층을 그대로 연다) */
  const navBar = (
    <div
      className={cn(
        "mx-auto box-content flex items-center justify-between px-4 py-2 print:hidden",
        readWidth,
      )}
    >
      {focus ? (
        <>
          {/* 경의 첫·마지막 문단에서는 앞뒤 경의 마지막·첫 문단으로 이어 넘긴다 (품이 끝나도 계속) */}
          {focusIndex <= 0 && prev ? (
            <Link
              href={suttaHref(
                prev.id,
                undefined,
                layer === "sutta" ? undefined : layer,
                "last",
              )}
              className={navButton}
              title={`앞 경 · ${prev.title}`}
            >
              <ChevronLeft className="size-4" aria-hidden />
              이전
            </Link>
          ) : (
            <button
              type="button"
              className={navButton}
              disabled={focusIndex <= 0}
              onClick={() => openParagraph(paragraphList[focusIndex - 1])}
            >
              <ChevronLeft className="size-4" aria-hidden />
              이전
            </button>
          )}
          <span className="text-xs text-faint">
            {focusIndex + 1} / {paragraphList.length}
          </span>
          {focusIndex >= paragraphList.length - 1 && next ? (
            <Link
              href={suttaHref(
                next.id,
                undefined,
                layer === "sutta" ? undefined : layer,
                "first",
              )}
              className={navButton}
              title={`다음 경 · ${next.title}`}
            >
              다음
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <button
              type="button"
              className={navButton}
              disabled={focusIndex >= paragraphList.length - 1}
              onClick={() => openParagraph(paragraphList[focusIndex + 1])}
            >
              다음
              <ChevronRight className="size-4" aria-hidden />
            </button>
          )}
        </>
      ) : (
        <>
          {prev ? (
            <Link
              href={suttaHref(
                prev.id,
                undefined,
                layer === "sutta" ? undefined : layer,
              )}
              className={navButton}
              title={prev.title}
            >
              <ChevronLeft className="size-4" aria-hidden />
              이전
            </Link>
          ) : (
            <span className={cn(navButton, "opacity-30")}>
              <ChevronLeft className="size-4" aria-hidden />
              이전
            </span>
          )}
          {next ? (
            <Link
              href={suttaHref(
                next.id,
                undefined,
                layer === "sutta" ? undefined : layer,
              )}
              className={navButton}
              title={next.title}
            >
              다음
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : (
            <span className={cn(navButton, "opacity-30")}>
              다음
              <ChevronRight className="size-4" aria-hidden />
            </span>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col">
      {/* 넓은 화면: 왼쪽 본문 + 오른쪽 목차·풀이 칸 */}
      <div className="mx-auto flex w-full max-w-[1440px] items-start gap-6 lg:px-6">
        <div className="min-w-0 flex-1">
          {/* 머리(제목·번역자·위치 줄·판본)는 본문 상자 폭에 맞춰 함께 가운데로 */}
          <SubBar
            widthClass={readWidth}
            title={
              focus
                ? `${editionTitle ?? head.title} ${paragraphMark(focus)}`
                : (editionTitle ?? head.title)
            }
            titleLang={focus || editionTitle ? undefined : head.titleLang}
            subtitle={focus ? undefined : firstTranslation?.label}
            backHref={focus ? undefined : head.backHref}
            onBack={focus ? closeParagraph : undefined}
            actions={
              <>
                <BarButton
                  label="판본 선택"
                  onClick={() => setSheet("editions")}
                >
                  <BookOpen aria-hidden />
                </BarButton>
                {focus ? null : (
                  <BarButton label="목차" onClick={() => setSheet("toc")}>
                    <List aria-hidden />
                  </BarButton>
                )}
                {tts.supported ? (
                  <BarButton
                    label={tts.current ? "듣기 멈추기" : "소리로 듣기"}
                    onClick={() => {
                      if (tts.current) return tts.stop();
                      const from = paragraphs.get(
                        focus ?? currentParagraph ?? paragraphList[0] ?? "",
                      )?.[0];
                      listenFrom(
                        ttsItems.find(
                          (i) => !from || compareSegmentKeys(i.key, from) >= 0,
                        )?.key ??
                          ttsItems[0]?.key ??
                          "",
                      );
                    }}
                  >
                    <Headphones
                      aria-hidden
                      className={cn(tts.current && "text-primary")}
                    />
                  </BarButton>
                ) : null}
                <BarButton label="텍스트 설정" onClick={() => setSheet("text")}>
                  <Type aria-hidden />
                </BarButton>
                {isDesktop ? null : (
                  // 컴퓨터에서는 왼쪽 메뉴에 사전이 있어 빼 둔다
                  <BarButton label="사전" href="/dictionary">
                    <BookA aria-hidden />
                  </BarButton>
                )}
              </>
            }
          >
            <Breadcrumb items={head.crumbs} />
            <TopicChips suttaId={suttaId} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <EditionBadges
                editions={layer === "sutta" ? editions : commEditions}
                shownIds={layer === "sutta" ? shownIds : commPicked}
                onToggle={layer === "sutta" ? togglePick : toggleCommPick}
              />
              {canCompare ? (
                <div
                  className="ml-auto flex rounded-lg bg-muted p-0.5 print:hidden"
                  role="group"
                  aria-label="판본 대조 방식"
                >
                  {(
                    [
                      ["side", "옆으로 나란히"],
                      ["alternate", "문장마다 번갈아"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={compareMode === mode}
                      onClick={() => setCompareMode(mode)}
                      className={cn(
                        "h-7 rounded-md px-3 text-xs whitespace-nowrap transition-colors",
                        compareMode === mode
                          ? "bg-card font-bold text-primary shadow-sm"
                          : "font-medium text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </SubBar>
          <LayerTabs
            className={cn(
              "mx-auto box-content flex gap-2 px-4 py-3 print:hidden",
              readWidth,
            )}
            state={{
              layer,
              parallel,
              cols: parallelCols,
              wordLinks:
                wordLinksNow && shown.some((e) => e.language === "pli"),
            }}
            commentary={commentary}
            commentaryOnly={commentaryOnly}
            isDesktop={isDesktop}
            onChange={(next) => {
              setLayer(next.layer);
              setParallel(next.parallel);
              setParallelCols(next.cols);
              const linksShown =
                wordLinksNow && shown.some((e) => e.language === "pli");
              if (next.wordLinks !== linksShown) {
                // 켜져 있어도 빠알리가 안 보이면 밑줄이 안 보이므로, 먼저 빠알리를 띄운다
                if (next.wordLinks) showPaliForLinks();
                if (next.wordLinks !== wordLinksNow) {
                  setWordLinksPending(next.wordLinks);
                  const value = next.wordLinks;
                  setTimeout(() => {
                    setWordLinks(value);
                    setWordLinksPending(null);
                  }, 400);
                }
              }
            }}
          />

          {layer !== "sutta" ? (
            <>
              {/* 주석서·복주석서: 경 사이를 넘기는 단추는 두지 않는다 — 위아래 이전·다음은 주석 화면이 직접 (앞 내용 · 앞뒤 경의 주석).
                  문단별로 보기에서는 앞뒤 문단으로 넘기는 이전·다음만 */}
              {focus ? navBar : null}
              <div className="px-4 pt-2 pb-6">
                <div className={cn("mx-auto w-full min-w-0", readWidth)}>
                  <CommentaryView
                    pageMarksOf={(k) => pageMarksOf.get(k)}
                    suttaId={suttaId}
                    layer={layer}
                    available={commentary.includes(layer)}
                    picked={commPicked}
                    paragraph={focus}
                    prev={prev}
                    next={next}
                    paragraphLabel={
                      focus
                        ? `${editionTitle ?? head.title} ${paragraphMark(focus)}`
                        : undefined
                    }
                    fontStyle={articleStyle}
                    onWord={(w) =>
                      setWord({
                        word: w,
                        rowKey: layer,
                        keys: [],
                        tab: "dictionary",
                        title: "",
                        pali: "",
                      })
                    }
                    rootName={rootName}
                    onGoParagraph={(p) => {
                      setLayer("sutta");
                      if (focus) openParagraph(p);
                      else
                        requestAnimationFrame(() =>
                          requestAnimationFrame(() =>
                            document
                              .getElementById(`section-${p}`)
                              ?.scrollIntoView({ block: "start" }),
                          ),
                        );
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {navBar}

              {error ? (
                <EmptyState
                  icon={CloudOff}
                  title="본문을 불러오지 못했습니다"
                  description={`${error}. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.`}
                  action={<Button onClick={retry}>다시 시도</Button>}
                />
              ) : null}

              {/* 넓은 화면에서 사전을 열면 본문 옆에 붙인다 (창을 연 채로 다른 단어를 누를 수 있게) */}
              <div className="px-4 pt-2 pb-6">
                <article
                  ref={articleRef}
                  onCopy={(e) => {
                    // 복사를 막아 둔 번역에서 이미 막았으면 그대로 둔다
                    if (e.defaultPrevented) return;
                    const sel = window.getSelection();
                    if (!sel || sel.isCollapsed || !articleRef.current) return;
                    const text = selectedCellText(
                      articleRef.current,
                      sel.getRangeAt(0),
                    );
                    if (!text) return;
                    e.preventDefault();
                    e.clipboardData.setData(
                      "text/plain",
                      `${text}\n\n${attribution(editionsIn(articleRef.current, sel.getRangeAt(0)))}`,
                    );
                  }}
                  className={cn(
                    "mx-auto flex w-full min-w-0 flex-col gap-4 print:max-w-none",
                    readWidth,
                  )}
                  style={articleStyle}
                >
                  {/* 책 첫머리 줄 (VRI 의 "Namo tassa bhagavato…") — 책의 첫 경에만, 경 문장과 따로 */}
                  {!waiting &&
                  !focus &&
                  picked.includes(VRI_ID) &&
                  texts[VRI_ID]?.preface?.length ? (
                    <p
                      lang="pi"
                      className="py-2 text-center font-pali text-sm text-secondary-foreground"
                    >
                      {texts[VRI_ID]!.preface!.join(" ")}
                    </p>
                  ) : null}
                  {waiting ? (
                    Array.from({ length: 4 }, (_, i) => (
                      <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                    ))
                  ) : focus ? (
                    parallel ? (
                      <>
                        {parallelHeader}
                        {parallelRow(
                          focus,
                          commentaryFor(focus),
                          <>
                            {headingBlock(focus)}
                            {paragraphCard(focus, true)}
                          </>,
                        )}
                      </>
                    ) : (
                      <>
                        {headingBlock(focus)}
                        {paragraphCard(focus, true)}
                      </>
                    )
                  ) : parallel ? (
                    <>
                      {parallelHeader}
                      {paragraphList.map((p) =>
                        parallelRow(
                          p,
                          commentaryRows.get(p) ?? {},
                          <>
                            {headingBlock(p)}
                            {paragraphCard(p, false)}
                          </>,
                        ),
                      )}
                    </>
                  ) : (
                    paragraphList.map((p) => (
                      <div key={p} className="flex flex-col gap-2">
                        {headingBlock(p)}
                        {paragraphCard(p, false)}
                      </div>
                    ))
                  )}
                </article>
                {/* 경 맨 아래: 이전·다음 경 (문단 보기에서는 감춘다) */}
                {!waiting && !focus ? (
                  <div
                    className={cn(
                      "mx-auto mt-8 flex w-full min-w-0 flex-col gap-6",
                      readWidth,
                    )}
                  >
                    <SuttaEndNav prev={prev} next={next} />
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
        {isDesktop && !parallel ? (
          <div className="hidden self-stretch pt-3 lg:block">
            <ReaderSide
              panel={panel}
              onPanel={(p) => setChosen({ panel: p, for: word })}
              toc={toc}
              current={focus ?? currentParagraph}
              onPick={(p) =>
                focus
                  ? openParagraph(p)
                  : document
                      .getElementById(`section-${p}`)
                      ?.scrollIntoView({ block: "start" })
              }
              word={word}
              suttaId={suttaId}
              analysisEditions={analysisEditions}
              onCloseWord={() => setWord(null)}
              parallels={parallels}
            />
          </div>
        ) : null}
      </div>

      {!isDesktop ? (
        <WordSheet
          target={word}
          suttaId={suttaId}
          analysisEditions={analysisEditions}
          onClose={() => setWord(null)}
        />
      ) : word && parallel ? (
        // 주석 나란히 보기: Digital Pāḷi Reader 처럼 화면 아래 칸 (끄면 오른쪽 칸)
        <WordBottomDock
          target={word}
          suttaId={suttaId}
          analysisEditions={analysisEditions}
          onClose={() => setWord(null)}
        />
      ) : null}

      {glossFor ? (
        <GlossDialog
          open
          title={glossFor.title}
          pali={glossFor.pali}
          suttaId={suttaId}
          keys={glossFor.keys}
          onClose={() => setGlossFor(null)}
        />
      ) : null}
      {tts.current && ttsLocked ? (
        <TtsLockOverlay
          sentence={ttsItems.find((x) => x.key === tts.current)?.text ?? ""}
          playing={tts.playing}
          onUnlock={() => setTtsLocked(false)}
        />
      ) : null}
      {tts.current ? (
        // 소리로 듣는 동안 아래에 뜨는 작은 재생 막대
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 print:hidden lg:left-60">
          <div className="flex items-center gap-1 rounded-2xl border bg-card px-2 py-1.5 shadow-lg">
            <button
              type="button"
              aria-label="앞 문장"
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-muted"
              onClick={() => {
                const i = ttsItems.findIndex((x) => x.key === tts.current);
                listenFrom(ttsItems[Math.max(0, i - 1)]?.key ?? "");
              }}
            >
              <SkipBack className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={tts.playing ? "잠시 멈춤" : "이어 듣기"}
              className="rounded-full bg-primary p-2.5 text-primary-foreground"
              onClick={() => (tts.playing ? tts.pause() : tts.resume())}
            >
              {tts.playing ? (
                <Pause className="size-4" aria-hidden />
              ) : (
                <Play className="size-4" aria-hidden />
              )}
            </button>
            <button
              type="button"
              aria-label="다음 문장"
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-muted"
              onClick={() => {
                const i = ttsItems.findIndex((x) => x.key === tts.current);
                const next = ttsItems[i + 1];
                if (next) listenFrom(next.key);
              }}
            >
              <SkipForward className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="듣기 끝내기"
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-muted"
              onClick={tts.stop}
            >
              <Square className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="화면 잠금 — 듣는 동안 잘못 눌리지 않게, 화면이 꺼지지 않게"
              title="화면 잠금"
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-muted"
              onClick={() => setTtsLocked(true)}
            >
              <Lock className="size-4" aria-hidden />
            </button>
            <span className="mx-1 h-6 w-px bg-border" aria-hidden />
            {ttsLangs.length > 1 ? (
              <div
                className="flex rounded-lg bg-muted p-0.5 text-xs"
                role="group"
                aria-label="읽을 글"
              >
                {ttsLangs.map((l) => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={ttsLang === l}
                    onClick={() => {
                      setTtsLang(l);
                      const at = tts.current;
                      if (at)
                        setTimeout(
                          () => tts.speakFrom(at, { lang: l, rate: tts.rate }),
                          0,
                        );
                    }}
                    className={cn(
                      "rounded-md px-2 py-1",
                      ttsLang === l
                        ? "bg-card font-bold text-primary shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    {l === "ko" ? "번역" : "빠알리"}
                  </button>
                ))}
              </div>
            ) : null}
            <select
              aria-label="읽는 빠르기"
              value={tts.rate}
              onChange={(e) => {
                const r = Number(e.target.value);
                tts.setRate(r);
                if (tts.current)
                  tts.speakFrom(tts.current, { lang: ttsLang, rate: r });
              }}
              className="ml-1 rounded-lg border bg-card px-1.5 py-1 text-xs"
            >
              {[0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                <option key={r} value={r}>
                  {r}배
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <SelectionToolbar
        container={getArticle}
        onCopy={(text, eds) =>
          void copy(`${text}\n\n${attribution(eds)}`, "고른 글을 복사했습니다.")
        }
        onShare={(text, eds) => {
          const url = `${window.location.origin}${suttaHref(suttaId)}`;
          const body = `${text}\n\n${attribution(eds).replace(/\n[^\n]*$/, "")}`;
          // 휴대폰만 기기 공유 창을 쓴다 — 컴퓨터(특히 윈도우) 공유 창은 멈추거나 실패하는 일이 잦아 복사로 대신한다
          const data = { title: head.title, text: `${body}\n${url}` };
          const mobile = window.matchMedia("(pointer: coarse)").matches;
          const canShare =
            mobile &&
            typeof navigator.share === "function" &&
            (!navigator.canShare || navigator.canShare(data));
          const fallback = () =>
            void copy(
              `${body}\n${url}`,
              "공유할 글을 복사했습니다. 카카오톡·메일 등에 붙여 넣으세요.",
            );
          if (!canShare) return fallback();
          try {
            navigator.share(data).catch((e: unknown) => {
              // 사용자가 공유 창을 닫은 것(AbortError)은 그냥 둔다
              if (!(e instanceof DOMException && e.name === "AbortError"))
                fallback();
            });
          } catch {
            fallback();
          }
        }}
        onHighlight={(ranges, color) => {
          for (const range of ranges) {
            addHighlight({
              suttaId,
              suttaTitle,
              editionId: range.editionId,
              key: range.key,
              start: range.start,
              end: range.end,
              color,
              text: range.text,
            });
          }
        }}
        isSaved={(key) => mine.has(key)}
        onBookmark={(key) => {
          const row = rows.find((r) => r.key === key);
          if (!row) return;
          const saved = mine.has(key);
          toggleBookmark(baseOf(row));
          toast.success(
            saved ? "책갈피를 지웠습니다." : "책갈피에 넣었습니다.",
          );
        }}
        onMemo={(key) => {
          const row = rows.find((r) => r.key === key);
          if (row) setMemoRow(row);
        }}
        onListen={tts.supported ? (key) => listenFrom(key) : undefined}
      />
      {hlMenu ? (
        <HighlightMenu
          at={hlMenu}
          onColor={(c) => {
            recolorHighlight(hlMenu.id, c);
            setHlMenu(null);
          }}
          onRemove={() => {
            removeHighlight(hlMenu.id);
            setHlMenu(null);
          }}
          onClose={() => setHlMenu(null)}
        />
      ) : null}

      <MemoDialog
        open={memoRow !== null}
        label={memoRow ? rowLabel(memoRow.key) : ""}
        initial={memoRow ? (mine.get(memoRow.key)?.memo ?? "") : ""}
        onSave={(memo) => {
          if (memoRow) setMemo(baseOf(memoRow), memo);
          toast.success(
            memo.trim() ? "메모를 저장했습니다." : "메모를 지웠습니다.",
          );
        }}
        onClose={() => setMemoRow(null)}
      />

      <EditionPickerSheet
        open={sheet === "editions"}
        onOpenChange={(o) => setSheet(o ? "editions" : null)}
        editions={editions}
        shownIds={shownIds}
        onToggle={togglePick}
        commentary={
          commentary.length
            ? {
                editions: commEditions,
                shownIds: commPicked,
                onToggle: toggleCommPick,
              }
            : undefined
        }
        commentaryFirst={false}
      />
      <TocSheet
        open={sheet === "toc"}
        onOpenChange={(o) => setSheet(o ? "toc" : null)}
        title={head.title}
        items={toc}
        onPick={(p) => {
          setSheet(null);
          document
            .getElementById(`section-${p}`)
            ?.scrollIntoView({ block: "start" });
        }}
      />
      <TextSettingsSheet
        open={sheet === "text"}
        onOpenChange={(o) => setSheet(o ? "text" : null)}
        onWordLinksOn={showPaliForLinks}
      />
    </div>
  );
}

/** 문단 번호 표시: sn56.11:2 → 2, sn56.11:2.3 → 2.3, 게송(dhp5) → Dhp 5 */
/** VRI 번호가 게송 번호인 책 (게송으로 된 책) — 나머지는 문단 번호 */
const VERSE_BOOKS = /^(dhp|snp|thag|thig|ja|vv|pv|tha-ap|thi-ap|bv|cp)\d/;

function paragraphMark(paragraph: string): string {
  const colon = paragraph.indexOf(":");
  // 게송(dhp5)은 원래 앱처럼 번호만
  return colon >= 0
    ? paragraph.slice(colon + 1)
    : paragraph.replace(/^[a-z-]+/, "");
}

/** 게송 번호 표시: dhp5 → Dhp 5 */
function unitLabel(unit: string): string {
  return unit.replace(
    /^([a-z-]+)/,
    (letters) => `${letters[0].toUpperCase()}${letters.slice(1)} `,
  );
}
