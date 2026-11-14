# MASTER-PLAN — 초기불교경전 설계 기록

> 앱을 만들면서 정한 구조·규칙·결정을 순서대로 적은 기록이다. 지금 쓰는 법은 README.md, 자료 넣는 법은 자료-넣는-법.md.
> 아래 STEP 1~6 은 처음 만들 때의 순서이고, 맨 아래 "컴퓨터용으로 넘겨드리며"가 가장 최근 상태다.

# 만들 것

서비스 이름: **초기불교경전** / 둘째 줄 **Theravāda Tipiṭaka** (`constants.ts` 의 `SERVICE_NAME`·`SERVICE_TAGLINE` 만 바꾸면 전체가 바뀐다.)
누구나 로그인 없이 쓰는 경전 읽기 앱이다. theravada-application.vercel.app 에서 실제로 작동하는 기능을 같은 흐름으로 다시 만든다.

앱의 핵심 원리는 **문장 번호**다. 모든 문장은 `dn22:1.2` 같은 번호를 갖고, 빠알리 원문·번역·각주를 이 번호로 짝짓는다.

## 범위

| 단계 | 기능 | STEP |
|---|---|---|
| 1단계 | 홈, 5부 니까야 경전 목록, 경 읽기, 판본 선택과 문장별 비교, 각주, 글자 크기·줄 간격, 판본 정보·출처 | 1~3 |
| 2단계 | 빠알리 단어 사전 검색, 대역, 문법분석 | 4 |
| 3단계 | 오늘의 게송, 북마크 | 5 |

**만들지 않는 것:** 율장·논장·주석서·복주석서·실천·예불(원래 앱에서도 준비 중), 로그인, 회원, 서버 프로그램, 위키, 문서 관리, 킬러 모듈.

## 화면 구성

| 화면 | 경로 | 내용 |
|---|---|---|
| 홈 | `/` | 앱 소개, 경전 바로가기. 3단계에서 오늘의 게송 추가 |
| 경전 목록 | `/suttas` → `/suttas/<니까야>` | 5부 니까야 → 품 → 경. 경이 200개 넘는 니까야(SN·AN·KN)는 `/suttas/<니까야>/<묶음>` 페이지로 나눈다(한 페이지가 3MB 를 넘지 않게) |
| 경 읽기 | `/sutta/<경 번호>` | 원문·번역, 판본 선택, 각주, 이전·다음 경, 텍스트 설정 |
| 사전 | `/dictionary` | 2단계. 단어 검색, 사전 선택 |
| 북마크 | `/bookmarks` | 3단계. 이 기기에 저장 |
| 정보 | `/about` | 판본 정보, 출처, 이용 조건, 테마 |

- 모든 화면은 **고유 주소**를 갖는다. 경 주소를 복사해 보내면 같은 경이 열려야 한다. 원래 앱보다 나아지는 핵심이다.
- 목록의 경 번호는 원래 앱 자료의 형식을 따르되, 주소에는 `dn22` 형식을 쓴다(자료의 `dn.22` 는 변환 때 바꾼다).

# 데이터 구조 — 3층

```
1층 원본         앱 폴더 안 content/theravada-app/ (원래 사이트 /data/ 와 같은 폴더 구조, scripts/paths.ts)
      ↓
2층 변환         scripts/build-content.ts — 경별 파일로 정리하고 오류를 검사한다
      ↓
3층 앱이 쓰는 파일  src/data/catalog.json (목록), public/data/suttas/<경 번호>/<판본>.json (본문)
```

- 원본 폴더 구조: `edition-registry.json`(판본 정보) · `sutta_pitaka/<니까야>/structure.json`(목록) · `editions.json`(판본 목록) ·
  `sutta_pitaka/<니까야>/<판본 폴더>/<경>_<root|translation|comment>-<판본>.json`. 쿳다까 니까야는 책 폴더(`dhammapada/` 등)마다 editions.json 이 있다.
  원래 앱의 주소 구조와 같으므로 새로 받은 파일은 같은 자리에 넣고 `pnpm build:content` 만 다시 돌린다.
- 판본 표시 이름·언어·복사 허용은 원래 앱의 `edition-registry.json` 에서 읽는다. 이용 조건은 아직 모두 "확인 중"이다.
- 판본은 빠알리(`pli-ms`), 한국어(`kor-*`), 영어(`en-sujato`) 등이다. 판본 목록은 파일 이름에 박아 넣지 않고 판본 목록 자료에서 읽는다.
- 각주는 판본 파일과 별도이며 같은 문장 번호로 잇는다. 번역문의 `**42)**` 표시는 지우지 않고 각주 표시로 바꾼다.
  같은 번호의 각주가 여러 문장에 붙기도 하므로(DN 22의 71번) 각주는 **문장 번호 + 각주 번호**로 찾는다.
- `src/data/`·`public/data/` 는 저장소에 넣지 않는다. 새 컴퓨터에서는 `pnpm build:content` 와 `pnpm build:dictionary` 를 먼저 실행해야 빌드된다.
- 번역문의 HTML 태그는 화면에서 해석하지 않는다. 변환 단계에서 필요한 표시만 안전한 형식으로 바꾼다. `dangerouslySetInnerHTML` 금지.
- 문장 번호·판본 파일이 어긋나면 변환을 실패시키고 어떤 경의 어떤 문장인지 알려 준다.
- 빠른 시작을 위해 처음에 전부 받지 않는다. 경 읽기 화면은 고른 판본의 파일만 받는다.

# 기술 스택

