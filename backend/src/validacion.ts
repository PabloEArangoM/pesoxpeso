import { z } from 'zod';
import { esFechaValida } from './util/fecha';

export const vacioAUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/**
 * Pesos colombianos enteros. Acepta 18000, "18000", "$18000" y miles bien agrupados
 * ("18.000", "1.250.000", "18,000"), porque el Atajo de iPhone manda texto.
 *
 * No se aceptan decimales: "18000.50", "18000,00" o "18.5" se rechazan en vez de adivinar,
 * porque interpretar mal el separador guardaría un monto 100 veces mayor sin avisar.
 */
const SOLO_DIGITOS = /^\d+$/;
const MILES_AGRUPADOS = /^\d{1,3}(\.\d{3})+$|^\d{1,3}(,\d{3})+$/;
const SIN_DECIMALES = 'el monto debe ser un número entero de pesos, sin decimales';

export const monto = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    const limpio = v.replace(/[\s$]/g, '');
    if (SOLO_DIGITOS.test(limpio)) return Number(limpio);
    if (MILES_AGRUPADOS.test(limpio)) return Number(limpio.replace(/[.,]/g, ''));
    return Number.NaN;
  },
  z
    .number(SIN_DECIMALES)
    .int(SIN_DECIMALES)
    .positive('el monto debe ser mayor a cero')
    .max(100_000_000, 'monto demasiado alto'),
);

export const fecha = z.preprocess(
  vacioAUndefined,
  z.string().refine(esFechaValida, 'formato inválido, usa YYYY-MM-DD').optional(),
);
export const hora = z.preprocess(
  vacioAUndefined,
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'formato inválido, usa HH:MM')
    .optional(),
);
export const categoriaId = z.preprocess(vacioAUndefined, z.string().uuid('categoria_id inválido').optional());
export const categoriaNombre = z.preprocess(vacioAUndefined, z.string().trim().max(60).optional());
export const nota = z.string().trim().max(200);

export const esUuid = (v: unknown) => z.string().uuid().safeParse(v).success;
