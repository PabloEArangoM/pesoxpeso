# PesoXPeso — Roadmap del MVP

Pensado para desarrollo solo, compaginando con la universidad. Fechas en semanas relativas — ajústalas a tu semestre.

## Fase 0 — Documentación y setup (esta fase, ~1 semana)
- PRD, historias de usuario, wireframes, modelo de datos, API spec, arquitectura (estos documentos).
- Setup del monorepo (`/backend` Node.js, `/web` React), entorno local, base de datos, proyecto backend vacío.

## Fase 1 — Backend + registro manual (2-3 semanas) ✅
- Auth (registro/login/refresh, cambio de contraseña, cierre de sesiones, borrado de cuenta).
- Endpoints de perfil y categorías.
- Endpoints de gastos (POST, GET por fecha/rango, PATCH, DELETE).
- Tokens personales para el Atajo (`/auth/api-tokens`), adelantados desde la Fase 3.
- Pruebas de integración automáticas (`npm test`), Dockerfile y CI.

## Fase 2 — Frontend web (PWA) (3-4 semanas) ✅
- Onboarding / perfil inicial.
- Vista de calendario diario.
- Modal de registro rápido.
- Gráficos básicos (barras por categoría, línea mensual).
- Conectar todo a la API de Fase 1.
- Añadido en esta fase: presupuesto semanal y mensual con avisos, categorías propias, gastos recurrentes, racha, recordatorio diario (Web Push), exportar a CSV, verificación de correo y recuperación de contraseña, política de privacidad (borrador).

## Fase 3 — Atajo de iPhone y Android (paralelo a Fase 2, ~2-3 días)
- Guía en `09-atajos.md`. Pendiente: publicar la API (`11-despliegue.md`) y armar el atajo en el teléfono.
- Atajo con `Get Contents of URL` contra `POST /gastos`.
- Generar token personal (`/auth/api-tokens`, ya disponible en el backend) y guardarlo en el propio Atajo.
- Notificación de confirmación al registrar.

## Fase 4 — Validación con usuarios reales (2 semanas)
- Reclutar 10-15 estudiantes de tu universidad.
- Medir: % de gastos registrados el mismo día, tiempo de registro, feedback cualitativo sobre categorías y fricción.
- Ajustar UI/categorías según resultados antes de meterle IA.

## Fase 5 — Análisis con IA (3-4 semanas)
- Servicio de análisis de patrones (agregaciones).
- Integración con Gemini (Google AI Studio) para generar mensajes en lenguaje natural, detrás de una interfaz de proveedor para poder cambiar a otro.
- Pantalla de análisis/recomendaciones en el frontend.
- Endpoint `GET /analisis/resumen` conectado.

## Fase 6 — Freemium y monetización (después de validar IA)
- Definir qué queda gratis vs. premium en la práctica (no solo en el PRD).
- Integrar pasarela de pago (ej: Wompi, PayU, Bold — opciones colombianas).
- Lógica de suscripción y control de acceso a features premium.

## Fase 7 — App móvil nativa (React Native)
- Solo después de validar que el modelo funciona en web + Atajo. No tiene sentido invertir en apps nativas antes de confirmar retención.
