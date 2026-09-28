# PesoXPeso — Especificación de API (MVP)

Base URL: `https://api.<dominio-de-pesoxpeso>/v1` (dominio por definir; en el Atajo guárdalo en una sola variable para cambiarlo fácil)
Autenticación: Bearer token en header `Authorization: Bearer <token>` para todos los endpoints excepto login/registro.
- Web/app: JWT de corta duración (ej. 15 min) + refresh token.
- Atajo de iPhone: token personal de larga duración (`POST /auth/api-tokens`), revocable.

**Alcance del token personal (`pxp_...`):** solo `POST /gastos`, `GET /gastos` y `GET /categorias`. Perfil, editar/borrar gastos y gestión de tokens exigen sesión normal (JWT) y responden `403 PROHIBIDO` con un token personal. Así, si se filtra el token del Atajo, no se puede leer el perfil ni borrar datos.

**Zona horaria:** fecha y hora por defecto se calculan en `America/Bogota`.

## Auth

### POST /auth/registro
```json
// Request
{ "email": "pablo@ejemplo.com", "password": "..." }

// Response 201
{ "id": "uuid", "email": "pablo@ejemplo.com", "token": "jwt...", "refresh_token": "jwt..." }
```

### POST /auth/login
```json
// Request
{ "email": "pablo@ejemplo.com", "password": "..." }

// Response 200
{ "usuario_id": "uuid", "token": "jwt...", "refresh_token": "jwt..." }
```

### POST /auth/refresh
Renueva la sesión (access token dura 15 min, refresh 30 días).
```json
// Request
{ "refresh_token": "jwt..." }

// Response 200
{ "token": "jwt...", "refresh_token": "jwt..." }
```

### POST /auth/api-tokens
Genera un token personal para el Atajo (se muestra una sola vez).
```json
// Request
{ "nombre": "Atajo iPhone" }

// Response 201
{ "id": "uuid", "token": "pxp_xxxxxxxx" }
```

### GET /auth/api-tokens
Lista los tokens del usuario (nunca devuelve el token, solo metadatos).
```json
[ { "id": "uuid", "nombre": "Atajo iPhone", "creado_en": "...", "ultimo_uso": "..." } ]
```

### DELETE /auth/api-tokens/{id}
Revoca un token. Deja de funcionar de inmediato. Responde 204.

## Perfil

### POST /perfil
Crea el perfil inicial (onboarding).
```json
// Request
{
  "ocupacion": "estudiante",
  "tipo_ingreso": "mesada",
  "ingreso_estimado": 500000,
  "gastos_fijos": { "arriendo": 400000, "servicios": 80000 }
}

// Response 201
{ "id": "uuid", "usuario_id": "uuid", ... }
```

### GET /perfil
Devuelve el perfil del usuario autenticado.

### PATCH /perfil
Actualiza campos del perfil.

## Categorías

### GET /categorias
```json
// Response 200
[
  { "id": "uuid", "nombre": "Domicilio", "icono": "🍔" },
  { "id": "uuid", "nombre": "Transporte", "icono": "🚌" }
]
```

## Gastos

### POST /gastos
Este es el endpoint que consume el Atajo de iPhone.
```json
// Request — solo monto y categoría son obligatorios
{
  "monto": 18000,
  "categoria": "Domicilio",
  "fecha": "2026-09-27",
  "hora": "13:45",
  "nota": ""
}

// Response 201 — incluye resumen para mostrarlo en la notificación del Atajo
{
  "id": "uuid", "monto": 18000, "categoria_id": "uuid", "categoria": "Domicilio", "icono": "🍔",
  "fecha": "2026-09-27", "hora": "13:45", "nota": "",
  "resumen": { "total_dia": 18000, "total_semana": 52000 }
}
```
Notas:
- Categoría: envía `categoria_id` (uuid) **o** `categoria` (nombre, sin importar mayúsculas ni tildes).
- `monto` acepta número o texto: `18000`, `"18000"`, `"18.000"`, `"$18.000"`. Los puntos y comas se ignoran (COP no usa decimales), porque el Atajo manda texto.
- `fecha` y `hora` vacías (`""`) o ausentes = ahora en Bogotá.

### GET /gastos?fecha=2026-09-27
Gastos de un día específico. Sin parámetros devuelve el día de hoy.

### GET /gastos?desde=2026-09-01&hasta=2026-09-30
Gastos de un rango (para calendario mensual y gráficos). Máximo 366 días; `desde` y `hasta` van juntos.
```json
// Response 200
{
  "desde": "2026-09-01", "hasta": "2026-09-30",
  "total": 320500,
  "por_dia": { "2026-09-01": 15000, "2026-09-02": 0, "...": "..." },
  "por_categoria": { "Snacks y bebidas": 15000, "Domicilio": 305500 },
  "gastos": [ { "id": "uuid", "monto": 15000, "categoria": "Snacks y bebidas", "fecha": "2026-09-01", "hora": "12:05" } ]
}
```

### PATCH /gastos/{id}
Editar un gasto (solo JWT). Solo se actualizan los campos enviados.

### DELETE /gastos/{id}
Eliminar un gasto (solo JWT). Responde 204.

## Análisis (Fase 2 — IA)

### GET /analisis/resumen
```json
// Response 200
{
  "insights": [
    {
      "tipo": "patron",
      "mensaje": "Gastas $40.000 semanales en domicilios sin darte cuenta",
      "datos_soporte": { "categoria": "Domicilio", "promedio_semanal": 40000 }
    },
    {
      "tipo": "meta_sugerida",
      "mensaje": "Reduce domicilios a 2x por semana y ahorra $60.000 al mes",
      "datos_soporte": { "ahorro_estimado": 60000 }
    }
  ]
}
```

## Errores (formato estándar en todos los endpoints)
```json
{ "error": { "codigo": "MONTO_INVALIDO", "mensaje": "El monto debe ser mayor a cero" } }
```

Códigos HTTP usados: 200 (ok), 201 (creado), 204 (sin contenido), 400 (validación), 401 (no autenticado), 403 (token personal sin permiso), 404 (no encontrado), 409 (conflicto: correo o perfil ya existente), 429 (demasiados intentos en login/registro), 500 (error de servidor).