- Next.js (App Router, src 디렉터리, TypeScript strict, `output: "export"`) · Tailwind CSS v4 · shadcn/ui (`-b base`)
- zustand (화면 상태) · zod (데이터 검증) · lucide-react (아이콘) · next-themes (테마)
- tsx (변환 스크립트 실행, dev 의존성) · vitest (순수 함수 시험) · 패키지 매니저 pnpm
- 디자인: **Renewal 디자인 시스템** — `design/DESIGN.md`(규칙) + `design/globals.css`(토큰, 그대로 복사). 글꼴 Pretendard(CDN link).

이 목록에 있는 것은 허락 없이 설치해도 된다. 그 밖의 라이브러리는 이유를 한 줄로 말하고 허락을 받는다.
Firebase·recharts 는 쓰지 않는다.

**중요**: 이 버전의 Next.js 는 학습 데이터와 다를 수 있다. 코드를 쓰기 전에 `node_modules/next/dist/docs/` 의 관련 가이드와 shadcn/ui 컴포넌트 API 를 확인한다.
`reference/` 폴더의 셸(사이드바·헤더·PageHeader)과 관용구는 읽어서 참고하되 수정하지 않는다. 로그인·위키·문서 관리·차트 코드는 가져오지 않는다.

# 아키텍처 규칙 (반드시 지킬 것)

1. **서버 없이 동작한다.** 빌드 결과(`out/`)는 정적 파일이다. API 경로, `proxy.ts`, 쿠키, 서버에서만 되는 기능을 쓰지 않는다.
2. **데이터는 한 길로만 들어온다.**
   목록: `src/data/*.json` → `src/lib/schemas.ts`(zod) → `src/lib/data.ts` → `page.tsx` → props.
   본문·사전: `public/data/**` → `src/lib/content.ts`(fetch + zod) → 클라이언트 뷰. 다른 곳에서 fetch 하지 않는다.
3. **타입 단언(as) 금지.** JSON 은 반드시 zod `parse()` 로 통과시킨다.
4. **기기 저장은 한 곳에서만.** 글자 크기·줄 간격·고른 판본·북마크는 `src/store/` 의 zustand 스토어가 localStorage 에 저장한다.
   localStorage 는 막혀 있을 수 있으므로 읽기·쓰기 실패해도 화면이 깨지지 않게 한다.
5. **원문·번역 자료를 코드에 직접 쓰지 않는다.** 화면 코드와 자료를 섞지 않는다.
6. **폴더 구조 — 아래 트리를 그대로 만든다. 여기 없는 위치에 파일을 두지 않는다.**

   ```
   scripts/build-content.ts            1층 원본 → 3층 파일 (경전 목록·본문·각주)
   scripts/build-dictionary.ts         사전 원본(SQLite) → 조각 사전 public/data/dict/
   src/
     app/
       layout.tsx                      루트: html lang="ko", 폰트, ThemeProvider, Toaster, 공통 셸
       globals.css                     design/globals.css 복사본
       page.tsx                        홈
       suttas/page.tsx                 경전 목록 (니까야 카드)
       suttas/[nikaya]/page.tsx        니까야별 목록
       suttas/[nikaya]/[group]/page.tsx  경이 많은 니까야의 묶음별 목록
       sutta/[id]/page.tsx             경 읽기 — generateStaticParams 로 모든 경 생성
       dictionary/page.tsx             사전 (2단계)
       bookmarks/page.tsx              북마크 (3단계)
       about/page.tsx                  정보
     components/
       ui/                             shadcn 생성물 — 직접 수정 금지
       layout/                         sidebar · header · nav-items · page-header · brand-mark · theme-provider · theme-toggle
       shared/                         여러 화면이 같이 쓰는 부품 — empty-state 등
       <screen>/                       화면별 폴더. 진입은 <screen>-view.tsx ("use client")
     lib/
       constants.ts                    SERVICE_NAME · 기본 설정값 · 라벨 맵
       schemas.ts                      zod 스키마 — types/ 와 1:1
       data.ts                         빌드 때 읽는 목록 자료의 유일한 진입점
       content.ts                      본문 자료를 받는 유일한 진입점
       segments.ts                     판본 합치기·문장 정렬·판본 고르기 — 화면을 모르는 순수 함수 (시험 포함)
       format.ts                       경 번호·숫자 표시
       pali.ts                         빠알리 단어 정리·조각 파일 이름 (변환 스크립트와 화면이 같이 씀)
       utils.ts                        cn() (shadcn 생성)
     store/<name>.ts                   zustand 스토어 — settings.ts 필수
     types/<domain>.ts + index.ts      도메인별 타입 + barrel
     data/*.json                       build-content 산출물 (손으로 고치지 않는다)
   public/data/                        build-content 산출물 (번역 포함 — 허락 전 커밋 금지)
   curriculum/ · reference/ · design/  앱 코드가 아니다 (tsconfig exclude)
   ```

   규약:
   - 파일명 kebab-case. 컴포넌트는 PascalCase named export, page/layout 만 default export.
   - `page.tsx` 는 서버 컴포넌트: 자료 읽기·props 전달만. 상호작용은 `<screen>-view.tsx` 이하 "use client" 에서.
   - 모든 화면은 맨 위에 `PageHeader` 를 둔다.
   - 새 화면 추가 순서: types → schemas → build-content → data.ts 또는 content.ts → components/<screen>/ → app/<screen>/page.tsx → nav-items.ts
7. 한국어 UI. 빠알리 표기는 자료에 있는 그대로 둔다(변환 스크립트가 철자를 고치지 않는다).
8. **디자인은 `design/DESIGN.md` 가 정본이다.** 색은 토큰 클래스만 쓰고 `#hex`·팔레트 색을 쓰지 않는다. 강조색은 파랑 하나.

