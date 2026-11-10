import webpush from 'web-push';
import { config } from './config';

export interface Suscripcion {
  endpoint: string;
  p256dh: string;
  auth: string;
}
export interface Notificacion {
  titulo: string;
  cuerpo: string;
  url?: string;
}

/** En las pruebas no se envía nada: las notificaciones quedan aquí. */
export const pushDePrueba: Array<{ endpoint: string; notificacion: Notificacion }> = [];

export const pushConfigurado = () => config.isTest || Boolean(config.vapidPublicKey && config.vapidPrivateKey);

/**
 * El servidor hace una petición HTTP al `endpoint` que entrega el navegador. Solo se aceptan
 * los servicios de push conocidos, para que nadie pueda usar la API para llamar URLs arbitrarias.
 */
const SERVICIOS_PUSH = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
];
export function esEndpointPushValido(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && SERVICIOS_PUSH.some((r) => r.test(u.hostname));
  } catch {
    return false;
  }
}

let listo = false;

/** Devuelve 'ok', o 'caducada' si el navegador ya no acepta esa suscripción (hay que borrarla). */
export async function enviarPush(s: Suscripcion, n: Notificacion): Promise<'ok' | 'caducada'> {
  if (config.isTest) {
    pushDePrueba.push({ endpoint: s.endpoint, notificacion: n });
    return 'ok';
  }
  if (!listo) {
    webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey!, config.vapidPrivateKey!);
    listo = true;
  }
  try {
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify(n),
      { TTL: 3600 },
    );
    return 'ok';
  } catch (e: any) {
    if (e?.statusCode === 404 || e?.statusCode === 410) return 'caducada';
    throw e;
  }
}
