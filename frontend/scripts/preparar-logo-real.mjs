// Prepara los assets de marca reales: copia los lockups completos a public/brand/,
// y recorta el isotipo (solo el ícono, sin texto) para usos pequeños (topbar, favicon, PWA).
import sharp from 'sharp';
import { mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(dir, '..', '..', 'assets');
const brandDir = path.join(dir, '..', 'public', 'brand');
mkdirSync(brandDir, { recursive: true });

const vertical = path.join(assetsDir, 'logo-vertical.png');
const horizontal = path.join(assetsDir, 'logo-horizontal.png');

copyFileSync(vertical, path.join(brandDir, 'logo-vertical.png'));
copyFileSync(horizontal, path.join(brandDir, 'logo-horizontal.png'));

// Isotipo: recorta el tercio superior del lockup vertical (solo el ícono) y ajusta al contenido.
const meta = await sharp(vertical).metadata();
console.log('meta', meta.width, meta.height);
const cropHeight = Math.round(meta.height * 0.66);
console.log('cropHeight', cropHeight);
const cropped = await sharp(vertical)
  .extract({ left: 0, top: 0, width: meta.width, height: cropHeight })
  .png()
  .toBuffer();
await sharp(cropped).trim().toFile(path.join(brandDir, 'isotipo.png'));

console.log('Assets de marca listos en frontend/public/brand/');
