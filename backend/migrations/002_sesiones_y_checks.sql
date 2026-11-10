-- Revocación de sesiones: cada refresh token lleva la versión vigente al firmarse.
-- Al cambiar la contraseña (o cerrar todas las sesiones) se incrementa y los anteriores dejan de servir.
ALTER TABLE usuarios ADD COLUMN sesion_version integer NOT NULL DEFAULT 0;

-- Los mismos valores que valida la API, ahora también en la base.
ALTER TABLE perfil_financiero
  ADD CONSTRAINT perfil_ocupacion_chk
    CHECK (ocupacion IN ('estudiante', 'medio_tiempo', 'freelance', 'otro')),
  ADD CONSTRAINT perfil_tipo_ingreso_chk
    CHECK (tipo_ingreso IN ('mesada', 'salario', 'mixto', 'variable'));
