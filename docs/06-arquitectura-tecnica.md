# PesoXPeso — Arquitectura Técnica

## Diagrama general

```mermaid
graph TD
    A[Atajo de iPhone] -->|POST /gastos| D[API Backend]
    B[Web App - React PWA] -->|REST/JSON| D
    C[App Móvil - React Native] -->|REST/JSON| D
    D --> E[(PostgreSQL)]
    D --> F[Servicio de Análisis de Patrones]
    F --> G[LLM (Gemini vía Google AI Studio)]
    F --> E
    D --> H[Auth JWT]
```

## Componentes

**Backend (Node.js + PostgreSQL)**
Expone la API REST descrita en `05-api-spec.md`. Responsable de autenticación, CRUD de gastos/perfil, y de disparar el análisis (síncrono al registrar un gasto, o por cron nocturno — decisión pendiente, ver sección de decisiones abajo).

**Base de datos (PostgreSQL)**
Esquema descrito en `04-modelo-datos.md`. Una sola base sirve web, móvil y el Atajo de iPhone porque todos hablan con el mismo backend.

**Frontend web (React, como PWA)**
Primera interfaz a construir en el MVP. PWA para que funcione instalable en el celular sin pasar por App Store, útil para validar rápido con estudiantes.

**App móvil (React Native)**
Fase 2, una vez validado el flujo en web. Reutiliza la misma API.

**Atajo de iPhone**
Cliente ligero que solo hace `POST /gastos` con un token guardado localmente en el propio Atajo. No necesita backend adicional, solo que la API esté expuesta públicamente con HTTPS.

**Servicio de análisis de patrones (Fase 2)**
Un módulo separado (puede vivir dentro del mismo backend al inicio) que:
1. Agrega los gastos del usuario por categoría/periodo.
2. Detecta anomalías o patrones simples (ej: promedio semanal por categoría).
3. Le pasa esos números a una LLM (Gemini vía Google AI Studio) con un prompt estructurado para generar el mensaje en lenguaje natural.
4. Guarda el resultado en `recomendaciones_ia`.

## Decisiones técnicas tomadas

| Tema | Decisión | Por qué |
|---|---|---|
| Backend | Node.js (TypeScript recomendado) + Express o Fastify | Un solo lenguaje con React; elección de Pablo |
| Repositorio | Monorepo: `/backend`, `/web`, `/docs` (más adelante `/mobile`) | API y frontend cambian juntos; más simple para un dev solo; elección de Pablo |
| Base de datos | PostgreSQL con migraciones (Prisma o Drizzle) | Coincide con el modelo de datos definido |
| Hosting MVP | Backend + Postgres en Render/Railway/Fly.io (verifica planes gratuitos vigentes), frontend PWA en Vercel | Necesitas HTTPS público desde el día 1 para el Atajo. Ojo: los planes gratis suelen "dormir" el servidor y el primer registro tarda; para pruebas con usuarios conviene un plan pago barato o un ping periódico |
| Autenticación | Propia: bcrypt + JWT corto + refresh, y tokens personales para el Atajo | Sin dependencia de terceros; el Atajo necesita un token de larga duración y revocable |
| LLM (Fase 5) | Gemini vía Google AI Studio, detrás de una interfaz `LLMProvider` (Grok u otro como reemplazo) | Plan gratuito generoso; la interfaz evita quedar amarrado |
| Análisis IA | Cron nocturno al inicio; evaluar síncrono después | Más barato; el feedback inmediato se agrega si el costo lo permite |
| API | `/v1` bajo subdominio `api.` del dominio de PesoXPeso | Es la URL que va fija en el Atajo |
| Categorías | Snacks y bebidas, Domicilio, Transporte, Propina, Otro (congeladas para el MVP) | "Gaseosa" era muy estrecha; "Snacks y bebidas" cubre más microgastos reales |

## Riesgos técnicos a tener presentes
- **Privacidad con el plan gratuito de Gemini:** los servicios gratuitos de la API de Google pueden usar el contenido para mejorar sus productos. Para prototipar con datos tuyos o de prueba está bien; con gastos de usuarios reales conviene pasar al nivel pago o enviar solo datos agregados y anonimizados (sin nombres ni notas libres). Verifica los términos vigentes antes de lanzar.
- **Límites del plan gratuito:** cambian con frecuencia; no diseñes el costo del premium sobre ellos.
- **Datos financieros:** aunque no manejes cuentas bancarias, son datos personales sensibles; aplica la Ley 1581 de 2012 (habeas data) y ten una política de tratamiento de datos antes de abrir a usuarios.
