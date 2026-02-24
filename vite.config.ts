// ABOUTME: Vite build configuration for Reviewist.
// ABOUTME: Uses Svelte plugin and singlefile plugin to produce one self-contained HTML file.

import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [svelte(), viteSingleFile()],
});
