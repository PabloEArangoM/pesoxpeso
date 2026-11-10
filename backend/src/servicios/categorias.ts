import { query } from '../db';
import { AppError } from '../errors';

/** Sin tildes, sin mayúsculas y sin espacios sobrantes: "  Snácks " -> "snacks". */
export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

export interface Categoria {
  id: string;
  nombre: string;
  icono: string;
  propia: boolean;
}

/** Las categorías por defecto más las que creó el usuario. */
export async function categoriasDe(usuarioId: string): Promise<Categoria[]> {
  const r = await query<Categoria>(
    `SELECT id, nombre, icono, (usuario_id IS NOT NULL) AS propia
       FROM categorias
      WHERE usuario_id IS NULL OR usuario_id = $1
      ORDER BY (usuario_id IS NOT NULL), orden, lower(nombre)`,
    [usuarioId],
  );
  return r.rows;
}

/** Convierte un id o un nombre en el id de una categoría que el usuario puede usar. */
export async function resolverCategoria(usuarioId: string, id?: string, nombre?: string): Promise<string> {
  const categorias = await categoriasDe(usuarioId);
  if (id) {
    if (!categorias.some((c) => c.id === id)) throw new AppError(400, 'CATEGORIA_INVALIDA', 'La categoría no existe');
    return id;
  }
  const buscada = normalizar(nombre ?? '');
  const c = categorias.find((x) => normalizar(x.nombre) === buscada);
  if (!c) {
    throw new AppError(
      400,
      'CATEGORIA_INVALIDA',
      `Categoría desconocida. Opciones: ${categorias.map((x) => x.nombre).join(', ')}`,
    );
  }
  return c.id;
}
