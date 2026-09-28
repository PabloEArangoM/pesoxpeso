-- PesoXPeso — esquema inicial (Fase 1)

CREATE TABLE usuarios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text,
  email         text NOT NULL,
  password_hash text NOT NULL,
  creado_en     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usuarios_email_uq ON usuarios (lower(email));

-- Tokens personales de larga duración (Atajo de iPhone). Se guarda solo el hash.
CREATE TABLE api_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  nombre     text NOT NULL,
  creado_en  timestamptz NOT NULL DEFAULT now(),
  ultimo_uso timestamptz
);
CREATE INDEX api_tokens_usuario_idx ON api_tokens (usuario_id);

CREATE TABLE perfil_financiero (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       uuid NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  ocupacion        text NOT NULL,
  tipo_ingreso     text NOT NULL,
  ingreso_estimado integer CHECK (ingreso_estimado IS NULL OR ingreso_estimado >= 0),
  gastos_fijos     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE categorias (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL UNIQUE,
  icono      text NOT NULL,
  es_default boolean NOT NULL DEFAULT true,
  orden      integer NOT NULL DEFAULT 0
);

INSERT INTO categorias (nombre, icono, orden) VALUES
  ('Snacks y bebidas', '🥤', 1),
  ('Domicilio',        '🍔', 2),
  ('Transporte',       '🚌', 3),
  ('Propina',          '🪙', 4),
  ('Otro',             '➕', 5);

-- monto en pesos colombianos enteros (COP no usa decimales en el día a día)
CREATE TABLE gastos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES categorias(id),
  monto        integer NOT NULL CHECK (monto > 0),
  fecha        date NOT NULL,
  hora         time NOT NULL,
  nota         text NOT NULL DEFAULT '',
  creado_en    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gastos_usuario_fecha_idx ON gastos (usuario_id, fecha);
CREATE INDEX gastos_usuario_cat_fecha_idx ON gastos (usuario_id, categoria_id, fecha);
