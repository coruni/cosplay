import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Allow Next/Image to optimize images served from S3-compatible storage.
// Parses the public URL from NEXT_PUBLIC_S3_PUBLIC_URL (set in .env).
const s3PublicUrl = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
const s3RemotePatterns = (() => {
  if (!s3PublicUrl) return [];
  try {
    const u = new URL(s3PublicUrl);
    return [
      {
        protocol: u.protocol.replace(":", "") as "http" | "https",
        hostname: u.hostname,
        ...(u.port ? { port: u.port } : {}),
      },
    ];
  } catch {
    return [];
  }
})();

const nextConfig: NextConfig = {
  allowedDevOrigins:['774f832a.r21.cpolar.top'],
  // 产出自包含部署包：.next/standalone 含 node server + 仅必要的 node_modules，
  // 配合 .next/static 和 public/ 拷贝即可独立运行（适合 Docker / 最小镜像）。
  output: "standalone",
  ...(s3RemotePatterns.length > 0
    ? { images: { remotePatterns: s3RemotePatterns } }
    : {}),
};

export default withNextIntl(nextConfig);