## 디자인 적용 — 이 앱에서 달라지는 부분

- 사이드바 그룹: **경전**(홈·경전 목록·사전·북마크) / 맨 아래 **정보**. 사전·북마크 메뉴는 해당 단계에서 추가한다.
- 헤더: 테마 전환만 둔다. 프로필·로그아웃은 없다.
- 경 읽기 본문은 긴 글이라 14px 고정을 따르지 않는다. 기본 18px, 줄 간격 넉넉하게, 최대 폭 약 720px, 설정에서 조절한다.
- 판본을 비교할 때 데스크톱은 나란히, 모바일은 위아래로 쌓는다.
- 모바일이 주 사용 환경이다. 390px 폭을 우선 확인한다.
- Pretendard 에는 빠알리 글자(ā ī ū ṁ ṃ ñ ṅ ṭ ḍ ṇ ḷ)가 없다. 빠진 글자는 Noto Sans(next/font, 빌드 때 앱에 포함)가 채우고,
  빠알리 글(원문·경 이름)은 `lang="pi"` 또는 `font-pali` 로 통째로 Noto Sans 를 쓴다(한 단어 안에서 글꼴이 섞이지 않게).
- 긴 빠알리 복합어가 휴대폰 폭을 넘지 않게 본문 칸은 `wrap-anywhere` 로 줄바꿈한다.

# 작업 순서 — 각 STEP 끝에서 반드시 멈추고 보고한다

각 STEP 끝에서:
  (a) `pnpm typecheck`, `pnpm test`, `pnpm build` 통과 확인
  (b) `git add -A && git commit` 으로 단계 결과 저장 (되돌리기용)
  (c) 사용자가 브라우저에서 뭘 확인하면 되는지 1~3줄
  (d) **거기서 멈춘다.** 사용자가 "다음"이라고 할 때까지 넘어가지 않는다.

## STEP 1 — 뼈대

- 루트에 문서가 이미 있어 create-next-app 이 루트를 거부한다. **임시 폴더에 만들고, shadcn/ui 까지 그 안에서 설치한 뒤 루트로 옮긴다**:
  1. `pnpm create next-app@latest scaffold-tmp --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes`
  2. `pnpm dlx shadcn@latest init -c scaffold-tmp -b base -p nova -y --no-monorepo`
     → `pnpm dlx shadcn@latest add -c scaffold-tmp -y badge button card dialog dropdown-menu input label scroll-area select separator sheet skeleton slider sonner switch tabs textarea tooltip`
  3. `rm -f scaffold-tmp/README.md scaffold-tmp/AGENTS.md scaffold-tmp/CLAUDE.md` (루트 문서 유지) → `find scaffold-tmp -mindepth 1 -maxdepth 1 -exec mv {} . \;` → `rmdir scaffold-tmp`
- ⚠️ **shadcn init 을 루트에서 실행하지 않는다.** 루트에서 돌리면 `design/globals.css` 나 `reference/` 쪽 파일을 덮어쓸 수 있다.
  옮긴 뒤 `components.json` 의 `tailwind.css` 가 `src/app/globals.css` 인지 확인한다.
- 이 컴퓨터에서 pnpm 설치가 `readStream must be readable` 로 멈춘 적이 있다. 같은 오류면 다시 시도하고, 그래도 안 되면 `node node_modules/...` 로 도구를 직접 실행해 확인한다.
- `package.json` 의 `name` 을 `tipitaka-reader` 로, `scripts.typecheck` 를 `"next typegen && tsc --noEmit"` 로, `scripts.test` 를 `"vitest run"` 으로, `scripts.build:content` 를 `"tsx scripts/build-content.ts"` 로 등록.
- `next.config.ts` 에 `output: "export"` 를 넣는다.
- `tsconfig.json` 의 `exclude` 에 `"reference"`, `"curriculum"`, `"design"` 추가.
- `.gitignore` 에 `public/data/`, `src/data/*.json` 은 STEP 2 판단 전까지 포함한다.
- 대화형 명령은 전부 비대화형 플래그로 실행한다.
- **디자인 적용**: `src/app/globals.css` 를 `design/globals.css` 로 통째로 교체하고, `layout.tsx` 에 Pretendard link·ThemeProvider(`defaultTheme="light"`, `enableSystem={false}`)를 둔다.
- 사이드바, 헤더, PageHeader, 1단계 화면을 "PageHeader 만 있는 빈 화면"으로 만든다.
- 개발 서버(`pnpm dev`)는 백그라운드로 켜 두고, 이미 켜져 있으면 다시 켜지 않는다.
- 보고: 메뉴가 보이고, 클릭하면 화면이 바뀌고, 테마가 바뀌는지.

## STEP 2 — 자료 변환

- 먼저 DN 1, DN 22 두 경으로 만든다. 자료 종류와 건수를 표로 보여주고 승인받는다.
- `src/types/`, `src/lib/schemas.ts`, `scripts/build-content.ts`, `src/lib/data.ts`, `src/lib/content.ts` 를 만든다.
- 5부 니까야 목록 자료(`*_structure.json`)와 판본 목록(`*_editions.json`)도 변환한다. 아직 본문이 없는 경은 목록에 "준비 중"으로 표시한다.
- `lib/segments.ts` 시험을 만든다: 판본에 없는 문장, 번호 순서, 각주 연결.
- 나머지 경의 자료를 받는 일은 STEP 3 이 끝난 뒤 따로 승인받는다.
- 보고: 경 수, 문장 수, 판본별 문장 수, 변환 오류 수.

## STEP 3 — 1단계 화면

순서: 경 읽기 → 경전 목록 → 홈 → 정보.

