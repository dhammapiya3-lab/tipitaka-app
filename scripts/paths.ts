/**
 * 변환 프로그램이 읽는 원본 자료의 위치. 모두 앱 폴더 안 content/ 기준이다.
 *   content/theravada-app/  원래 앱의 /data/ 와 같은 구조 (경·번역·각주·대역·판본 정보, K-PTS 사전)
 *   content/dpd/dpd.db      DPD 공식 배포본 (사전을 새로 만들 때만 필요)
 *   content/epitaka.db      E-Piṭaka DB — PTS·미얀마 사전 (사전을 새로 만들 때만 필요)
 * 다른 곳에 두었으면 환경 변수로 바꿀 수 있다 (예: CONTENT_SOURCE=E:/자료 pnpm build:content).
 */
import path from "node:path";

const CONTENT = process.env.CONTENT_DIR ?? path.join(process.cwd(), "content");

export const SOURCE_ROOT = process.env.CONTENT_SOURCE ?? path.join(CONTENT, "theravada-app");
export const DPD_DB = process.env.DPD_DB ?? path.join(CONTENT, "dpd", "dpd.db");
export const EPITAKA_DB = process.env.EPITAKA_DB ?? path.join(CONTENT, "epitaka.db");
export const KPTS_DB =
  process.env.KPTS_DB ?? path.join(SOURCE_ROOT, "dictionary", "korean-pali", "dictionary.sqlite");
