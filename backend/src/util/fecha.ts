const ZONA = 'America/Bogota';

/** Fecha de hoy en Colombia, formato YYYY-MM-DD. */
export function hoyBogota(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** Hora actual en Colombia, formato HH:MM (24 h). */
export function horaBogota(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(ahora);
}

export function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  // Años fuera de un rango razonable (p. ej. 0000, que Postgres no admite) no son gastos reales.
  const anio = Number(fecha.slice(0, 4));
  if (anio < 2000 || anio > 2100) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00Z`).getTime();
  const b = new Date(`${hasta}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Lista todas las fechas desde..hasta (inclusive). */
export function rangoDeFechas(desde: string, hasta: string): string[] {
  const n = diasEntre(desde, hasta);
  return Array.from({ length: n + 1 }, (_, i) => sumarDias(desde, i));
}

/** Primer y último día del mes de `fecha`. */
export function limitesDelMes(fecha: string): { desde: string; hasta: string } {
  const [a, m] = fecha.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { desde: `${a}-${mm}-01`, hasta: `${a}-${mm}-${String(ultimo).padStart(2, '0')}` };
}

/**
 * `inicio` más `meses` meses, conservando el día del mes de `inicio` y recortándolo
 * al último día cuando el mes es más corto (31 ene + 1 mes = 28/29 feb; + 2 meses = 31 mar).
 */
export function sumarMeses(inicio: string, meses: number): string {
  const [a, m, d] = inicio.split('-').map(Number);
  const total = a * 12 + (m - 1) + meses;
  const anio = Math.floor(total / 12);
  const mes = total % 12; // 0-11
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}
