import adapter from "@sveltejs/adapter-static";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";

// GitHub Pages serves the site under /<repository name>, passed in as BASE_PATH
// by .github/workflows/pages.yml. The dev server always serves it at the root.
const basePath = process.env.BASE_PATH ?? "";
const isBasePath = (path: string): path is `/${string}` => path.startsWith("/");

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      adapter: adapter(),
      paths: {
        base: process.argv.includes("dev") || !isBasePath(basePath) ? "" : basePath,
      },
    }),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
      strategy: ["cookie", "globalVariable", "preferredLanguage", "baseLocale"],
    }),
  ],
  test: { include: ["tests/unit/**/*.test.ts"] },
});
