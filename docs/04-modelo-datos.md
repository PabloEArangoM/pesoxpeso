# PesoXPeso — Modelo de Datos

## Diagrama entidad-relación

```mermaid
erDiagram
    USUARIOS ||--o{ GASTOS : registra
    USUARIOS ||--|| PERFIL_FINANCIERO : tiene
    USUARIOS ||--o{ API_TOKENS : genera
    USUARIOS ||--o{ RECOMENDACIONES_IA : recibe
    USUARIOS ||--o{ TOKENS_EMAIL : solicita
    USUARIOS ||--o{ PUSH_SUSCRIPCIONES : registra
    USUARIOS ||--o{ PRESUPUESTOS : define
    USUARIOS ||--o{ GASTOS_RECURRENTES : programa
    USUARIOS ||--o{ CATEGORIAS : crea
    GASTOS_RECURRENTES ||--o{ GASTOS : genera
    GASTOS_RECURRENTES }o--|| CATEGORIAS : pertenece_a
    GASTOS }o--|| CATEGORIAS : pertenece_a

    USUARIOS {
        uuid id PK
        string nombre
        string email
        string password_hash
        int sesion_version
        boolean email_verificado
        boolean recordatorio_activo
        time recordatorio_hora
        date ultimo_recordatorio
        timestamp creado_en
    }

    TOKENS_EMAIL {
        uuid id PK
        uuid usuario_id FK
        string tipo
        string token_hash
        timestamp expira_en
        timestamp usado_en
    }

    PUSH_SUSCRIPCIONES {
        uuid id PK
        uuid usuario_id FK
        string endpoint
        string p256dh
        string auth
    }

    PRESUPUESTOS {
        uuid usuario_id PK
        string periodo PK
        int monto
    }

    GASTOS_RECURRENTES {
        uuid id PK
        uuid usuario_id FK
        uuid categoria_id FK
        int monto
        string nota
        string frecuencia
        date inicio
        date proxima_fecha
        boolean activo
    }

    API_TOKENS {
        uuid id PK
        uuid usuario_id FK
        string token_hash
        string nombre
        timestamp creado_en
        timestamp ultimo_uso
    }

    PERFIL_FINANCIERO {
        uuid id PK
        uuid usuario_id FK
        string ocupacion
        string tipo_ingreso
        int ingreso_estimado
        jsonb gastos_fijos
    }

    CATEGORIAS {
        uuid id PK
        string nombre
        string icono
        boolean es_default
        int orden
        uuid usuario_id FK
    }

    GASTOS {
        uuid id PK
        uuid usuario_id FK
        uuid categoria_id FK
        int monto
        date fecha
        time hora
        string nota
        uuid recurrente_id FK
        timestamp creado_en
    }

    RECOMENDACIONES_IA {
        uuid id PK
        uuid usuario_id FK
        string tipo
        text mensaje
        jsonb datos_soporte
        timestamp generado_en
        boolean leido
    }
```

## Notas de diseño

- **usuarios**: autenticación básica en MVP (email/password). Se puede migrar a OAuth después sin tocar el resto del modelo.
- **usuarios.sesion_version**: cada refresh token lleva la versión vigente al firmarse. Cambiar la contraseña o cerrar sesiones la incrementa, y con eso quedan revocados todos los refresh anteriores sin necesidad de una tabla de sesiones.
- **Borrado de cuenta**: `api_tokens`, `perfil_financiero` y `gastos` referencian a `usuarios` con `ON DELETE CASCADE`, así que borrar el usuario elimina todos sus datos.
- **api_tokens**: tokens personales de larga duración (guardados como hash) pensados para el Atajo de iPhone, que no puede renovar un JWT corto. Se pueden revocar desde la app sin cerrar sesión.
- **perfil_financiero**: relación 1 a 1 con usuario. `gastos_fijos` como JSONB para no crear una tabla aparte en el MVP (ej: `{"arriendo": 400000, "servicios": 80000}`). `ocupacion` y `tipo_ingreso` tienen `CHECK` en la base con los mismos valores que valida la API.
- **categorias**: `usuario_id` nulo = categoría por defecto, visible para todos (snacks y bebidas, domicilio, transporte, propina, otro); con valor = categoría propia de ese usuario. El nombre es único entre las de por defecto y, aparte, dentro de las de cada usuario. Al borrar una propia, sus gastos pasan a *Otro*. **Ojo:** como `categorias` referencia a `usuarios`, un `TRUNCATE usuarios CASCADE` vaciaría también las de por defecto; para limpiar se usa `DELETE FROM usuarios`.
- **tokens_email**: enlaces de un solo uso para verificar el correo (48 h) y recuperar la contraseña (1 h). Solo se guarda el hash; pedir uno nuevo invalida el anterior del mismo tipo.
- **push_suscripciones**: una fila por navegador que aceptó notificaciones. `usuarios.ultimo_recordatorio` evita avisar dos veces el mismo día.
- **presupuestos**: como máximo uno semanal y uno mensual por usuario (clave primaria compuesta).
- **gastos_recurrentes**: `inicio` fija el día de la semana o del mes y `proxima_fecha` es la siguiente vez que toca. Los gastos que generan llevan `gastos.recurrente_id` (queda en `NULL` si se borra el recurrente) y no cuentan para la racha.
- **monto (gastos) e ingreso_estimado**: enteros en pesos colombianos. COP no se usa con decimales en el día a día, y así se evitan errores de redondeo y strings numéricos en el driver.
- **gastos**: la tabla central. Índice compuesto en `(usuario_id, fecha)` porque la consulta más frecuente es "gastos de este usuario en este día/rango".
- **recomendaciones_ia**: aún no existe en la base; se crea en la Fase 5 (IA). `datos_soporte` guarda el JSON con los números que sustentan la recomendación (para poder mostrar el gráfico de detalle sin recalcular).

## Consultas frecuentes a optimizar
- Gastos por usuario y rango de fechas (vista calendario) → índice `(usuario_id, fecha)`.
- Suma de gastos por categoría en un rango (gráficos) → índice `(usuario_id, categoria_id, fecha)` o agregación en el backend con cache corto.
