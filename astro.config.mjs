// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // TODO: replace with the real domain once one is chosen — required for
  // the sitemap and for absolute canonical/OG URLs to be correct.
  site: 'https://example.com',
  integrations: [sitemap()]
});