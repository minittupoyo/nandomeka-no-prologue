// @ts-check
import { satteri } from "@astrojs/markdown-satteri";
import { defineConfig } from "astro/config";

import tailwindcss from "@tailwindcss/vite";
import expressiveCode from "astro-expressive-code";
import { satteriHardbreaks } from "./src/plugins/satteri-hardbreaks";
import { satteriLinkCard } from "./src/plugins/satteri-link-card";

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    processor: satteri({
      mdastPlugins: [satteriHardbreaks()],
      hastPlugins: [satteriLinkCard()],
    }),
  },
  integrations: [
    expressiveCode({
      styleOverrides: {
        codeFontFamily: "'JetBrains Mono Variable', monospace",
      },
      themes: ["catppuccin-frappe", "catppuccin-latte"],
    }),
  ],
  site: "https://blog.xn--j9jct3f.jp",
});
