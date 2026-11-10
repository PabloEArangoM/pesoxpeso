# PesoXPeso — Especificación de API (MVP)

Base URL: `https://api.<dominio-de-pesoxpeso>/v1` (dominio por definir; en el Atajo guárdalo en una sola variable para cambiarlo fácil)
Autenticación: Bearer token en header `Authorization: Bearer <token>` para todos los endpoints excepto login/registro.
- Web/app: JWT de corta duración (ej. 15 min) + refresh token.
- Atajo de iPhone: token personal de larga duración (`POST /auth/api-tokens`), revocable.

**Alcance del token personal (`pxp_...`):** solo `POST /gastos`, `GET /gastos` y `GET /categorias`. Todo lo demás (cuenta, presupuesto, recurrentes, resumen, exportar, crear categorías) exige sesión normal (JWT) y responde `403 PROHIBIDO` con un token personal. Así, si se filtra el token del Atajo, no se puede leer el perfil ni borrar datos.

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
Renueva la sesión (access token dura 15 min, refresh 30 días). Responde `401 REFRESH_INVALIDO` si el token venció, la cuenta ya no existe o las sesiones fueron revocadas (cambio de contraseña o `POST /auth/cerrar-sesiones`). Límite de intentos por IP.
```json
// Request
{ "refresh_token": "jwt..." }

// Response 200
{ "token": "jwt...", "refresh_token": "jwt..." }
```

### PATCH /auth/password
Cambia la contraseña (solo JWT). Revoca todos los refresh tokens anteriores y devuelve una sesión nueva. `401 CREDENCIALES_INVALIDAS` si la contraseña actual no coincide.
```json
// Request
{ "password_actual": "...", "password_nueva": "mínimo 8 caracteres" }

// Response 200
{ "token": "jwt...", "refresh_token": "jwt..." }
```

### POST /auth/cerrar-sesiones
Cierra todas las sesiones (solo JWT): los refresh tokens emitidos hasta ese momento dejan de servir. Los access tokens ya entregados vencen solos en máximo 15 min. Responde 204.

### DELETE /auth/cuenta
Borra la cuenta y **todos** sus datos: perfil, gastos y tokens personales (solo JWT). Exige la contraseña. Responde 204. No se puede deshacer.
```json
// Request
{ "password": "..." }
```

### POST /auth/recuperar
Envía al correo un enlace para elegir una contraseña nueva (vale 1 hora, un solo uso). **Siempre responde 204**, exista o no la cuenta, para no revelar qué correos están registrados.
```json
{ "email": "pablo@ejemplo.com" }
```

### POST /auth/restablecer
Pone la contraseña nueva con el token del enlace y cierra todas las sesiones. Responde 204, o `400 TOKEN_INVALIDO` si el enlace no existe, venció o ya se usó.
```json
{ "token": "…", "password_nueva": "mínimo 8 caracteres" }
```

### POST /auth/verificar-email
Confirma el correo con el token del enlace enviado al registrarse (vale 48 horas). Responde 204 o `400 TOKEN_INVALIDO`.
```json
{ "token": "…" }
```

### POST /auth/reenviar-verificacion
Envía de nuevo el enlace de verificación (solo JWT). Responde 204.

Los enlaces apuntan al frontend: `APP_URL/restablecer?token=…` y `APP_URL/verificar?token=…`. Sin `SMTP_URL` configurado el correo no se envía y su texto queda en el log del servidor.

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

## Cuenta (solo JWT)

### GET /cuenta
```json
{
  "id": "uuid", "email": "pablo@ejemplo.com", "nombre": "Pablo", "email_verificado": false,
  "recordatorio_activo": false, "recordatorio_hora": "20:00", "creado_en": "...",
  "push": { "disponible": true, "clave_publica": "clave VAPID pública o null" }
}
```

### PATCH /cuenta
Campos opcionales: `nombre` (texto o `null`), `recordatorio_activo` (booleano), `recordatorio_hora` (`"HH:MM"`, hora de Colombia). Devuelve la cuenta.

### POST /cuenta/push
Guarda la suscripción Web Push de este navegador (lo que entrega `pushManager.subscribe()`). Responde 204. `400` si el `endpoint` no es de un servicio de push conocido (Google, Mozilla, Apple, Microsoft); `503 PUSH_NO_DISPONIBLE` si el servidor no tiene llaves VAPID.
```json
{ "endpoint": "https://fcm.googleapis.com/...", "keys": { "p256dh": "...", "auth": "..." } }
```

### DELETE /cuenta/push
Quita la suscripción: `{ "endpoint": "..." }`. Responde 204.

**Recordatorio:** una notificación al día a quien lo tenga activo, ya pasó su hora y ese día no ha anotado ningún gasto a mano.

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
Las 5 por defecto y después las propias del usuario.
```json
// Response 200
[
  { "id": "uuid", "nombre": "Domicilio", "icono": "🍔", "propia": false },
  { "id": "uuid", "nombre": "Gimnasio", "icono": "🏋️", "propia": true }
]
```

### POST /categorias
Crea una categoría propia (solo JWT; máximo 20). `icono` es opcional. `409 CATEGORIA_EXISTENTE` si el nombre ya existe entre las propias o las de por defecto (sin distinguir mayúsculas ni tildes); `409 LIMITE_CATEGORIAS` al llegar al tope.
```json
{ "nombre": "Gimnasio", "icono": "🏋️" }
```

