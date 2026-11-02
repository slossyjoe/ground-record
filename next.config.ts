import type { NextConfig } from "next";

// Empty for local `next dev`. The Pages workflow sets this to /ground-record.
function pagesBasePath(value: string | undefined): string {
  const trimmed = (value || "").trim().replace(/\/$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

const basePath = pagesBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

const nextConfig: NextConfig = {
  output: "export",
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  trailingSlash: true,
  transpilePackages: ["maplibre-gl", "milsymbol"],
  images: { unoptimized: true },
};

export default nextConfig;
