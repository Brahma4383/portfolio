import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths, so the built site works from any folder or subpath
  // (GitHub Pages, Netlify, a plain static host).
  base: './',
  build: {
    chunkSizeWarningLimit: 900,
    // keep licence notices (/*! … */, @license) in the minified files: the bug
    // radar's React Bits licence asks for its notice to stay with the code
    rolldownOptions: {
      output: { comments: { legal: true } },
    },
  },
})
