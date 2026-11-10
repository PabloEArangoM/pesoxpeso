import crypto from 'node:crypto';
import { query } from '../db';

export type TipoTokenEmail = 'verificacion' | 'recuperacion';

const VIGENCIA_HORAS: Record<TipoTokenEmail, number> = { verificacion: 48, recuperacion: 1 };

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/** Crea un enlace de un solo uso. Los anteriores del mismo tipo dejan de servir. */
export async function crearTokenEmail(usuarioId: string, tipo: TipoTokenEmail): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await query(`DELETE FROM tokens_email WHERE usuario_id = $1 AND tipo = $2`, [usuarioId, tipo]);
  await query(
    `INSERT INTO tokens_email (usuario_id, tipo, token_hash, expira_en)
     VALUES ($1, $2, $3, now() + make_interval(hours => $4))`,
    [usuarioId, tipo, hash(token), VIGENCIA_HORAS[tipo]],
  );
  return token;
}

/** Marca el token como usado y devuelve el usuario, o null si no existe, venció o ya se usó. */
export async function consumirTokenEmail(token: string, tipo: TipoTokenEmail): Promise<string | null> {
  const r = await query<{ usuario_id: string }>(
    `UPDATE tokens_email SET usado_en = now()
      WHERE token_hash = $1 AND tipo = $2 AND usado_en IS NULL AND expira_en > now()
      RETURNING usuario_id`,
    [hash(token), tipo],
  );
  return r.rows[0]?.usuario_id ?? null;
}
