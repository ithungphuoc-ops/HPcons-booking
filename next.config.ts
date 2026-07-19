import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin -> jwks-rsa kéo theo jose bản ESM-only (6.x), làm crash
  // ERR_REQUIRE_ESM trên Vercel. Đã ghim jose về 4.15.9 qua "overrides" trong
  // package.json (giống hpcons-portal).
  serverExternalPackages: ["firebase-admin"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
