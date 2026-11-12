# 이 폴더의 규칙 — Codex가 자동으로 읽는 파일

이 폴더는 **초기불교경전 (Theravāda Tipiṭaka)** — 빠알리 원문과 여러 번역을 문장마다 나란히 놓고 읽는 앱이다.
서버 없이 정적 파일로 동작하며, 원래 앱(theravada-application.vercel.app)의 자료 구조를 그대로 읽는다.
사용자는 코드를 읽지 못할 수 있다. 보고는 한국어로, 전문 용어 없이, 한 번에 하나씩 한다.
결정이 필요하면 선택지 2~3개로 좁혀서 묻는다.

## 먼저 읽을 것

- [README.md](./README.md) — 쓰는 법, 명령, 폴더
- [자료-넣는-법.md](./자료-넣는-법.md) — 자료 구조와 검사 결과 읽는 법
- [MASTER-PLAN.md](./MASTER-PLAN.md) — 설계 기록: 3층 구조, 아키텍처 규칙, 지금까지의 결정
- [design/DESIGN.md](./design/DESIGN.md) — 디자인 규칙 (파랑 하나, 토큰 색만, 글자 위계)

## 항상 지킬 것

- **데이터는 한 길로만.** 원본 `content/` → `scripts/build-content.ts`(검사) → `public/data/`·`src/data/` → `src/lib/data.ts`(목록)·`src/lib/content.ts`(본문·사전·검색). 화면에서 다른 곳을 fetch 하지 않는다.
- **JSON 은 zod 로 검사한다.** 타입 단언(as)으로 넘기지 않는다.
- **원문·번역은 HTML 로 해석하지 않는다.** `dangerouslySetInnerHTML` 금지 — 굵게·기울임·각주는 `parseInline` 의 글자 조각으로.
- **경 주소는 `suttaHref()` 로만 만든다** (sn1.1 처럼 점이 든 번호 때문에 끝에 / 가 필요하다).
- 변환 규칙(`scripts/source-paths.ts` 의 파일 위치 등)은 원래 앱과 같아야 한다.
- 고친 뒤에는 `pnpm typecheck && pnpm test && pnpm lint` 와 `pnpm build` 를 통과시킨다.
- **번역문·사전 자료는 저작권자가 따로 있다.** 이용 허락을 확인하기 전에는 Git 저장소나 인터넷에 올리지 않는다 (`content/`·`public/data/` 는 .gitignore).
- `design/` 은 원본이라 읽기만 한다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
