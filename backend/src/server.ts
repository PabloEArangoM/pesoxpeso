import { createApp } from './app';
import { config } from './config';
import { pool } from './db';

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`PesoXPeso API escuchando en http://localhost:${config.port}`);
});

function cerrar() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', cerrar);
process.on('SIGINT', cerrar);
