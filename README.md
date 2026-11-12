# 초기불교경전 (Theravāda Tipiṭaka) — 컴퓨터용

빠알리 원문과 여러 번역을 문장마다 나란히 놓고 읽는 앱입니다.
원래 앱(theravada-application.vercel.app)의 자료로, 컴퓨터에서 쓰기 편하게 다시 만들었습니다.
서버 없이 이 컴퓨터에서 열리고, 새 번역·경 자료를 직접 넣어 쓸 수 있습니다.

## 처음 쓰기 (Windows)

1. **Node.js 설치** — https://nodejs.org 에서 LTS 버전을 받아 설치합니다(한 번만).
2. **압축 풀기** — 이 폴더를 원하는 곳에 둡니다. 경로에 한글이 있어도 됩니다.
3. **`시작.bat` 더블클릭** — 처음에는 프로그램 설치와 앱 만들기로 5~15분 걸립니다.
   끝나면 브라우저에 **http://localhost:4321** 이 열립니다.
4. **끄기** — 검은 창을 닫으면 됩니다. 다음부터는 `시작.bat` 을 누르면 바로 열립니다.

> 인터넷: 앱 자체는 이 컴퓨터에서 돌지만, 처음 설치와 글꼴(Pretendard)을 받을 때 인터넷이 필요합니다.

## 자료 넣기

새 번역이나 경 자료가 생기면 **[자료-넣는-법.md](./자료-넣는-법.md)** 를 보세요.
요약: `content/theravada-app/` 에 원래 앱과 같은 구조로 파일을 넣고 → **`자료-반영.bat`** 더블클릭.
자료에 틀린 곳이 있으면 어느 경·어느 문장인지 알려 주고, 앱은 이전 상태로 둡니다.

## 기능

| 화면 | 할 수 있는 일 |
|---|---|
| 홈 | 이어 읽기(마지막 읽던 곳), 오늘의 게송(법구경, 날마다 하나), 읽을 수 있는 경 |
| 경전 목록 | 5부 니까야 → 품 → 경, "읽을 수 있는 경만 보기" |
| 경 읽기 | 판본 켜고 끄기·나란히 비교, 각주, 목차, 글자 크기·줄 간격, 인쇄 |
| 　 | 빠알리 단어를 누르면 사전 (넓은 화면은 본문 옆에 붙어 연 채로 다른 단어를 누를 수 있음), 대역 탭 |
| 　 | 문장 메뉴(⋯): 북마크, 메모, 문장 링크 복사, 원문+번역 복사 |
| 검색 | 원문·번역 전체에서 찾기 (조사가 붙어도, 빠알리는 ā·ṭ 없이 쳐도) |
| 사전 | DPD · K-PTS 한국어 · PTS 영어 · 미얀마 사전, 자판 글자로 찾기, 최근 찾은 단어 |
| 북마크 | 북마크·메모 모아 보기, 파일로 내보내기·가져오기(다른 컴퓨터로 옮기기) |

**단축키** (화면 오른쪽 위 키보드 버튼 또는 `?`):
`/` 검색 · `j` `k` 문장 고르기 · `←` `→` 단어 옮기기(문장을 안 골랐으면 앞뒤 경) · `Enter` 사전 · `b` 북마크 · `c` 복사 · `Esc` 닫기

북마크·메모·읽기 설정은 **그 컴퓨터의 브라우저에만** 저장됩니다. 다른 컴퓨터로는 북마크 화면의 내보내기·가져오기로 옮깁니다.

## 폴더

```
content/theravada-app/   ← 원본 자료 (원래 앱의 /data/ 와 같은 구조). 여기에 자료를 넣는다
public/data/             변환된 자료 (자동으로 만들어짐 — 손대지 않음)
  suttas/  경별 본문·각주·대역      search/  검색 색인      dict/  조각 사전 (미리 만들어 둠)
src/                     앱 화면 코드
scripts/                 변환 프로그램 (build-content · build-dictionary · serve)
시작.bat · 자료-반영.bat  실행 파일
MASTER-PLAN.md           설계 기록 — 무엇을 왜 이렇게 만들었는지
```

