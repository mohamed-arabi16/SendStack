import { defineConfig, build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest-and-icons',
      closeBundle() {
        // Copy manifest.json to dist/
        copyFileSync('manifest.json', 'dist/manifest.json');
        // Copy icons
        if (!existsSync('dist/icons')) mkdirSync('dist/icons', { recursive: true });
        ['icon16.png', 'icon48.png', 'icon128.png', 'icon.svg'].forEach(f => {
          if (existsSync(`public/icons/${f}`)) copyFileSync(`public/icons/${f}`, `dist/icons/${f}`);
        });
        // Copy html files
        ['popup.html', 'options.html', 'panel.html'].forEach(f => {
          if (existsSync(`public/${f}`)) copyFileSync(`public/${f}`, `dist/${f}`);
        });
      }
    },
    {
      name: 'build-content-scripts-iife',
      async closeBundle() {
        // Rebuild content scripts as IIFE (self-contained, no imports)
        // Chrome content scripts don't support ES module syntax
        for (const entry of ['content-gmail', 'content-whatsapp']) {
          await viteBuild({
            configFile: false,
            plugins: [],
            build: {
              emptyOutDir: false,
              outDir: 'dist',
              write: true,
              rollupOptions: {
                input: { [entry]: resolve(__dirname, `src/${entry}.ts`) },
                output: {
                  format: 'iife',
                  entryFileNames: '[name].js',
                  inlineDynamicImports: true,
                },
              },
            },
          });
        }
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts'),
        'content-gmail': resolve(__dirname, 'src/content-gmail.ts'),
        'content-whatsapp': resolve(__dirname, 'src/content-whatsapp.ts'),
        popup: resolve(__dirname, 'src/popup/index.tsx'),
        panel: resolve(__dirname, 'src/panel/index.tsx'),
        options: resolve(__dirname, 'src/options/index.tsx'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