- 경 읽기: 문장 단위 표시, 빠알리 켜기·끄기, 판본 여러 개 선택과 문장별 비교, 각주(누르면 열림), 목차, 이전·다음 경, 텍스트 설정.
- 고른 판본과 텍스트 설정은 다시 열어도 유지한다.
- 판본에 문장이 없으면 빈 칸으로 두고 앱이 멈추지 않게 한다. 자료를 못 받으면 원인을 짧게 보여 주고 다시 시도 버튼을 둔다.
- 정보 화면: 판본별 번역자·출처·이용 조건을 보여 준다. 조건을 모르는 자료는 "확인 중"이라고 쓴다.
- `design/DESIGN.md` 8장 검사를 통과시키고 라이트·다크, 390px·1280px 폭을 눈으로 확인한다.
- 보고: 화면마다 눌러볼 것 한 가지씩.

## STEP 4 — 2단계: 사전·대역·문법분석

**결정 (2026-11-03):** 원래 앱처럼 SQLite 전체(DPD 287MB)를 브라우저에 받지 않고 **조각 사전**으로 만든다.
- 원본: DPD 공식 배포본 `content/dpd/dpd.db` (GitHub dpd-db v0.4.20261026), PTS·미얀마는 `epitaka.db` 의 dictionary 표(book_id 5·1).
- `pnpm build:dictionary` → `public/data/dict/` (index.json · lookup · dpd · dpd-inflections · pts · mm). 조각이 150KB 를 넘으면 앞 글자를 한 글자씩 늘려 나눈다(`lib/pali.ts` shardOf).
- 찾는 순서: DPD "변화형 → 표제어" 표 → DPD 표제어 → 그 기본형으로 PTS·미얀마. 받는 자료는 단어 하나에 수십 KB.
- DPD 합성어 분해(deconstructor, 76MB)는 찾는 비율이 0.4%p 만 늘어 넣지 않았다.
- **추가 (2026-11-03 오후, 원래 사이트가 다시 응답):**
  - K-PTS 빠알리–한국어 사전: 원래 앱의 `dictionary/korean-pali/dictionary.sqlite`(7.5MB, 16,848항목)를 받아 조각 사전 `kpts` 로 넣었다. 처음 켜진 사전은 DPD + K-PTS.
  - 대역(nissaya): `sutta_pitaka_nissaya/` 를 받아 `build:content` 가 `public/data/suttas/<경>/<판본>.nissaya.json` 으로 바꾼다.
    원래 앱에도 법구경 일부(상가락키따 스님 1~20번 게송 품, 한국마하시 사야도 4개 품의 일부 게송)뿐이다. 단어 창의 "대역" 탭으로 보여 준다(게송 단위로 모음).
  - 문법분석(paligrammar): 원래 사이트에 DN 1·DN 22·법구경 자료가 없다(404). 본문이 있는 경이 늘어나면 같은 방식(대역 탭 옆 "문법분석" 탭)으로 붙인다.

원래 명세:

- 시작 전에 사전 자료의 크기와 받는 방법을 조사해 **선택지로 보고한다.** 원래 앱의 사전 자료는 287MB 라 사용자가 처음에 통째로 받게 만들지 않는다.
- SQLite 를 브라우저에서 쓰는 라이브러리가 필요하면 이유를 말하고 허락을 받는다.
- 경 읽기에서 단어를 누르면 사전을 연다. 사전은 DPD, PTS, K-PTS 빠알리–한국어, Tipiṭaka Pāḷi–Myanmar 를 고를 수 있다.
- 대역·문법분석은 자료가 있는 문장에서만 보여 주고, 없으면 "이 문장의 자료가 없습니다"라고 쓴다.
- DPD 표시에 출처와 CC BY-NC-SA 4.0 을 밝힌다. 이 조건은 상업적 이용을 막으므로 앱에 광고나 유료 기능을 넣지 않는다.
- 보고: 단어 하나를 눌러 찾는 데 걸린 시간과 처음 받는 자료의 크기.

## STEP 5 — 3단계: 오늘의 게송·북마크

**결과 (2026-11-03):**
- 원래 사이트 자료는 `scripts/fetch-from-site.mjs` 로 받는다(사이트와 같은 폴더 구조, 이미 받은 파일은 건너뜀).
  원본 폴더를 사이트 구조(`theravada-app/sutta_pitaka/…`, `edition-registry.json`)로 옮겼고, 판본 정보는 손으로 적은 파일 대신 원래 앱의 것을 쓴다.
- 법구경 26품(판본 6개)이 들어와 경 읽기로도 열린다. 게송 번호(Dhp 5)와 일화 제목을 원래 앱과 같은 규칙(`lib/segments.ts` rowKind)으로 표시한다.
- DN 1 한국어 번역은 원래 앱에도 없다(판본 목록에만 있고 파일은 빠알리·영어뿐).
- 원래 자료 문제는 경고로만 알린다: 문념 스님 273~289 각주 파일 깨짐(각주 3개 뺌), 오원탁 각주 파일의 201:4 칸에 본문 한 줄, PTS 판본 375번 게송 6줄.
- 원래 앱이 복사를 막은 판본(`allowCopy: false`, 법현 스님)은 글자 선택을 막는다.
- 북마크는 `store/bookmarks.ts`(이 기기 저장), 오늘의 게송은 날짜마다 1~423번을 차례로(`lib/format.ts` dailyNumber).

원래 명세:

- 오늘의 게송: 법구경에서 날짜별로 게송 하나를 고른다. 같은 날에는 같은 게송을 보여 준다.
- 북마크: 문장 단위로 저장하고 `/bookmarks` 에서 다시 열 수 있다. 이 기기에만 저장된다고 화면에 알린다.
- 보고: 게송과 북마크를 확인할 방법.

