/** @type {import('next').NextConfig} */

// Repo-based base path for GitHub Pages. The repo is `PBL`, so the site is
// served from https://<user>.github.io/PBL/. We gate this on an env flag so
// local dev (`npm run dev`) still works at the root.
const isPagesBuild = process.env.GITHUB_PAGES === "true";
const repoName = "PBL";

const nextConfig = {
  reactStrictMode: true,
  // Static export — GitHub Pages serves the generated `out/` directory.
  output: "export",
  // Avoid trailing-slash quirks on Pages static hosting.
  trailingSlash: true,
  // GitHub Pages does not run the Next.js image optimizer.
  images: { unoptimized: true },
  // Prefix assets and routes when deploying to /PBL/.
  basePath: isPagesBuild ? `/${repoName}` : "",
  assetPrefix: isPagesBuild ? `/${repoName}/` : "",
  env: {
    NEXT_PUBLIC_BASE_PATH: isPagesBuild ? `/${repoName}` : "",
  },
};

export default nextConfig;
