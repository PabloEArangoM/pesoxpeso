# PesoXPeso

Control de microgastos con IA para estudiantes universitarios. **Cada peso cuenta. Apúntalo.**

Monorepo:

```
backend/   API REST — Node.js + TypeScript + Express + PostgreSQL   (Fase 1 ✅)
web/       Frontend React PWA                                       (Fase 2, pendiente)
docs/      PRD, historias, wireframes, modelo de datos, API, arquitectura, roadmap, pruebas
```

## Arranque local

Requisitos: Node 22+ y Docker (o un Postgres 16 propio).

```bash
npm install
cp backend/.env.example backend/.env      # y cambia los dos JWT_* por secretos largos:
                                           #   openssl rand -base64 48
npm run db:up                              # Postgres en Docker (crea también pesoxpeso_test)
npm run migrate                            # crea tablas y las 5 categorías
npm run dev                                # API en http://localhost:3000
npm test                                   # 17 pruebas de integración
```

¿Sin Docker? Con Postgres instalado:

```bash
sudo -u postgres psql -c "CREATE USER pxp WITH PASSWORD 'pxp' CREATEDB;" \
  -c "CREATE DATABASE pesoxpeso OWNER pxp;" -c "CREATE DATABASE pesoxpeso_test OWNER pxp;"
```

Comprobar que vive: `curl localhost:3000/health`

## Endpoints (Fase 1)

Detalle completo en [`docs/05-api-spec.md`](docs/05-api-spec.md). Todo bajo `/v1`.

| Método | Ruta | Notas |
|---|---|---|
| POST | `/auth/registro`, `/auth/login`, `/auth/refresh` | JWT de 15 min + refresh de 30 días |
| POST/GET/DELETE | `/auth/api-tokens` | Tokens personales `pxp_...` para el Atajo |
| POST/GET/PATCH | `/perfil` | Solo sesión normal (JWT) |
| GET | `/categorias` | |
| POST/GET | `/gastos` | Los usa también el Atajo |
| PATCH/DELETE | `/gastos/:id` | Solo JWT |

## Atajo de iPhone

1. **Crea tu token personal** (una sola vez; se muestra una sola vez):
   ```bash
   curl -X POST https://TU-API/v1/auth/api-tokens \
     -H "Authorization: Bearer TU_JWT" -H "Content-Type: application/json" \
     -d '{"nombre":"Atajo iPhone"}'
   ```
2. **En la app Atajos**, crea un atajo con estas acciones (los nombres pueden variar un poco según tu versión de iOS):
   1. *Pedir entrada* → tipo **Texto**, pregunta "¿Cuánto gastaste?" → variable `monto`.
   2. *Elegir de la lista* → Snacks y bebidas, Domicilio, Transporte, Propina, Otro → variable `categoria`.
   3. *Obtener contenido de URL*:
      - URL: `https://TU-API/v1/gastos`, método **POST**
      - Encabezados: `Authorization: Bearer pxp_TU_TOKEN` y `Content-Type: application/json`
      - Cuerpo de la solicitud: **JSON** con `monto` (Texto → `monto`) y `categoria` (Texto → `categoria`)
   4. *Obtener valor del diccionario* → `resumen.total_dia` → *Mostrar notificación*: "Registrado. Hoy llevas $…".
3. Asígnalo al **botón de Acción** o agrégalo a la pantalla de inicio.

Detalles útiles:
- `monto` puede ir como texto (`"18.000"`, `"$18.000"`): el API quita puntos y comas (COP no usa decimales).
- La categoría se acepta por nombre, sin importar mayúsculas ni tildes.
- Fecha y hora se llenan solas (zona `America/Bogota`).
- El token del Atajo **solo** puede registrar y consultar gastos. Si pierdes el iPhone, lo revocas con `DELETE /v1/auth/api-tokens/:id` y listo.
- Tu iPhone no llega a `localhost`: para probar antes de desplegar usa un túnel (cloudflared, ngrok) o Tailscale.

## Despliegue (MVP)

Backend + Postgres en Render/Railway/Fly.io, frontend en Vercel (revisa los planes gratuitos vigentes; los gratis suelen "dormir" el servidor y el primer registro del Atajo tarda). En producción:

```bash
npm run build
npm run migrate:prod     # aplica migraciones
npm start --workspace backend
```

Variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN` (el dominio de tu frontend), `PORT`.

## Seguridad — pendientes conscientes

- Los refresh tokens son stateless (no se pueden revocar antes de vencer). Si hace falta, se agrega una tabla en una fase posterior.
- Antes de abrir a usuarios reales: política de tratamiento de datos (Ley 1581 de 2012) y HTTPS obligatorio.
- Login y registro tienen límite de intentos por IP (`RATE_LIMIT_AUTH_MAX`).

## Próximo paso

Fase 2: frontend web (React PWA) — onboarding, calendario diario, modal de registro rápido y gráficos. Ver `docs/07-roadmap-mvp.md`.
