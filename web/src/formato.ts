const ZONA = 'America/Bogota';

/** $18.000 */
export const pesos = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('es-CO')}`;

/** Para ejes y celdas pequeñas: $850, $18 mil, $1,2 M */
export function pesosCorto(n: number): string {
  const una = (x: number) => x.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  if (n >= 1_000_000) return `$${una(n / 1_000_000)} M`;
  if (n >= 1000) return `$${una(n / 1000)} mil`;
  return `$${n}`;
}

/** Deja solo los dígitos: el monto siempre es un entero de pesos. */
export const soloDigitos = (texto: string) => texto.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 9);
/** "18000" -> "18.000" mientras se escribe. */
export const conMiles = (digitos: string) => (digitos ? Number(digitos).toLocaleString('es-CO') : '');

/** Hoy en Colombia (YYYY-MM-DD), sin depender de la zona del dispositivo. */
export function hoy(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  );
}

const aFecha = (f: string) => new Date(`${f}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function sumarDias(f: string, dias: number): string {
  const d = aFecha(f);
  d.setUTCDate(d.getUTCDate() + dias);
  return iso(d);
}
export function sumarMeses(f: string, meses: number): string {
  const d = aFecha(`${f.slice(0, 7)}-01`);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return iso(d);
}
export function limitesDelMes(f: string): { desde: string; hasta: string } {
  const d = aFecha(`${f.slice(0, 7)}-01`);
  const fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return { desde: iso(d), hasta: iso(fin) };
}
/** 0 = lunes ... 6 = domingo */
export const diaSemana = (f: string) => (aFecha(f).getUTCDay() + 6) % 7;
export const lunesDe = (f: string) => sumarDias(f, -diaSemana(f));

const fmt = (opciones: Intl.DateTimeFormatOptions) => {
  const f = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', ...opciones });
  return (fecha: string) => f.format(aFecha(fecha));
};
/** "martes 10 de noviembre" */
export const fechaLarga = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
/** "10 nov" */
export const fechaCorta = fmt({ day: 'numeric', month: 'short' });
/** "noviembre de 2026" */
export const mesYAnio = fmt({ month: 'long', year: 'numeric' });

export const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Hoy", "Ayer" o la fecha larga. */
export function fechaRelativa(f: string): string {
  const h = hoy();
  if (f === h) return 'Hoy';
  if (f === sumarDias(h, -1)) return 'Ayer';
  return mayuscula(fechaLarga(f));
}

/** Fecha y hora de un instante ISO, en hora de Colombia. */
export function instante(isoStr: string | null): string {
  if (!isoStr) return 'nunca';
  return new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(isoStr),
  );
}
