# PesoXPeso — Política de tratamiento de datos personales

> **BORRADOR.** Este documento es un punto de partida redactado para el MVP. **Debe revisarlo un abogado** y completarse con los datos del responsable antes de abrir la app a usuarios reales. Los campos entre corchetes están por definir. La versión resumida que ve el usuario está en `web/src/paginas/Privacidad.tsx`; si cambia este texto, hay que actualizar esa pantalla.

Marco: Ley 1581 de 2012 y Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015), Colombia.

## 1. Responsable del tratamiento

- Nombre o razón social: [por completar]
- Identificación (cédula o NIT): [por completar]
- Domicilio: [por completar], Cali, Colombia
- Correo para consultas y reclamos: [por completar]

## 2. Datos que se recolectan

| Dato | Para qué | Obligatorio |
|---|---|---|
| Correo electrónico | Identificar la cuenta, verificarla y recuperar la contraseña | Sí |
| Contraseña (solo su hash bcrypt) | Autenticación | Sí |
| Nombre | Saludo en la app | No |
| Ocupación, tipo de ingreso, ingreso estimado, gastos fijos | Contexto del perfil financiero | Ocupación y tipo de ingreso sí; el resto no |
| Gastos: monto, categoría, fecha, hora, nota | Función principal de la app | Sí, para usarla |
| Presupuestos, categorías propias, gastos recurrentes | Funciones opcionales | No |
| Suscripción de notificaciones del navegador | Enviar el recordatorio diario | No |
| Registros técnicos del servidor (ruta, código de respuesta, hora) | Seguridad y diagnóstico | Automático |

No se recolectan datos bancarios, números de tarjeta, ubicación ni contactos. No se recolectan datos sensibles en el sentido del artículo 5 de la Ley 1581. Las notas de los gastos son texto libre: el usuario decide qué escribe en ellas.

## 3. Finalidades

1. Prestar el servicio: registrar, mostrar y resumir los gastos del usuario.
2. Enviar los correos operativos de la cuenta y, si el usuario lo activa, el recordatorio diario.
3. Mantener la seguridad del servicio y diagnosticar fallos.
4. Elaborar estadísticas agregadas y anónimas sobre el uso de la app.

Los datos no se venden ni se usan para publicidad. Cualquier finalidad nueva (por ejemplo, el análisis con inteligencia artificial previsto en el roadmap) requerirá actualizar esta política y pedir de nuevo la autorización.

## 4. Autorización

El usuario otorga su autorización previa, expresa e informada al marcar la casilla de aceptación en el registro. [Pendiente técnico: guardar la fecha y la versión de la política aceptada por cada usuario.]

**Menores de edad:** la app está dirigida a mayores de 18 años. [Definir con el abogado si se permitirá el registro de menores y bajo qué condiciones.]

## 5. Derechos del titular y cómo ejercerlos

| Derecho | Cómo se ejerce en la app |
|---|---|
| Conocer y acceder a sus datos | Están visibles en la app; se descargan en Ajustes → Exportar mis gastos |
| Actualizar y rectificar | Ajustes → Mi perfil financiero; cada gasto se puede editar |
| Suprimir | Ajustes → Borrar mi cuenta: elimina de inmediato la cuenta y todos sus datos |
| Revocar la autorización | Borrando la cuenta o escribiendo al correo del responsable |
| Presentar quejas | Ante el responsable y, agotado ese trámite, ante la Superintendencia de Industria y Comercio |

Las consultas se responden en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles, según los artículos 14 y 15 de la Ley 1581.

## 6. Encargados y transferencias

Los datos se alojan en proveedores de infraestructura que actúan como encargados:

- Alojamiento de la API y la base de datos: [proveedor y país, por completar]
- Alojamiento del frontend: [proveedor y país, por completar]
- Envío de correos: [proveedor y país, por completar]
- Notificaciones push: el servicio del navegador del usuario (Google, Apple o Mozilla), que recibe el contenido del aviso cifrado.

Si alguno está fuera de Colombia hay transmisión internacional de datos. [Verificar con el abogado los requisitos aplicables y los contratos de transmisión.]

## 7. Seguridad

- Conexión cifrada (HTTPS) entre la app y el servidor.
- Contraseñas guardadas con bcrypt; tokens personales y enlaces de correo guardados solo como hash.
- Cada usuario accede únicamente a sus datos; los tokens de los Atajos tienen alcance limitado y son revocables.
- Límite de intentos en inicio de sesión, registro y recuperación de cuenta.
- Los registros del servidor no incluyen contraseñas, tokens ni el contenido de los gastos.

## 8. Conservación

Los datos se conservan mientras la cuenta exista. Al borrar la cuenta se eliminan de la base de datos en el momento. [Definir el plazo de retención de las copias de seguridad y de los registros del servidor.]

## 9. Cambios

Los cambios sustanciales se informarán en la app y por correo antes de entrar en vigor.

Versión: borrador 0.1 — [fecha de entrada en vigor por definir]
