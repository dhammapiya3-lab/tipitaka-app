// 완성된 앱(out/)을 이 컴퓨터에서 여는 작은 서버. 서버 프로그램 없이 파일만 내보낸다.
// 사용법: pnpm serve   →  http://localhost:4321  (포트를 바꾸려면 PORT=5000 pnpm serve)
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "out");
const PORT = Number(process.env.PORT ?? 4321);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

function send(res, status, file) {
  res.writeHead(status, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const file = path.join(ROOT, decodeURIComponent(url.pathname));
  // out/ 밖의 파일은 내보내지 않는다.
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  if (await isFile(file)) return send(res, 200, file);
  // 화면 안 이동 때 Next 가 sn1.1 처럼 점이 든 주소의 자료를 /sutta/sn1.1.txt 로 찾는다.
  // 실제 파일은 경 폴더 안(sutta/sn1.1/index.txt)에 있으니 그것을 내보낸다.
  if (url.pathname.endsWith(".txt")) {
    const inFolder = path.join(file.slice(0, -".txt".length), "index.txt");
    if (await isFile(inFolder)) return send(res, 200, inFolder);
  }
  // 페이지는 폴더/index.html 이다. /sutta/dn22 → /sutta/dn22/ 로 보낸다.
  if (await isFile(path.join(file, "index.html"))) {
    if (!url.pathname.endsWith("/")) {
      res.writeHead(308, { location: `${url.pathname}/${url.search}` }).end();
      return;
    }
    return send(res, 200, path.join(file, "index.html"));
  }
  send(res, 404, path.join(ROOT, "404.html"));
}).listen(PORT, "127.0.0.1", () => {
  console.log(`초기불교경전이 열렸습니다 → http://localhost:${PORT}  (끄려면 이 창을 닫으세요)`);
});
