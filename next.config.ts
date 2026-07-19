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
  ...(s3RemotePatterns.length > 0
    ? { images: { remotePatterns: s3RemotePatterns } }
    : {}),
};

export default withNextIntl(nextConfig);
