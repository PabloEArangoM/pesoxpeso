# PesoXPeso — Historias de Usuario y Flujos Clave

## Historias de usuario (MVP)

1. **Como** estudiante nuevo en la app, **quiero** llenar un perfil inicial con mi ocupación, tipo de ingreso y gastos fijos, **para que** la app tenga contexto de mi situación financiera.
2. **Como** estudiante, **quiero** registrar un gasto en 2-3 toques, **para** no perder el hilo del día ni sentir que "toca ponerse a hacer cuentas".
3. **Como** estudiante, **quiero** ver un calendario con lo que gasté cada día, **para** entender de un vistazo en qué días gasto más.
4. **Como** estudiante, **quiero** ver un total y un desglose por categoría de la semana/mes, **para** identificar en qué se me va la plata.
5. **Como** estudiante, **quiero** editar o borrar un gasto mal registrado, **para** mantener mis datos correctos.
6. **Como** estudiante, **quiero** entrar a la app y que abra directo en el día de hoy, **para** no perder tiempo navegando.

## Historias de usuario (Fase 2 — IA)

7. **Como** estudiante, **quiero** recibir una alerta cuando un patrón de gasto se sale de lo normal, **para** tomar acción antes de fin de mes.
8. **Como** estudiante, **quiero** que la app me sugiera una meta de ahorro realista basada en mi comportamiento, **para** no recibir consejos genéricos que no aplican a mi caso.

## Flujo 1 — Onboarding / Perfil inicial
1. Pantalla de bienvenida → botón "Empezar".
2. Formulario: ocupación (estudiante/medio tiempo/freelance/otro), tipo de ingreso (mesada/salario/mixto/variable), gastos fijos conocidos (arriendo, servicios, transporte fijo — opcional, se puede saltar).
3. Confirmación → redirige directo al calendario del día actual.

## Flujo 2 — Registro rápido de gasto
1. Usuario está en el calendario (día actual visible por defecto).
2. Toca botón flotante "+".
3. Modal simple: monto (teclado numérico abierto de una) + selector de categoría (chips: snacks y bebidas, domicilio, transporte, propina, otro).
4. Toca "Guardar" → modal se cierra, el gasto aparece en el día, total del día se actualiza.
   - Total: 2 toques (abrir modal + guardar) más digitar el monto.

## Flujo 3 — Vista de calendario
1. Vista mensual con puntos/indicadores en los días que tienen gastos.
2. Tocar un día → despliega lista de gastos de ese día con hora, monto y categoría.
3. Swipe o botón para moverse entre semanas/meses.

## Flujo 4 — Análisis con IA (Fase 2)
1. Usuario entra a pestaña "Análisis".
2. Ve tarjetas de insights generados: patrón detectado + recomendación en lenguaje natural.
3. Puede tocar "Ver detalle" para el gráfico de tendencia que sustenta ese insight.

## Flujo 5 — Registro vía Atajo de iPhone (paralelo, no bloquea la app)
1. Usuario activa el Atajo desde botón de Acción o ícono en pantalla de inicio.
2. Atajo pregunta monto → pregunta categoría (menú) → hace POST al backend.
3. Notificación de confirmación aparece sin haber abierto la app.
