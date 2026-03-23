import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** jsdom → html-encoding-sniffer → ESM 전용 의존성: 번들에 넣으면 Vercel에서 ERR_REQUIRE_ESM 발생 */
  serverExternalPackages: ["jsdom"],
};

export default nextConfig;
