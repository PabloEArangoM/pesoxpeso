# PesoXPeso

Control de microgastos para estudiantes universitarios. **Cada peso cuenta. Apúntalo.**

```
backend/   API REST — Node.js + TypeScript + Express + PostgreSQL
web/       App web instalable (PWA) — React + Vite + TypeScript
docs/      PRD, historias, wireframes, modelo de datos, API, arquitectura, roadmap,
           plan de pruebas, atajos, política de datos y despliegue
```

## Qué hace

- **Registro rápido:** monto y categoría en un par de toques; fecha y hora se llenan solas.
- **Inicio:** total de hoy, de la semana y del mes, presupuesto, racha y gastos del día.
- **Calendario** mensual con el total de cada día, y **gráficos** por categoría y por día o semana.
- **Presupuesto** semanal y mensual, con aviso al 80% y al pasarse.
- **Categorías propias**, además de las 5 por defecto.
- **Gastos recurrentes** (diarios, semanales o mensuales) que se anotan solos.
- **Racha** de días seguidos anotando y **recordatorio diario** por notificación.
- **Atajo de iPhone o Android** con tokens personales de alcance limitado.
- **Exportar a CSV**, verificación de correo, recuperación de contraseña y borrado de cuenta.

Los montos son siempre pesos enteros: **no se aceptan decimales**.

## Arranque local

Requisitos: Node 22+ y Docker (o un Postgres 16 propio).

```bash
npm install
cp backend/.env.example backend/.env      # y cambia los dos JWT_* por secretos largos:
                                           #   openssl rand -base64 48
npm run db:up                              # Postgres en Docker (crea también pesoxpeso_test)
npm run migrate                            # crea o actualiza las tablas
npm run dev                                # API en http://localhost:3000
npm run dev:web                            # en otra terminal: app en http://localhost:5173
```

Abre http://localhost:5173, crea una cuenta y listo. En desarrollo no hace falta configurar correo: los enlaces de verificación y de recuperación de contraseña aparecen en el log de la API.

¿Sin Docker? Con Postgres instalado:

```bash
sudo -u postgres psql -c "CREATE USER pxp WITH PASSWORD 'pxp' CREATEDB;" \
  -c "CREATE DATABASE pesoxpeso OWNER pxp;" -c "CREATE DATABASE pesoxpeso_test OWNER pxp;"
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` / `npm run dev:web` | API y app web en modo desarrollo |
| `npm test` | Pruebas de integración de la API (usan la base `pesoxpeso_test`) |
| `npm run lint` | Linter (Biome) sobre backend y frontend |
| `npm run typecheck` | Verificación de tipos de ambos proyectos |
| `npm run build` | Compila la API (`backend/dist`) y la app (`web/dist`) |
| `npm run migrate` | Aplica las migraciones pendientes |

## Configuración opcional

Todo en `backend/.env` (ver `backend/.env.example`):

- **Correo** (`SMTP_URL`, `EMAIL_FROM`): sin él, los mensajes se escriben en el log.
- **Recordatorios** (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`): genera las llaves con `npx web-push generate-vapid-keys`. Sin ellas la app indica que los recordatorios no están disponibles; lo demás funciona.

## Documentación

| Tema | Archivo |
|---|---|
| Endpoints de la API | [`docs/05-api-spec.md`](docs/05-api-spec.md) |
| Tablas y relaciones | [`docs/04-modelo-datos.md`](docs/04-modelo-datos.md) |
| Decisiones técnicas | [`docs/06-arquitectura-tecnica.md`](docs/06-arquitectura-tecnica.md) |
| Atajo de iPhone y Android | [`docs/09-atajos.md`](docs/09-atajos.md) |
| Publicar en internet | [`docs/11-despliegue.md`](docs/11-despliegue.md) |
| Política de tratamiento de datos (borrador) | [`docs/10-politica-tratamiento-datos.md`](docs/10-politica-tratamiento-datos.md) |
| Qué sigue | [`docs/07-roadmap-mvp.md`](docs/07-roadmap-mvp.md) |

## Seguridad

- Contraseñas con bcrypt; tokens personales y enlaces de correo guardados solo como hash.
- Sesión: JWT de 15 minutos más refresh de 30 días, revocable al cambiar la contraseña o al cerrar sesiones.
- Los tokens de los Atajos solo pueden registrar y consultar gastos.
- Límite de intentos por IP en login, registro, recuperación y cambio de contraseña.
- En producción el servidor no arranca con `CORS_ORIGIN=*`.

## Pendiente antes de usuarios reales

- Publicar la API y la app (`docs/11-despliegue.md`) y armar el Atajo en el teléfono.
- Configurar un proveedor de correo y las llaves de los recordatorios.
- Hacer revisar por un abogado la política de tratamiento de datos (Ley 1581 de 2012), que hoy es un borrador.
