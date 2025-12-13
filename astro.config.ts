import { defineConfig } from "astro/config";
import unocss from "unocss/astro";
import solid from "@astrojs/solid-js";
import sitemap from "@astrojs/sitemap";
import { remarkPlugins, rehypePlugins } from "./plugins";

// https://astro.build/config
export default defineConfig({
  site: "https://keir.is-a.dev",
  integrations: [solid(), unocss({ injectReset: true }), sitemap()],
  markdown: {
    remarkPlugins,
    rehypePlugins,
    syntaxHighlight: false
  }
});
