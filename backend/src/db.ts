import { Pool, PoolClient, QueryResultRow, types } from 'pg';
import { config } from './config';

// DATE (1082) y TIME (1083) como texto: evita que pg los convierta a Date con zona horaria.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1083, (v) => v);

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function query<T extends QueryResultRow = any>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}

export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
