# PRD — PesoXPeso: App de Control de Microgastos con IA

**Nombre:** PesoXPeso — cada peso cuenta, se apunta peso por peso. Refleja el foco en microgastos: no se controla la plata por los gastos grandes sino peso a peso.

**Eslogan (propuesto):** "Cada peso cuenta. Apúntalo." Alternativas: "Peso a peso, sin perderte." / "Apunta cada peso, llega a tu meta."

## 1. Resumen ejecutivo
App móvil/web para que estudiantes universitarios registren sus microgastos (gaseosa, domicilio, transporte, propinas) en 2-3 toques, los vean organizados en un calendario diario, y reciban análisis de patrones y recomendaciones de ahorro generadas por IA, sin depender de integración bancaria.

## 2. Problema
La mayoría de estudiantes no pierde el control del dinero por gastos grandes (arriendo, servicios), sino por microgastos dispersos que no registran ni asocian a un patrón. Esto es más fuerte en estudiantes con ingreso limitado o variable (mesada, medio tiempo, freelance).

## 3. Público objetivo
Estudiantes universitarios de 18 a 28 años en Cali, Colombia, con smartphone, sin ningún control formal de gastos hoy.

## 4. Propuesta de valor
- Registro ultra-rápido (2-3 toques, sin fricción).
- Vista de calendario diaria: todo lo gastado día por día.
- Análisis con IA que detecta patrones ("gastas $40.000 semanales en domicilios sin darte cuenta") y sugiere metas de ahorro realistas basadas en comportamiento real, no en presupuesto genérico.

## 5. Diferenciación frente a competencia
Fintonic, Bankity, BBVA coach financiero, Spendee, Mobills, etc. dependen de Open Banking (poco confiable en Colombia) o están pensadas para presupuestos familiares/compartidos. Esta app apuesta por registro 100% manual con fricción mínima, enfocada en el microgasto del estudiante individual.

## 6. Alcance del MVP (Fases 1 a 3 del roadmap)
**Incluye:**
- Perfil inicial: ocupación, tipo de ingreso, gastos fijos conocidos.
- Registro manual de gasto (monto + categoría rápida) desde vista de calendario.
- Categorías iniciales congeladas: Snacks y bebidas 🥤, Domicilio 🍔, Transporte 🚌, Propina 🪙, Otro ➕.
- Vista de calendario diario con totales por día.
- Gráficos básicos (total por categoría, por semana).
- Autenticación simple (email/password).

**NO incluye en el MVP (ver fases en `07-roadmap-mvp.md`):**
- Análisis con IA / detección de patrones (Fase 5).
- Recomendaciones de ahorro en lenguaje natural (Fase 5).
- Modelo freemium / cobros (Fase 6).
- Atajo de iPhone (se prototipa en paralelo pero no bloquea el MVP web/app).
- App nativa iOS/Android (Fase 7; el MVP es PWA).

## 7. Modelo de negocio (a futuro, no en MVP)
Freemium:
- Gratis: registro manual, calendario, gráficos básicos.
- Premium (~$4.000-8.000 COP/mes): análisis con IA, recomendaciones de ahorro, reportes de tendencia.

## 8. Métricas de éxito del MVP
- % de gastos registrados el mismo día en que ocurren (mide fricción real).
- Retención a 2 semanas de uso diario.
- Tiempo promedio para registrar un gasto (objetivo: menos de 10 segundos).

## 9. Riesgos conocidos
- Dependencia total del registro manual: si el usuario no registra, no hay datos para la IA. Mitigación: el Atajo de iPhone y notificaciones recordatorias.
- Categorías demasiado genéricas vs. demasiado granulares: hay que validar con usuarios reales cuántas categorías son óptimas.
