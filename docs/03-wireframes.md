# PesoXPeso — Wireframes: Especificación de Pantallas Principales

Nota: esto es la especificación de layout y jerarquía para que la pases a Figma o dibujes a mano. No es diseño visual final, es estructura.

## 1. Perfil inicial (Onboarding)
```
┌─────────────────────────────┐
│  Logo / Título app          │
│                              │
│  ¿Cuál es tu ocupación?     │
│  [Estudiante] [Medio tiempo]│
│  [Freelance]  [Otro]        │
│                              │
│  ¿Cómo es tu ingreso?       │
│  [Mesada] [Salario]         │
│  [Mixto]  [Variable]        │
│                              │
│  Gastos fijos (opcional)    │
│  [+ Agregar gasto fijo]     │
│                              │
│       [ Continuar ]         │
└─────────────────────────────┘
```
Jerarquía: pregunta → opciones tipo chip (selección única) → gastos fijos como lista expandible opcional → CTA único abajo.

## 2. Calendario diario (pantalla principal)
```
┌─────────────────────────────┐
│  < Septiembre 2026 >        │
│  L  M  M  J  V  S  D        │
│  .  .  ●  ●  ●  .  .        │
│        ▲hoy                 │
│                              │
│  Hoy — Total: $23.500       │
│  ─────────────────────      │
│  🍔 Domicilio    $18.000    │
│  🥤 Snacks/bebidas $3.500    │
│  🚌 Transporte    $2.000    │
│                              │
│                        (+)  │
└─────────────────────────────┘
```
Jerarquía: navegación de mes arriba → indicadores de días con gasto → día seleccionado con total destacado → lista de gastos del día → botón flotante "+" siempre visible (acción principal de la pantalla).

## 3. Modal de registro rápido
```
┌─────────────────────────────┐
│         Nuevo gasto     [x] │
│                              │
│         $ [________]        │
│      (teclado numérico)     │
│                              │
│  [Snacks y bebidas][Domicilio]       │
│  [Transporte][Propina]      │
│  [Otro]                     │
│                              │
│        [ Guardar ]          │
└─────────────────────────────┘
```
Jerarquía: campo de monto con foco automático → categorías como chips de una sola fila/wrap → un solo botón de acción. Nada de campos opcionales que agreguen fricción.

## 4. Pantalla de análisis / recomendaciones IA (Fase 2)
```
┌─────────────────────────────┐
│  Análisis de tus gastos     │
│                              │
│  ⚠ Patrón detectado         │
│  "Gastas $40.000/semana en  │
│   domicilios sin notarlo"   │
│         [Ver detalle]       │
│                              │
│  💡 Meta sugerida           │
│  "Reduce domicilios a 2x    │
│   por semana y ahorra       │
│   $60.000 al mes"           │
│         [Ver detalle]       │
└─────────────────────────────┘
```
Jerarquía: tarjetas apilables tipo "insight card", cada una con ícono de tipo (alerta/oportunidad), texto en lenguaje natural corto, y acción secundaria para profundizar.

## 5. Vista de gráficos básicos (MVP, sin IA)
```
┌─────────────────────────────┐
│  Esta semana                │
│  [Gráfico de barras por     │
│   categoría]                │
│                              │
│  Total semana: $87.300      │
│                              │
│  Este mes                   │
│  [Gráfico de línea diario]  │
└─────────────────────────────┘
```