## 시험 공개 (2026-11-03, 나중에 지울 것)

- Firebase 프로젝트 `tipitaka-reader-test` (holdmenowww@gmail.com 계정, 무료 요금제), 주소 https://tipitaka-reader-test.web.app
- 로그인 없이 링크로 열린다. 번역 이용 허락 전이라 검색 엔진 제외(`layout.tsx` robots, `firebase.json` X-Robots-Tag).
- 다시 올리기: `pnpm build` → `firebase deploy --only hosting`
- 지우기: 사이트만 내리기 `firebase hosting:disable --project tipitaka-reader-test`,
  프로젝트째 지우기는 Firebase 콘솔 → 프로젝트 설정 → 프로젝트 삭제 (30일 뒤 완전 삭제).
- 정식 공개 때는 아래 STEP 6 을 따르고, robots·X-Robots-Tag 검색 제외를 지운다.

## STEP 6 — 인터넷 공개

사용자가 "공개해줘"라고 할 때만 진행한다.

0. **먼저 확인한다**: ① 번역 판본별 이용 허락 ② 사전 자료 이용 조건 ③ 앱 이름 ④ 사용할 호스팅과 비용. 하나라도 비면 공개하지 않고, 허락받지 못한 판본은 빼는 방법을 제안한다.
1. 호스팅은 정적 파일을 올릴 수 있는 곳 중에서 자료 크기와 사용량을 계산해 2~3개로 좁혀 제안한다.
2. `pnpm build` 결과 `out/` 을 올린다. 번역 자료를 공개 Git 저장소에 넣지 않는다.
3. 공개 후 확인: 홈 열기, 경 주소 직접 열기, 판본 바꾸기, 없는 주소, 휴대폰 화면.
4. 결과 표와 주소를 보고한다.

# 운영 모드 (프로젝트가 이미 있을 때)

- 요청을 처리한 뒤 `pnpm typecheck && pnpm test && pnpm build` 통과를 확인하고 커밋한다.
- 새 화면·자료는 위 "새 화면 추가 순서"를 따른다. 구조를 바꾸지 않는다.
- 주석서 연결 요청이 오면 먼저 `D:\mskim\epitaka-db\prototype\reports\주석연결_검수표_DN22.xlsx` 의 검수 결과가 있는지 확인한다. 검수 전에는 문장별 주석을 공개 화면에 넣지 않는다.

# 컴퓨터용으로 넘겨드리며 (2026-11-04)

원래 앱 제작자가 "PC 로 보기에 이 버전이 편하다"고 해서, 직접 자료를 넣어 쓸 수 있는 컴퓨터용으로 정리했다.

**구조**
- 원본 자료는 앱 폴더 안 `content/` (위치는 `scripts/paths.ts`, 환경 변수로 바꿀 수 있음). 원래 앱의 /data/ 를 통째로 복사해 넣으면 된다.
- 경 번호 → 파일 위치는 원래 앱 코드와 같은 규칙(`scripts/source-paths.ts`, 시험 포함): sn1/sn1.1, an1/an1.1-10, vagga1/ud1.1 …
- 경 주소는 폴더 방식(`trailingSlash`) — sn1.1 처럼 점이 든 번호를 정적 서버가 확장자로 착각하지 않게. 링크는 `suttaHref()` 한 곳에서.
  Next 는 점이 든 주소에서 끝 / 를 떼고 화면 안 이동 자료를 `/sutta/sn1.1.txt` 로 찾는다 → `scripts/serve.mjs` 가 `sutta/sn1.1/index.txt` 로 찾아 준다.
  (Firebase 시험 공개에서는 이 경우 페이지를 통째로 다시 불러온다 — 동작은 한다.)