### PATCH /categorias/{id}
Cambia `nombre` y/o `icono` de una categoría propia (solo JWT). Las de por defecto responden 404.

### DELETE /categorias/{id}
Borra una categoría propia (solo JWT). Sus gastos y gastos recurrentes pasan a **Otro**. Responde 204.

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
  "recurrente": false,
  "resumen": {
    "total_dia": 18000, "total_semana": 52000, "total_mes": 181000,
    "alertas": ["Llevas el 87% de tu presupuesto semanal; te quedan $8.000."]
  }
}
```
Notas:
- Categoría: envía `categoria_id` (uuid) **o** `categoria` (nombre, sin importar mayúsculas ni tildes).
- `monto` es siempre un entero de pesos, como número o como texto (el Atajo manda texto): `18000`, `"18000"`, `"$18000"`, o con miles bien agrupados de a tres: `"18.000"`, `"18,000"`, `"1.250.000"`.
- **No se aceptan decimales.** `"18000.50"`, `"18000,00"`, `"18.5"` o `18000.5` responden `400 VALIDACION`. Se rechazan en lugar de adivinar el separador, porque interpretarlo mal guardaría un monto 100 veces mayor sin avisar.
- `fecha` debe estar entre los años 2000 y 2100.
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

### GET /gastos/exportar?desde=2026-09-01&hasta=2026-09-30
Descarga los gastos del rango en CSV (solo JWT). Sin parámetros, el mes en curso; máximo 1830 días. Separado por punto y coma y con BOM para que Excel en español lo abra bien. Columnas: `Fecha;Hora;Categoría;Monto;Nota;Recurrente`. Las celdas que empiezan por `=`, `+`, `-` o `@` llevan una comilla simple delante para que no se ejecuten como fórmula.

### PATCH /gastos/{id}
Editar un gasto (solo JWT). Solo se actualizan los campos enviados.

### DELETE /gastos/{id}
Eliminar un gasto (solo JWT). Responde 204.

## Resumen (solo JWT)

### GET /resumen
Todo lo de la pantalla de inicio en una llamada.
```json
{
  "fecha": "2026-11-10",
  "total_dia": 20900, "total_semana": 46700, "total_mes": 181000,
  "presupuesto": {
    "semanal": { "monto": 60000, "gastado": 46700, "restante": 13300, "porcentaje": 78, "estado": "ok" },
    "mensual": null
  },
  "racha": { "actual": 10, "mejor": 10, "registro_hoy": true }
}
```
**Racha:** días seguidos con al menos un gasto anotado a mano (los automáticos no cuentan). Si hoy aún no hay registro, sigue viva mientras ayer sí lo haya.

## Presupuesto (solo JWT)

### GET /presupuesto
Devuelve `{ "semanal": …, "mensual": … }` con la misma forma que en `/resumen` (`null` si no hay tope). La semana va de lunes a domingo. `estado`: `ok`, `cerca` (desde el 80%) o `excedido` (100% o más).

### PUT /presupuesto
Un monto fija el tope, `null` lo quita y un campo ausente no cambia nada. El monto sigue las mismas reglas que en los gastos (entero, sin decimales). Devuelve el estado actualizado.
```json
{ "semanal": 60000, "mensual": null }
```

## Gastos recurrentes (solo JWT)

Gastos que se anotan solos cuando toca. El servidor los crea al consultar gastos o el resumen y, además, cada hora. Los gastos generados llevan `"recurrente": true` y hora `00:00`.

### GET /recurrentes
```json
[ { "id": "uuid", "monto": 2900, "categoria_id": "uuid", "categoria": "Transporte", "icono": "🚌", "nota": "pasaje",
    "frecuencia": "diaria", "inicio": "2026-11-10", "proxima_fecha": "2026-11-11", "activo": true } ]
```

### POST /recurrentes
`frecuencia`: `diaria`, `semanal` o `mensual`. `inicio` es la primera fecha (por defecto hoy; no puede ser pasada) y fija el día de la semana o del mes. En meses más cortos se usa el último día (31 → 28/29 de febrero → 31 de marzo). Máximo 30 por usuario.
```json
{ "monto": 2900, "categoria": "Transporte", "frecuencia": "diaria", "inicio": "2026-11-10", "nota": "pasaje" }
```

### PATCH /recurrentes/{id}
Campos opcionales: `monto`, `categoria_id` o `categoria`, `nota`, `activo`. En pausa (`activo: false`) no genera nada; al reanudar continúa desde la próxima fecha que toque, sin crear lo que quedó atrás.

### DELETE /recurrentes/{id}
Responde 204. Los gastos que ya creó se conservan.

## Análisis (Fase 5 — IA, aún no implementado)

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
{ "error": { "codigo": "VALIDACION", "mensaje": "monto: el monto debe ser mayor a cero" } }
```

Códigos HTTP usados: 200 (ok), 201 (creado), 204 (sin contenido), 400 (validación o enlace inválido), 401 (no autenticado), 403 (token personal sin permiso), 404 (no encontrado), 409 (conflicto: correo, perfil o categoría ya existente, o límite alcanzado), 429 (demasiados intentos en login, registro, refresh, cambio de contraseña o borrado de cuenta), 500 (error de servidor), 503 (notificaciones no configuradas).
