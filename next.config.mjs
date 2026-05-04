import { execSync } from "child_process";

function git(cmd) {
  try { return execSync(cmd, { encoding: "utf8" }).trim(); }
  catch { return "local"; }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BUILD_SHA:  git("git rev-parse --short HEAD"),
    NEXT_PUBLIC_BUILD_TIME: git("git rev-list --count HEAD"),
  },
};

export default nextConfig;
