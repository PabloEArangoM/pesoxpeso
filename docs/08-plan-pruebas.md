# PesoXPeso — Plan de Pruebas con Usuarios Reales

## Objetivo
Validar que el registro de gastos es realmente de baja fricción y que el calendario diario es útil, antes de invertir en la capa de IA (Fase 5).

## Participantes
- 10-15 estudiantes de la Universidad Libre Cali (puede apoyarse en la encuesta pendiente de la clase de Evaluación y Formulación de Proyectos).
- Perfil variado: mesada, medio tiempo, freelance — para no sesgar hacia un solo tipo de ingreso.

## Duración
2 semanas de uso real (no una sola sesión de prueba), para medir hábito y no solo primera impresión.

## Qué se mide

**Cuantitativo:**
- % de días en los que el usuario registró al menos un gasto.
- % de gastos registrados el mismo día en que ocurrieron (vs. registrados días después, que indica que no es "sin fricción").
- Tiempo promedio de registro (se puede instrumentar con un timestamp de apertura del modal vs. guardado).
- Número de gastos por usuario por semana.

**Cualitativo (entrevista corta al final de las 2 semanas):**
- ¿En qué momentos se te olvidó registrar? ¿Por qué?
- ¿Las 5 categorías por defecto (snacks y bebidas, domicilio, transporte, propina, otro) te alcanzaron o te faltó alguna?
- ¿Revisaste el calendario o los gráficos por tu cuenta, sin que te lo pidiéramos?
- ¿Usarías esto si tuviera análisis con IA? ¿Pagarías por eso?

## Criterio de éxito para pasar a Fase 5 (IA)
- Al menos 70% de los gastos registrados el mismo día.
- Uso activo (al menos un registro) en al menos 10 de los 14 días, en la mayoría de los participantes.
- Sin quejas recurrentes sobre las categorías o el flujo de registro (si las hay, se ajusta antes de meter IA encima).

## Instrumentación técnica sugerida
- Guardar `creado_en` (timestamp real de registro) además de `fecha` (fecha del gasto) en la tabla `gastos`, para poder calcular el delta entre cuándo ocurrió el gasto y cuándo se registró.
- Un evento simple de analítica al abrir el modal y otro al guardar, para medir tiempo de registro sin instrumentación compleja.
