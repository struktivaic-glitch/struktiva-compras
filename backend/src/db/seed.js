import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './pool.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const seedsDir = path.join(dir, 'seeds');

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _seeds (
      filename TEXT PRIMARY KEY,
      aplicado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const files = (await readdir(seedsDir)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT filename FROM _seeds');
  const aplicados = new Set(rows.map((r) => r.filename));

  for (const file of files) {
    if (aplicados.has(file)) {
      console.log(`(ya sembrado) ${file}`);
      continue;
    }
    const sql = await readFile(path.join(seedsDir, file), 'utf8');
    console.log(`sembrando ${file}...`);
    await pool.query(sql);
    await pool.query('INSERT INTO _seeds (filename) VALUES ($1)', [file]);
  }
  console.log('Seed al día.');
  await pool.end();
}

run().catch((err) => {
  console.error('Error al sembrar:', err.message);
  process.exit(1);
});
