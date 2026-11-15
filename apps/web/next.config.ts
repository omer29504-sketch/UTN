import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@utn/shared", "@utn/storage"],
  // tesseract.js loads its WASM worker at runtime; keep it out of the bundle.
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
