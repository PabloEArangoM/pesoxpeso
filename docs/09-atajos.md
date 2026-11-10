# PesoXPeso — Atajos para anotar sin abrir la app

Un atajo le pregunta al usuario el monto y la categoría y llama a `POST /v1/gastos`. Necesita:

- La API publicada con **HTTPS** (el teléfono no llega a `localhost`; para probar antes, usa un túnel como cloudflared o ngrok).
- Un **token personal**: en la app, Ajustes → *Atajo de iPhone o Android* → *Crear token*. Se muestra una sola vez. Solo puede registrar y consultar gastos, y se revoca desde la misma pantalla.

La petición es la misma en cualquier plataforma:

```
POST https://TU-API/v1/gastos
Authorization: Bearer pxp_TU_TOKEN
Content-Type: application/json

{ "monto": "18000", "categoria": "Domicilio" }
```

La respuesta trae `resumen.total_dia`, `resumen.total_semana` y `resumen.alertas` (avisos de presupuesto) para mostrarlos en una notificación.

Reglas del monto: entero de pesos, **sin decimales**. Vale `18000`, `"18000"`, `"18.000"`; se rechaza `"18000.50"` o `"18000,00"`. Por eso la entrada debe pedirse como **texto**, no como número. La categoría va por nombre, sin importar mayúsculas ni tildes; también sirven las categorías propias.

## iPhone (app Atajos)

Los nombres de las acciones pueden variar un poco según la versión de iOS.

1. *Pedir entrada* → tipo **Texto**, pregunta "¿Cuánto gastaste?".
2. *Elegir de la lista* → Snacks y bebidas, Domicilio, Transporte, Propina, Otro (y tus categorías propias).
3. *Obtener contenido de URL*:
   - URL `https://TU-API/v1/gastos`, método **POST**.
   - Encabezados: `Authorization` = `Bearer pxp_TU_TOKEN`, `Content-Type` = `application/json`.
   - Cuerpo **JSON**: `monto` (Texto → la entrada del paso 1) y `categoria` (Texto → la opción del paso 2).
4. *Obtener valor del diccionario* → clave `resumen.total_dia`.
5. *Mostrar notificación* → "Anotado. Hoy llevas $[valor]".
6. Asígnalo al **botón de Acción**, a un widget o a la pantalla de inicio.

## Android

Android no trae una app equivalente, pero cualquier herramienta que haga una petición HTTP sirve. Dos caminos habituales (verifica los pasos en la app que elijas, cambian entre versiones):

- **Una app de atajos HTTP** (por ejemplo *HTTP Shortcuts*, de código abierto): crea un atajo con método POST, la URL, los dos encabezados y el cuerpo JSON de arriba; usa variables de tipo "pedir texto" para el monto y "selección" para la categoría, y ponlo como widget en la pantalla de inicio.
- **Una app de automatización** (por ejemplo *Tasker* o *MacroDroid*): una tarea que pida el monto, pida la categoría y ejecute la acción de petición HTTP con los mismos datos.

Otra opción sin configurar nada: instalar la PWA (menú del navegador → *Instalar app*) y mantener pulsado su icono; el acceso directo **Anotar un gasto** abre el registro rápido.

## Si algo falla

| Respuesta | Causa |
|---|---|
| 401 `NO_AUTENTICADO` | Token mal copiado o revocado. Falta la palabra `Bearer` antes del token. |
| 400 `VALIDACION` (monto) | El monto llegó con decimales o con letras. |
| 400 `CATEGORIA_INVALIDA` | El nombre no coincide; el mensaje lista las opciones válidas. |
| 403 `PROHIBIDO` | El token personal se usó en un endpoint que exige sesión normal. |
