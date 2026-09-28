import fs from 'node:fs';
import path from 'node:path';
import { pool, withTx } from './db';

const DIR = path.join(__dirname, '..', 'migrations');

export async function runMigrations(): Promise<string[]> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre text PRIMARY KEY,
      aplicada_en timestamptz NOT NULL DEFAULT now()
    )`);
  const aplicadas = new Set(
    (await pool.query<{ nombre: string }>('SELECT nombre FROM schema_migrations')).rows.map((r) => r.nombre),
  );
  const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  const nuevas: string[] = [];
  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    const sql = fs.readFileSync(path.join(DIR, archivo), 'utf8');
    await withTx(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [archivo]);
    });
    nuevas.push(archivo);
  }
  return nuevas;
}

if (require.main === module) {
  runMigrations()
    .then((nuevas) => {
      console.log(nuevas.length ? `Migraciones aplicadas: ${nuevas.join(', ')}` : 'Base de datos al día');
      return pool.end();
    })
    .catch(async (e) => {
      console.error(e);
      await pool.end();
      process.exit(1);
    });
}
