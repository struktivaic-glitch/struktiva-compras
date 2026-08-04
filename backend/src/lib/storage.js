// Almacenamiento de archivos — stand-in local mientras se contrata Object Storage real
// (DigitalOcean Spaces / S3 / GCS, ver PENDIENTES-STRUKTIVA.md). La API de este módulo
// (guardarArchivo -> URL) es la misma que tendría un backend S3-compatible, para poder
// sustituir la implementación sin tocar las rutas que la usan.
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const uploadsDir = path.join(backendRoot, '..', 'uploads');

export async function guardarArchivo(buffer, nombreOriginal, carpeta) {
  const destino = path.join(uploadsDir, carpeta);
  await mkdir(destino, { recursive: true });
  const nombreSeguro = nombreOriginal.replace(/[^a-zA-Z0-9._-]/g, '_');
  const nombreArchivo = `${randomUUID()}-${nombreSeguro}`;
  await writeFile(path.join(destino, nombreArchivo), buffer);
  return `/uploads/${carpeta}/${nombreArchivo}`;
}
