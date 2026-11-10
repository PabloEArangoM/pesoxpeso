-- Fase 2: categorías propias, presupuestos, gastos recurrentes, correos, recordatorios.

-- ---------- Cuenta ----------
ALTER TABLE usuarios
  ADD COLUMN email_verificado    boolean NOT NULL DEFAULT false,
  ADD COLUMN recordatorio_activo boolean NOT NULL DEFAULT false,
  ADD COLUMN recordatorio_hora   time    NOT NULL DEFAULT '20:00',
  ADD COLUMN ultimo_recordatorio date;

-- Enlaces de un solo uso enviados por correo. Solo se guarda el hash.
CREATE TABLE tokens_email (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo       text NOT NULL CHECK (tipo IN ('verificacion', 'recuperacion')),
  token_hash text NOT NULL UNIQUE,
  expira_en  timestamptz NOT NULL,
  usado_en   timestamptz,
  creado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tokens_email_usuario_idx ON tokens_email (usuario_id, tipo);

-- Suscripciones Web Push (una por navegador/dispositivo) para los recordatorios.
CREATE TABLE push_suscripciones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  creado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_suscripciones_usuario_idx ON push_suscripciones (usuario_id);

-- ---------- Categorías propias ----------
-- usuario_id NULL = categoría por defecto, visible para todos.
ALTER TABLE categorias ADD COLUMN usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE categorias DROP CONSTRAINT categorias_nombre_key;
CREATE UNIQUE INDEX categorias_default_nombre_uq ON categorias (lower(nombre)) WHERE usuario_id IS NULL;
CREATE UNIQUE INDEX categorias_usuario_nombre_uq ON categorias (usuario_id, lower(nombre)) WHERE usuario_id IS NOT NULL;

-- ---------- Presupuestos ----------
CREATE TABLE presupuestos (
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  periodo    text NOT NULL CHECK (periodo IN ('semanal', 'mensual')),
  monto      integer NOT NULL CHECK (monto > 0),
  PRIMARY KEY (usuario_id, periodo)
);

-- ---------- Gastos recurrentes ----------
CREATE TABLE gastos_recurrentes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria_id  uuid NOT NULL REFERENCES categorias(id),
  monto         integer NOT NULL CHECK (monto > 0),
  nota          text NOT NULL DEFAULT '',
  frecuencia    text NOT NULL CHECK (frecuencia IN ('diaria', 'semanal', 'mensual')),
  -- inicio fija el día de la semana o del mes; proxima_fecha es la siguiente vez que toca.
  inicio        date NOT NULL,
  proxima_fecha date NOT NULL,
  activo        boolean NOT NULL DEFAULT true,
  creado_en     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gastos_recurrentes_pendientes_idx ON gastos_recurrentes (proxima_fecha) WHERE activo;
CREATE INDEX gastos_recurrentes_usuario_idx ON gastos_recurrentes (usuario_id);

-- Marca los gastos creados automáticamente (no cuentan para la racha).
ALTER TABLE gastos ADD COLUMN recurrente_id uuid REFERENCES gastos_recurrentes(id) ON DELETE SET NULL;