- 실행: `시작.bat`(설치·빌드가 없으면 하고 `scripts/serve.mjs` 로 http://localhost:4321), `자료-반영.bat`(build:content → build → 열기).

**더한 기능**
- 경 본문 검색: 언어별 "단어 → 경|판본 → 문장" 색인을 앞글자별 조각으로(`src/lib/search.ts`, build:content 가 만듦). 앞부분 일치, 여러 단어는 같은 문장.
- 빠알리 자판 없이 찾기: `foldPali`(ā→a …). 사전에 fold 색인, 검색 색인은 처음부터 기호를 뗀 글자.
- 사전 칸: 1024px 이상은 본문 옆에 붙음(연 채로 다른 단어), 좁으면 드로어.
- 문장 메뉴(북마크·메모·링크 복사·원문+번역 복사), 키보드로 읽기(j/k, ←/→, Enter, b, c, Esc, /, ?), 이어 읽기, 인쇄.
- 북마크 내보내기·가져오기(`src/lib/bookmark-file.ts`), 경전 목록 "읽을 수 있는 경만", 최근 찾은 단어.
- 원래 사이트에서 맛지마·상윳따 일부를 받아 읽을 수 있는 경 415개.

**원래 자료에서 찾은 것 (변환 검사)**
- 맛지마 119경 현음 스님 각주는 번호를 `**17**`(괄호 없음)로 적음 → 두 형식 모두 읽게 함.
- 앙굿따라 니까야, 법구경 밖의 쿳다까 니까야는 원래 앱에도 번역 자료가 없음.

# 폰·컴퓨터 하나의 앱으로 (2026-11-13~)

원래 앱(theravada-application, 폰 중심)과 이 앱을 **하나로 합친다.** 이 앱을 기준으로 삼고, 완성되면 원래 앱 주소에 바꿔 올린다.

**결정**
- 저장소: 공개 `dhammapiya3-lab/tipitaka-app`(코드·허락받은 번역·사전 4종), 비공개 `dhammapiya3-lab/tipitaka-private`(법구경 법현 스님 번역만). 합치기는 `scripts/fetch-private.mjs`, 만들기 명령은 `pnpm build:site`.
- 임시 사이트: Cloudflare Pages https://tipitaka-app.pages.dev (환경 변수 `NEXT_PUBLIC_NOINDEX=1` 로 검색 제외, `NODE_VERSION=24`, `PRIVATE_REPO`, `PRIVATE_REPO_TOKEN`).
- 디자인: Renewal 규칙을 그대로 쓰되 **강조색만 호박색**(원래 앱의 색). 값은 `src/app/globals.css`.
- 폰: 아래쪽 탭 막대, 번역 대조는 번갈아 보기만, 분석은 아래에서 올라오는 창. 컴퓨터: 왼쪽 메뉴, 번갈아/칸 나란히 설정, 분석 칸 본문 옆.
- 원래 앱에서 옮겨 올 것: 문법분석 탭, 문단 대역·문법분석 배지(누르면 문단 전체, 문장을 누르면 그 문장만).
- 법현 스님 본: 사이트에는 보이되 복사·저장을 막는다(문장 메뉴 복사·인쇄·검색 미리보기에서 빼기 등).
- 그다음: 기본 원문을 VRI본으로 옮기고(빌랄라 참조의 msdiv = VRI 문단번호로 대응표), 주석서·복주석서 3단 화면을 붙인다.

**순서** ① 임시 사이트(완료) → ② 호박색 · 폰 탭 막대 · 문법분석·배지 · 법현 스님 본 보호 → ③ VRI 이전(SN 56.11 시범) → ④ 주석서 화면

## ② 끝남 (2026-11-13)
- 호박색, 폰 아래쪽 탭 막대(`bottom-tab-bar.tsx`, 메뉴는 `NAV_GROUPS` 하나로)
- 문법분석: `sutta_pitaka_paligrammar` → `.grammar.json` (대역과 같은 모양, `AnalysisKind`)
- 문단 배지: 문단 = `paragraphOf()` (게송이면 게송, 아니면 문장 번호의 마지막 숫자를 뗀 것). 배지 → 문단 전체, 문장 누르기 → 그 문장만
- 법현 스님 본: 자료 파일 감싸기(`src/lib/seal.ts`, 암호 아님), 검색 색인·북마크 미리보기·인쇄에서 뺌, 복사 단축키 막음. 오프라인 저장 기능이 생기면 그때도 빼야 함
- 남은 자료 일: 문법분석 자료(SN 56.11)와 상윳따 한국어 번역들이 아직 content 에 없음 — 원래 사이트에서 받아 넣어야 함
  (주의: 사이트에 짧은 시간에 요청을 수천 번 보내면 Vercel 이 그 컴퓨터를 잠시 막는다 — 2026-11-13 실제로 막혔다가 풀림. 천천히 받을 것)

## 원본 자료와 검수 (2026-11-13)
- 원래 앱의 자료 원본은 사용자 컴퓨터 `Dropbox\data\data` (원래 앱의 /data 와 같은 구조, 율장·논장·주석서 폴더도 있음). 앞으로 자료는 여기서 가져온다 — 원래 사이트에서 받지 않는다.
- `pnpm verify:content`: 사이트에 올라갈 자료(public/data/suttas)를 원본(content/)과 문장마다 글자 비교. build-content 와 따로 짠 검사라 변환 실수가 드러난다.
- ③ VRI 이전 때 마하상기띠본(pli-ms)은 지우지 않는다 — VRI본과 나란히 대조할 수 있게 둘 다 판본으로 둔다 (사용자 요청 2026-11-13).

## 경 화면은 페이지 하나로 (2026-11-13)
- 원본 전체(경 5,725개)를 넣자 사이트 파일이 47,032개 → Cloudflare Pages 무료 한도(2만 개) 초과. 경마다 페이지 5개씩 미리 만들던 것이 28,625개였다.
- 바꿈: 경 화면은 `/sutta/?id=<경>` 페이지 하나(`SuttaReader`)가 `public/data/sutta-index.json`(압축 76KB, 한 번만 받음)에서 경을 찾아 그린다. 옛 주소 `/sutta/<경>/` 는 `public/_redirects` 가 넘긴다. → 18,415개.
- 남은 파일 예산: 본문 9,420 · 사전 조각 5,381 · 검색 조각 1,622 · 목록 묶음 페이지 1,925. 율장·논장·주석서를 넣기 전에 줄일 곳: 목록 묶음 페이지도 ?group= 페이지 하나로, 사전 조각 크기 키우기, 한 경의 판본 파일 합치기.
- 율장·논장(원본 Dropbox `vinaya_pitaka`·`abhidhamma_pitaka`)도 나중에 게시한다. 번역이 없는 동안은 숨긴다(사용자 결정 2026-11-13). 아직 content 로 가져오지 않음 — 가져올 때 공개 저장소에 둬도 되는지 먼저 묻는다.

## 디자인 방향 제안 (2026-11-13, 사용자 검토 중)
- 지금 앱(theravada-application)의 부드러운 느낌을 잇는 제안: 호박색 띠 머리, 따뜻한 미색 바탕(#F6F3EE), 모서리 22 카드·옅은 그림자, 빠알리 명조(Noto Serif). 디자인 캔버스 "초기불교경전 — 부드러운 디자인 제안".
- 아래 메뉴(사용자 결정 2026-11-13): 홈 · 경전 · 서적 · 실천 · 예불. 서적은 경전과 같은 권위로 보이지 않게 경전 안이 아닌 따로 한 칸. 경전 화면 위는 경장 · 율장 · 논장(율·논은 번역 전까지 숨김). 검색은 경전 위, 내 서재는 홈 오른쪽 위.
- 사전(사용자 결정 2026-11-13): 홈·경전·서적·경 읽기 화면 오른쪽 위에 사전 단추를 늘 둔다(사전 화면으로). 컴퓨터는 왼쪽 메뉴에 '사전'. 경 읽기 중 단어 찾기는 풀이 창의 사전 탭.
- 서적(사용자 결정): 아래 메뉴의 '서적' 칸 — 테라와다불교 법보시 도서를 쪽 단위로 읽기. 참고 dhammadana.kr/read/DL-0022 (상아빛 바탕, 쪽 표시, 장 이동, 화면 모드 4가지, 기기에 저장).

## 디자인 적용 1차 (2026-11-13)
디자인 제안(부드러운 햇살)을 임시 사이트에 옮김. 세련되게 다듬는 가·나·다 안은 아직 고르기 전이라 넣지 않음.
- 바탕 상아빛 #f6f3ee, 카드 둥글게(20)·부드러운 그림자, 빠알리는 명조(Noto Serif)
- 맨 위 호박색 띠: 이름 + 검색·사전·내 서재 단추 (폰·컴퓨터 같은 자리)
- 주 메뉴 5칸 홈·경전·서적·실천·예불 — 폰은 아래 탭 막대, 컴퓨터는 왼쪽 메뉴(글자 크게). 서적·실천·예불은 "준비 중" 페이지
- 홈: 오늘의 경전 → 지금 읽을 수 있는 경(니까야 5칸, 한국어 번역 경 수) → /readable/<니까야>/ 에서 경 단위 목록
- 경전: 경장 5부 니까야 + 주석문헌(법구경 이야기 DhpA·청정도론 Vism, 준비 중). 율장·논장은 번역이 생기면
- 경 읽기: 위치 줄(경전 › 니까야 › 품 › 상윳따, sutta-index.json 의 trail), 함께 볼 판본 카드(이름 전부·✓·번역자 소개),
  ¶ 번호를 누르면 문단 보기(한 문단씩 이전·다음, "전체 보기"로 보던 자리 복귀)
- 북마크 → "내 서재". 추천 경전 코스는 내용이 정해지면 내 서재 맨 아래에

## 디자인 2차 — 원래 앱 모양으로 (2026-11-13)
요청: theravada-application.vercel.app 와 같은 모양으로, 원래 앱 기능은 모두 살리고 새로 더한 기능도 없애지 않는다.
원래 앱 화면을 열어 class 값(Tailwind)을 그대로 옮김: 바탕 gray-50, 흰 카드 rounded-2xl border shadow-sm, 강조 amber-700,
빠알리·본문은 Noto Serif(.pali), 나머지는 시스템 글꼴.
- 첫 단계 화면(홈·경전·서적·실천·예불·사전·검색·내 서재·정보): 호박색 띠(제목 + 작은 빠알리 이름). 아래 탭 막대는 이 화면들에서만
- 안쪽 화면(니까야·묶음·경 읽기): 연회색 머리 ← 제목 · 오른쪽 작은 단추 · 위치 줄
- 경전: 안내 글, 경·율·논 단추(율·논은 "준비 중"), 5부 니까야 카드(DN 동그라미·설명·범위), 주석 문헌(위숫디막가·법구경 이야기 준비 중)
- 니까야: ⓘ 소개 창(intro.json), 품 → 상윳따 → 경 카드를 눌러 펼침. 경 줄 ⌄ 를 누르면 판본 목록 → 판본 하나로 열기(?ed=)
  상윳따·앙굿따라·쿳다까는 맨 아래 묶음의 경 목록을 펼칠 때 불러옴(페이지 무게)
- 경 읽기: 제목 + 첫 번역 이름, 판본 선택(📖)·목차(☰)·텍스트 설정(T, 12~24px, 1.25~2.5)·사전, 위치 줄, 판본 배지(누르면 판본 정보),
  경·주석서·복주석서(준비 중), 이전·다음, 문단 카드(번호 + 대역 sky·문법분석 violet 배지).
  문단 머리를 누르면 문단 보기(제목 = 단락 제목 또는 번호, 이전·다음 = 문단). 여러 판본은 문장마다 배지(한) M))를 달아 번갈아
