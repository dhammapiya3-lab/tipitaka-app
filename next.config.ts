import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 없이 동작하는 정적 파일(out/)로 빌드한다.
  output: "export",
  // 경마다 폴더(sutta/sn1.1/index.html)로 만든다. sn1.1 처럼 점이 든 주소를
  // 정적 서버가 파일 확장자(.1)로 착각하지 않게 하기 위해서다.
  trailingSlash: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
