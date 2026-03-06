import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  define: {
    __EVENT_PROJECT__: JSON.stringify('Aside'),
  },
  plugins: [svelte(), viteSingleFile()],
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
      exclude: ['src/lib/store.svelte.ts', 'src/lib/types.ts'],
      thresholds: {
        statements: 90,
        lines: 90,
      },
    },
  },
});
