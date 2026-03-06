import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import sharp from 'sharp';
import toIco from 'to-ico';

function generatePng(svgPath: string, size: number): Promise<Buffer> {
  return sharp(readFileSync(svgPath))
    .resize(size, size)
    .png()
    .toBuffer();
}

export default function generateIcons(): Plugin {
  return {
    name: 'generate-icons',
    apply: 'build',
    async writeBundle(options) {
      const dir = options.dir!;
      const publicDir = resolve(dir, '..', 'public');

      const [pwa192, pwa512, ico16, ico32, ico48, favicon96, apple180, maskable512] = await Promise.all([
        generatePng(resolve(publicDir, 'favicon.svg'), 192),
        generatePng(resolve(publicDir, 'favicon.svg'), 512),
        generatePng(resolve(publicDir, 'favicon.svg'), 16),
        generatePng(resolve(publicDir, 'favicon.svg'), 32),
        generatePng(resolve(publicDir, 'favicon.svg'), 48),
        generatePng(resolve(publicDir, 'favicon.svg'), 96),
        generatePng(resolve(publicDir, 'maskable-icon.svg'), 180),
        generatePng(resolve(publicDir, 'maskable-icon.svg'), 512),
      ]);

      const ico = await toIco([ico16, ico32, ico48]);

      const writes: [string, Buffer][] = [
        ['favicon-96x96.png', favicon96],
        ['pwa-192x192.png', pwa192],
        ['pwa-512x512.png', pwa512],
        ['apple-touch-icon-180x180.png', apple180],
        ['maskable-icon-512x512.png', maskable512],
        ['favicon.ico', Buffer.from(ico)],
      ];

      console.log('Icons generated:');
      for (const [name, buf] of writes) {
        writeFileSync(resolve(dir, name), buf);
        console.log(`  dist/${name} (${buf.length} bytes)`);
      }
    },
  };
}