## 개발자용

Next.js 16 (정적 내보내기) · TypeScript · Tailwind CSS v4 · shadcn/ui · zustand · zod · vitest, 패키지 관리자 pnpm.

| 명령 | 하는 일 |
|---|---|
| `pnpm install` | 설치 |
| `pnpm build:content` | `content/theravada-app` → `public/data/suttas`·`search`, `src/data/catalog.json` (검사 포함) |
| `pnpm build:dictionary` | 사전 원본 → `public/data/dict` (아래 "사전 다시 만들기") |
| `pnpm dev` | 개발 서버 http://localhost:3000 |
| `pnpm build` | 정적 앱 `out/` 만들기 |
| `pnpm serve` | `out/` 을 http://localhost:4321 로 열기 |
| `pnpm test` · `pnpm typecheck` · `pnpm lint` | 시험 · 타입 검사 · 코드 규칙 |

**구조 — 3층.** 원본(`content/`) → 변환·검사(`scripts/`) → 앱이 읽는 작은 파일(`public/data/`).
화면은 서버 없이 필요한 파일만 받아 그립니다. 모든 문장은 `dn22:1.2` 같은 **문장 번호**로 원문·번역·각주·대역을 짝짓습니다.
자세한 규칙은 [MASTER-PLAN.md](./MASTER-PLAN.md), 디자인 규칙은 [design/DESIGN.md](./design/DESIGN.md).

**사전 다시 만들기 (선택).** 사전 조각은 미리 만들어 두었으므로 보통은 필요 없습니다. 새 DPD 판이 나오면:
`content/dpd/dpd.db` (https://github.com/digitalpalidictionary/dpd-db/releases 의 dpd.db.tar.xz),
`content/epitaka.db` (E-Piṭaka DB — PTS·미얀마 사전), K-PTS 는 `content/theravada-app/dictionary/korean-pali/dictionary.sqlite`
를 두고 `pnpm build:dictionary`.

## 공개 저장소와 비공개 자료 (2026-11-13)

번역문은 법보시 허락을 받아 이 저장소에 함께 둡니다. 다만 아래는 **비공개 저장소(tipitaka-private)** 에 따로 두고,
사이트를 만들 때만 합칩니다 (`.gitignore` 에 목록, 합치는 프로그램은 `scripts/fetch-private.mjs`).

- 법구경 **법현 스님** 번역 — 사이트에는 보이되 원본은 공개하지 않습니다(화면에서 복사도 막음).
- 사전 4종(DPD · K-PTS · PTS · 미얀마)은 공개 저장소에 둡니다 (2026-11-13 허락 확인).

| 어디서 만드나 | 비공개 자료를 넣는 법 |
|---|---|
| 사이트 올리는 곳(Cloudflare Pages·Vercel) | 환경 변수 `PRIVATE_REPO`(예: `이름/tipitaka-private`)와 `PRIVATE_REPO_TOKEN`(읽기 전용 토큰). 만들기 명령은 `pnpm build:site` |
| 내 컴퓨터 | 비공개 저장소를 앱 폴더 안 `.private/` 로 받아 두면 `pnpm build:site` 가 합칩니다 |
| 둘 다 없으면 | 그 판본만 빠지고 나머지는 그대로 만들어집니다 |

시험 사이트는 환경 변수 `NEXT_PUBLIC_NOINDEX=1` 로 검색 엔진에 나오지 않게 합니다.

## 이용 조건 — 공개하기 전에 꼭

- 번역문의 저작권은 각 번역자에게 있습니다. **이용 허락을 확인하기 전에는 인터넷에 공개하지 마세요.**
  원래 앱이 복사를 막은 판본(법현 스님)은 이 앱에서도 글자 선택·복사를 막았습니다.
- Digital Pāḷi Dictionary: CC BY-NC-SA 4.0 (비상업·출처 표시·같은 조건 공유) — 광고나 유료 기능을 넣지 않습니다.
- K-PTS·PTS·미얀마 사전: 사용·공개 허락 확인 (2026-11-13).
