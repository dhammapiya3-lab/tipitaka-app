/**
 * 비공개 자료 가져오기 — 사이트를 만들기 직전에 한 번 실행한다 (pnpm build:site 가 부른다).
 *
 * 공개 저장소에 넣지 않는 자료(법구경 법현 스님 번역, 이용 조건 확인 중인 사전)는
 * 비공개 저장소에 따로 두고, 사이트를 만들 때만 이 폴더로 복사해 합친다.
 *
 * 비공개 저장소 구조 (그대로 앱 폴더에 덮어쓴다):
 *   content/...            → 앱 폴더의 content/...
 *   public/data/dict/...   → 앱 폴더의 public/data/dict/...
 *
 * 자료를 찾는 순서:
 *   1. 환경 변수 PRIVATE_REPO(예: 이름/tipitaka-private) + PRIVATE_REPO_TOKEN(읽기 전용 토큰)이 있으면 받아 온다.
 *   2. 없으면 앱 폴더 옆의 .private/ 폴더를 쓴다 (내 컴퓨터에서 만들 때).
 *   3. 둘 다 없으면 비공개 자료 없이 만든다 — 그 판본·사전만 빠지고 나머지는 그대로다.
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const privateDir = path.join(root, ".private");
const repo = process.env.PRIVATE_REPO;
const token = process.env.PRIVATE_REPO_TOKEN;

if (repo && token) {
  rmSync(privateDir, { recursive: true, force: true });
  console.log(`비공개 자료를 받습니다: ${repo}`);
  execFileSync(
    "git",
    ["clone", "--depth", "1", `https://x-access-token:${token}@github.com/${repo}.git`, privateDir],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
}

if (!existsSync(privateDir)) {
  console.log("비공개 자료가 없습니다 — 공개 자료만으로 만듭니다.");
  process.exit(0);
}

let copied = 0;
for (const sub of ["content", path.join("public", "data", "dict")]) {
  const from = path.join(privateDir, sub);
  if (!existsSync(from)) continue;
  cpSync(from, path.join(root, sub), { recursive: true });
  copied++;
  console.log(`  합침: ${sub}`);
}
console.log(copied ? "비공개 자료를 합쳤습니다." : "비공개 저장소에 합칠 폴더가 없습니다.");
