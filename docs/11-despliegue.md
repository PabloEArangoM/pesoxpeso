# PesoXPeso — Despliegue

Nada de esto está publicado todavía. Lo que sigue es el camino preparado en el repositorio; los planes gratuitos y precios de cada proveedor cambian, revísalos antes.

## Piezas

| Pieza | Dónde | Archivo que lo define |
|---|---|---|
| API + PostgreSQL | Render (o Railway, Fly.io: cualquier sitio que ejecute Docker) | `Dockerfile`, `render.yaml` |
| Frontend (PWA) | Vercel (o Netlify, Cloudflare Pages: archivos estáticos) | `web/vercel.json` |

## 1. Repositorio

Sube el repositorio a GitHub. El flujo `.github/workflows/ci.yml` ejecuta linter, tipos, pruebas y compilación en cada push.

## 2. API

En Render: *New → Blueprint* y elige el repositorio; `render.yaml` crea el servicio y la base, y genera `JWT_SECRET` y `JWT_REFRESH_SECRET`. La imagen aplica las migraciones al arrancar.

Variables que hay que completar a mano:

| Variable | Valor |
|---|---|
| `CORS_ORIGIN` | Dominio del frontend, p. ej. `https://pesoxpeso.vercel.app`. Con `*` el servidor no arranca en producción. |
| `APP_URL` | El mismo dominio: con él se arman los enlaces de los correos. |
| `SMTP_URL`, `EMAIL_FROM` | Servidor de correo (ver abajo). |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Llaves de los recordatorios (ver abajo). |

Comprueba con `curl https://TU-API/health`.

## 3. Frontend

En Vercel: importa el repositorio con **Root Directory** = `web`, framework Vite. Define `VITE_API_URL` = la URL de la API (sin `/v1`). Después vuelve a la API y pon ese dominio en `CORS_ORIGIN` y `APP_URL`.

## 4. Correo

Sin `SMTP_URL` la API no envía correos: escribe el mensaje en su log. Eso basta para probar, pero en producción nadie podría verificar su correo ni recuperar la contraseña. Sirve cualquier proveedor con SMTP (Resend, Brevo, Mailgun, Amazon SES…):

```
SMTP_URL=smtps://USUARIO:CLAVE@smtp.proveedor.com:465
EMAIL_FROM=PesoXPeso <no-responder@tudominio.com>
```

Para que no caigan en spam hay que verificar el dominio remitente (SPF y DKIM) en el proveedor.

## 5. Recordatorios (Web Push)

Genera el par de llaves **una sola vez** y guárdalo; si lo cambias, las suscripciones existentes dejan de servir:

```bash
npx web-push generate-vapid-keys
```

Pon las dos llaves en la API y `VAPID_SUBJECT=mailto:tu-correo`. Sin ellas la app muestra que los recordatorios no están disponibles y todo lo demás funciona. En iPhone las notificaciones solo llegan si la app está instalada en la pantalla de inicio (iOS 16.4 o superior).

La API revisa cada minuto a quién le toca aviso y cada hora crea los gastos recurrentes pendientes. Si el plan del proveedor "duerme" el servidor cuando no hay tráfico, los recordatorios no saldrán a tiempo: hace falta un plan que lo mantenga despierto.

## 6. Antes de invitar usuarios

- [ ] Completar y revisar `docs/10-politica-tratamiento-datos.md` y la pantalla de privacidad.
- [ ] Dominio propio y HTTPS en la API y el frontend.
- [ ] Correo funcionando (verificación y recuperación probadas de punta a punta).
- [ ] Copias de seguridad de la base activadas en el proveedor.
- [ ] Probar el Atajo contra la API pública (`docs/09-atajos.md`).
