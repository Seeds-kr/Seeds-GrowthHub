// Seeds GrowthHub 프리뷰 라우터. 공개 사이트 전체가 이 파일을 지난다.
//
// seeds-router.service 는 ~/seeds-preview/router.mjs 를 실행하는데, 그건 이 파일로 가는
// 심볼릭 링크다(backup.sh 와 같은 방식). 2026-11-11 까지는 레포에 없는 복사본이라
// 고쳐도 기록이 남지 않았다. 고친 뒤에는 `sudo systemctl restart seeds-router` 를 해야
// 반영된다 — 노드는 시작할 때 한 번 읽는다.
//
// Replit 배포에서는 플랫폼 라우터가 이 역할을 한다(.replit의 deployment.router).
// 로컬에는 그게 없고 api-server는 static을 서빙하지 않으므로, 같은 오리진에서
// /api 는 api-server 로, 나머지는 빌드된 SPA 로 보내는 얇은 층이 필요하다.
// 프론트의 api() 헬퍼가 `${BASE_URL}api` 즉 상대경로를 쓰기 때문에 반드시 동일 오리진이어야 한다.
//
// 127.0.0.1 에만 바인딩한다. 외부 노출은 cloudflared 터널이 담당하며,
// 그래야 호스트 포트를 인터넷에 열지 않아도 된다.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = "/home/harvester/Seeds-GrowthHub/artifacts/seeds/dist/public";
const API = { host: "127.0.0.1", port: 8087 };
const PORT = Number(process.env.ROUTER_PORT ?? 8088);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".map": "application/json; charset=utf-8",
};

const server = http.createServer((req, res) => {
  // This preview serves the club's REAL mentor roster (mentor-seed.ts seeds
  // actual names, job titles and affiliations with is_public=true, and
  // GET /api/people/:kind serves those anonymously). Those people did not agree
  // to appear on a personal domain, and Cloudflare serves its own robots.txt so
  // the origin cannot override it — the header is the reliable signal.
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");

  // Origin-served robots.txt in case the managed one is ever turned off.
  if (req.url === "/robots.txt") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("User-agent: *\nDisallow: /\n");
    return;
  }

  if (req.url.startsWith("/api")) {
    const upstream = http.request(
      {
        ...API,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${API.port}` },
      },
      (up) => {
        res.writeHead(up.statusCode, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", (e) => {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end(`api-server 연결 실패: ${e.message}`);
    });
    req.pipe(upstream);
    return;
  }

  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(ROOT, urlPath);

  // Directory traversal guard — the tunnel makes this reachable from outside.
  // Compared against ROOT + separator, not bare ROOT: a bare prefix check also
  // accepts a sibling like `<root>-evil`.
  const resolved = path.resolve(file);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { "content-type": "text/plain" });
    res.end("forbidden");
    return;
  }

  // SPA fallback: wouter routes are client-side, so any non-asset path has to
  // return index.html rather than 404.
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(ROOT, "index.html");
  }

  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      // Hashed asset filenames are immutable; index.html must not be cached or
      // a redeploy keeps serving the old bundle.
      "cache-control": ext === ".html" ? "no-store" : "public, max-age=3600",
    });
    res.end(buf);
  });
});

server.listen(PORT, "127.0.0.1", () =>
  console.log(`seeds preview router → http://127.0.0.1:${PORT}`),
);
