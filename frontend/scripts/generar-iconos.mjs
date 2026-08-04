// Genera los íconos PWA a partir del isotipo REAL (public/brand/isotipo.png, recortado por
// preparar-logo-real.mjs). Correr preparar-logo-real.mjs primero si el isotipo no existe o cambió.
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(dir, '..', 'public', 'icons');
const isotipoPath = path.join(dir, '..', 'public', 'brand', 'isotipo.png');
mkdirSync(outDir, { recursive: true });

if (!existsSync(isotipoPath)) {
  console.error('No existe public/brand/isotipo.png — corre primero: node scripts/preparar-logo-real.mjs');
  process.exit(1);
}

async function iconoSobreFondo({ file, size, bg, escala }) {
  const isotipo = await sharp(isotipoPath)
    .resize(Math.round(size * escala), Math.round(size * escala), { fit: 'inside' })
    .toBuffer();
  const meta = await sharp(isotipo).metadata();
  const canvas = bg
    ? sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    : sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

  await canvas
    .composite([{ input: isotipo, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) }])
    .png()
    .toFile(path.join(outDir, file));
  console.log('generado', file);
}

await iconoSobreFondo({ file: 'icon-192.png', size: 192, bg: null, escala: 0.92 });
await iconoSobreFondo({ file: 'icon-512.png', size: 512, bg: null, escala: 0.92 });
await iconoSobreFondo({ file: 'apple-touch-icon.png', size: 180, bg: { r: 255, g: 255, b: 255, alpha: 1 }, escala: 0.78 });
await iconoSobreFondo({ file: 'maskable-512.png', size: 512, bg: { r: 18, g: 59, b: 84, alpha: 1 }, escala: 0.62 });
await iconoSobreFondo({ file: 'favicon-32.png', size: 32, bg: null, escala: 0.92 });
