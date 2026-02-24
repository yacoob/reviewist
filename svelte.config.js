// ABOUTME: Svelte compiler configuration.
// ABOUTME: Uses vitePreprocess for TypeScript support in Svelte components.

import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
};
