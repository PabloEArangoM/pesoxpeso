import { createApp } from './app';
import { config } from './config';
import { pool } from './db';
import { log } from './log';
import { pushConfigurado } from './push';
import { enviarRecordatorios } from './servicios/recordatorios';
import { generarRecurrentes } from './servicios/recurrentes';

const app = createApp();
const server = app.listen(config.port, () => {
  log.info({ puerto: config.port, push: pushConfigurado(), correo: Boolean(config.smtpUrl) }, 'PesoXPeso API escuchando');
});

// ---- Tareas periódicas ----
function cada(ms: number, nombre: string, tarea: () => Promise<unknown>) {
  const ejecutar = () => tarea().catch((e) => log.error({ err: e }, `falló la tarea ${nombre}`));
  ejecutar();
  return setInterval(ejecutar, ms);
}
const tareas = [
  cada(60_000, 'recordatorios', () => enviarRecordatorios()),
  cada(60 * 60_000, 'recurrentes', () => generarRecurrentes()),
];

function cerrar() {
  tareas.forEach(clearInterval);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', cerrar);
process.on('SIGINT', cerrar);