- 살린 새 기능: 이어 읽기, 지금 읽을 수 있는 경, 서적 탭, 테라와다불교 칸, 읽을 수 있는 경만 보기, 문장 메뉴(북마크·메모·복사),
  넓은 화면의 왼쪽 메뉴·판본 나란히·사전 옆 칸, 검색, 단축키, 어두운 화면, 법현 스님 본 보호
- 아직: 판본 정보 창의 번역자 소개 글(원래 앱의 translator_info) — 공개 허락 확인 후 가져오기

## 컴퓨터 경 읽기: 판본 나란히 + 오른쪽 칸 (2026-11-13, 추천안 가+나)
- 넓은 화면(1024px 이상)에서 판본을 여럿 고르면 칸으로 나란히(카드 위에 판본 이름 한 번). 폰은 문장마다 번갈아
- 오른쪽 칸(위아래로 내려도 붙어 있음): 목차(지금 읽는 문단 호박색) ↔ 풀이(대역·문법분석·사전). 문장·단어·배지를 누르면 풀이로
- 좁은 화면에서는 오른쪽 칸 없이 아래에서 올라오는 창
- "읽을 수 있는 경만 보기" → "한글 번역이 있는 경만 보기" (빠알리 원문은 거의 모든 경에 있어 전에는 가려지는 게 없었다)
- 홈의 "시작하기" 카드는 뺌 (요청)

