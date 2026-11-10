import nodemailer, { type Transporter } from 'nodemailer';
import { config } from './config';
import { log } from './log';

export interface Correo {
  para: string;
  asunto: string;
  texto: string;
}

/** En las pruebas los correos no salen: quedan aquí para poder leer los enlaces. */
export const bandejaDePrueba: Correo[] = [];

let transporte: Transporter | undefined;

export async function enviarCorreo(correo: Correo): Promise<void> {
  if (config.isTest) {
    bandejaDePrueba.push(correo);
    return;
  }
  if (!config.smtpUrl) {
    // Sin SMTP configurado: el contenido (con el enlace) queda en el log para poder probar en local.
    log.info({ para: correo.para, asunto: correo.asunto, texto: correo.texto }, 'correo no enviado (falta SMTP_URL)');
    return;
  }
  transporte ??= nodemailer.createTransport(config.smtpUrl);
  await transporte.sendMail({ from: config.emailFrom, to: correo.para, subject: correo.asunto, text: correo.texto });
}

/** Envía sin bloquear la respuesta; un fallo del correo no debe tumbar la petición. */
export function enviarCorreoSinEsperar(correo: Correo): void {
  enviarCorreo(correo).catch((e) => log.error({ err: e, para: correo.para }, 'no se pudo enviar el correo'));
}
