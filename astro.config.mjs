// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import indexnow from 'astro-indexnow';

import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  integrations: [react()
        indexnow({
      key: process.env.INDEXNOW_KEY,
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
  output: 'server',
  adapter: netlify({
    edgeMiddleware: true,
  }),
});