## VRI 6차 결집본 · 주석서 · 복주석서 (2026-11-13, SN 56.11 시범)

- `pnpm import:vri sn56.11` (EPITAKA_DB=epitaka.db 경로) 가 E-Piṭaka DB 에서 VRI 원문·주석서·복주석서를 꺼내 `content/vri/<경>.json` 을 만든다. 이 작은 파일만 저장소에 둔다(DB 600MB 는 두지 않는다).
- VRI 원문은 판본 `pli-vri`(VRI 제6차 결집본, 배지 V)로 붙인다. VRI 한 줄을 그 줄이 시작하는 마하상기띠 문장 번호에 둔다.
- 주석서·복주석서는 `book_links` 로 이 경과 이어진 문단만. 문단마다 풀이하는 경 문단(refs)을 적어 서로 오갈 수 있다(경 문단 머리 "주석" 단추 ↔ 주석 문단 머리의 경 문단 번호).
- 출처: VRI(비영리 무료·출처 표시), E-Piṭaka(CC BY-NC 4.0) — 판본 정보 창(translator_info/pli_vri.txt)과 주석 화면 아래에 적었다.
- 다음: 법구경(Dhp ↔ DhpA) → 나머지.

## 판본 정보 창 (2026-11-13)

- 원래 앱의 `translator_info/*.txt` 를 `content/theravada-app/translator_info/` 에 두고, 변환 때 `public/data/edition-info/<판본>.json` 으로 옮긴다.
- 판본 칩과 대역·문법분석의 저자 이름 단추가 같은 창을 연다(대역·문법분석에서 열면 그 소개가 먼저).

## VRI 5부 니까야 전체 (2026-11-13)

- `pnpm import:vri --all` 로 사이트 목록의 경 전부(5,509개, E-Piṭaka 에 없는 216개 제외)를 가져왔다. 보고: `content/vri/_import-report.txt`.
- 맞춤: VRI 줄과 마하상기띠 문장을 글자 단위로 이어 읽다가 어긋나면 다음 16글자로 다시 찾는다. 약 98% 줄이 정확히 맞는다.
- 주석 범위: 연결된 주석 문단을 가까운 것끼리(60문단 이내) 묶어 가장 많이 걸린 묶음만 쓴다 (멀리 떨어진 엉뚱한 연결 제외).
- 호스팅 파일 수 한도 때문에 VRI 본문·주석은 경마다 파일을 만들지 않고 ~400KB 묶음(`public/data/vri/t-<n>.json`, `c-<n>.json`)에 모은다. 어느 묶음인지는 sutta-index 의 `vri` 칸.
- VRI 본문은 검색 색인에 넣지 않는다(빠알리 검색은 마하상기띠본으로).

## 청정도론 (Visuddhimagga) — VRI본만 (2026-11-15, 시안 가)

- `python3 -I scripts/import-vism.py <VRI XML 폴더>` (e0101n.mul.xml · e0102n.mul.xml) → `content/vri/vism1~23.json` 과 `content/theravada-app/sutta_pitaka/visuddhimagga/structure.json` (계 1–2장 · 정 3–13장 · 혜 14–23장).
- 문단 = VRI 문단 번호 (문장 번호 `vism<장>:<VRI 문단>.<줄>`). 번호 바로 앞 소제목은 `.0`, 문단 가운데 소제목·맺음 줄은 굵은 본문 줄. 산문은 문장마다, 게송은 VRI 줄 그대로.
- 마하상기띠본이 없으므로 `build-content.ts` 의 NIKAYAS 에 `vriOnly` 책으로 넣어 VRI 원문이 곧 기준 원문이 된다. 5부 니까야 카드·홈 타일에서는 뺀다(경전 화면의 "주석 문헌"에서 1장부터 연다).
- PTS 쪽 번호(SLTP)·SLTP 원문은 이용 조건이 분명하지 않아 넣지 않았다 (시안 나·다).

## 책 쪽 번호를 모든 문헌에 (2026-11-15)

- `pnpm import:pages` 가 경 본문 말고도 주석서·복주석서(줄마다, 키 `c:<책>:<문단>:<줄>`)와 청정도론·마하띠까까지 VRI XML 의 쪽 표시(P·M·T·V)를 가져온다. 경(주석) 안에서 쪽이 바뀌지 않아도 시작 쪽을 첫 줄에 붙인다.
- 수따센따 참조 번호(CC0, bilara-data `reference/pli/ms/sutta`) — `python3 -I scripts/import-sc-refs.py <bilara-data>` → `content/sc-refs.json`: PTS 문단(pts-cs), 냐나몰리 문단(nya), 스리랑카 BJT, 태국 시암·쭐라쫌끌라오·마하쭐라·다이야랏타본, 인도 날란다본. 변환 때 vri-pages 와 합친다.
- 판 이름·설명(마우스를 올리면 뜨는 글)은 `src/lib/page-marks.ts` 한 곳에. 텍스트 설정의 '책 쪽 번호'에서 켜고 끄고 판을 고른다.
- 청정도론: 본문 칸(경 칸 자리)의 단추 이름을 "주석서"로, 복주석서 칸에 마하띠까(e0103n·e0104n.att.xml). 본문 칸을 그대로 써서 주석 낱말(마하띠까 굵은 표제어를 같은 번호 문단에서 찾아 이음)·주석 나란히 보기가 된다. 마하띠까의 VRI 문단 번호 = 청정도론의 같은 번호 문단.
