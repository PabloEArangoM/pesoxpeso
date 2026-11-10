export interface Gasto {
  id: string;
  monto: number;
  categoria_id: string;
  categoria: string;
  icono: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  nota: string;
  recurrente: boolean;
}

export interface GastoCreado extends Gasto {
  resumen: { total_dia: number; total_semana: number; total_mes: number; alertas: string[] };
}

export interface Categoria {
  id: string;
  nombre: string;
  icono: string;
  propia: boolean;
}

export type EstadoPresupuesto = 'ok' | 'cerca' | 'excedido';
export interface Presupuesto {
  monto: number;
  gastado: number;
  restante: number;
  porcentaje: number;
  estado: EstadoPresupuesto;
}
export interface Presupuestos {
  semanal: Presupuesto | null;
  mensual: Presupuesto | null;
}

export interface Resumen {
  fecha: string;
  total_dia: number;
  total_semana: number;
  total_mes: number;
  presupuesto: Presupuestos;
  racha: { actual: number; mejor: number; registro_hoy: boolean };
}

export interface Rango {
  desde: string;
  hasta: string;
  total: number;
  por_dia: Record<string, number>;
  por_categoria: Record<string, number>;
  gastos: Gasto[];
}

export interface Cuenta {
  id: string;
  email: string;
  nombre: string | null;
  email_verificado: boolean;
  recordatorio_activo: boolean;
  recordatorio_hora: string;
  push: { disponible: boolean; clave_publica: string | null };
}

export type Ocupacion = 'estudiante' | 'medio_tiempo' | 'freelance' | 'otro';
export type TipoIngreso = 'mesada' | 'salario' | 'mixto' | 'variable';
export interface Perfil {
  ocupacion: Ocupacion;
  tipo_ingreso: TipoIngreso;
  ingreso_estimado: number | null;
  gastos_fijos: Record<string, number>;
}

export type Frecuencia = 'diaria' | 'semanal' | 'mensual';
export interface Recurrente {
  id: string;
  monto: number;
  categoria_id: string;
  categoria: string;
  icono: string;
  nota: string;
  frecuencia: Frecuencia;
  inicio: string;
  proxima_fecha: string;
  activo: boolean;
}

export interface ApiToken {
  id: string;
  nombre: string;
  creado_en: string;
  ultimo_uso: string | null;
  token?: string; // solo al crearlo
}
