import type { Ocupacion, Perfil, TipoIngreso } from '../tipos';
import { CampoPesos } from './Campos';

const OCUPACIONES: Array<[Ocupacion, string, string]> = [
  ['estudiante', '🎓', 'Solo estudio'],
  ['medio_tiempo', '⏱️', 'Estudio y trabajo'],
  ['freelance', '💻', 'Freelance'],
  ['otro', '✨', 'Otro'],
];
const INGRESOS: Array<[TipoIngreso, string, string]> = [
  ['mesada', '👪', 'Mesada'],
  ['salario', '💼', 'Salario'],
  ['mixto', '🔀', 'Mixto'],
  ['variable', '📈', 'Variable'],
];

export interface ValoresPerfil {
  ocupacion: Ocupacion;
  tipo_ingreso: TipoIngreso;
  ingreso: string; // dígitos; vacío = no lo sé
  fijos: Array<{ nombre: string; monto: string }>;
}

export function perfilInicial(p: Perfil | null): ValoresPerfil {
  return {
    ocupacion: p?.ocupacion ?? 'estudiante',
    tipo_ingreso: p?.tipo_ingreso ?? 'mesada',
    ingreso: p?.ingreso_estimado != null ? String(p.ingreso_estimado) : '',
    fijos: Object.entries(p?.gastos_fijos ?? {}).map(([nombre, monto]) => ({ nombre, monto: String(monto) })),
  };
}

export function perfilParaApi(v: ValoresPerfil) {
  const gastos_fijos: Record<string, number> = {};
  for (const f of v.fijos) {
    const nombre = f.nombre.trim();
    if (nombre && f.monto) gastos_fijos[nombre] = Number(f.monto);
  }
  return {
    ocupacion: v.ocupacion,
    tipo_ingreso: v.tipo_ingreso,
    ingreso_estimado: v.ingreso ? Number(v.ingreso) : null,
    gastos_fijos,
  };
}

function Grupo<T extends string>(props: {
  titulo: string;
  opciones: Array<[T, string, string]>;
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="pila-s">
      <span className="etiqueta">{props.titulo}</span>
      <div className="opciones" role="radiogroup" aria-label={props.titulo}>
        {props.opciones.map(([valor, emoji, texto]) => (
          <button
            key={valor}
            type="button"
            role="radio"
            className="opcion"
            aria-checked={props.valor === valor}
            onClick={() => props.onChange(valor)}
          >
            <span className="emoji" aria-hidden>
              {emoji}
            </span>
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FormularioPerfil({ valores, onChange }: { valores: ValoresPerfil; onChange: (v: ValoresPerfil) => void }) {
  const cambiarFijo = (i: number, cambio: Partial<{ nombre: string; monto: string }>) =>
    onChange({ ...valores, fijos: valores.fijos.map((f, j) => (j === i ? { ...f, ...cambio } : f)) });

  return (
    <>
      <Grupo titulo="¿A qué te dedicas?" opciones={OCUPACIONES} valor={valores.ocupacion} onChange={(ocupacion) => onChange({ ...valores, ocupacion })} />
      <Grupo titulo="¿De dónde viene tu plata?" opciones={INGRESOS} valor={valores.tipo_ingreso} onChange={(tipo_ingreso) => onChange({ ...valores, tipo_ingreso })} />
      <label className="campo">
        <span>¿Cuánto recibes al mes, más o menos? (opcional)</span>
        <CampoPesos valor={valores.ingreso} onChange={(ingreso) => onChange({ ...valores, ingreso })} placeholder="Ej.: 500.000" />
      </label>
      <div className="pila-s">
        <span className="etiqueta">Gastos fijos del mes (opcional)</span>
        <p className="tenue">Arriendo, servicios, plan del celular… lo que pagas sí o sí.</p>
        {valores.fijos.map((f, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: las filas no tienen id y solo se agregan o quitan al final o por posición
          <div className="fila" key={i}>
            <input type="text" className="crece" aria-label="Nombre del gasto fijo" placeholder="Arriendo" maxLength={60} value={f.nombre} onChange={(e) => cambiarFijo(i, { nombre: e.target.value })} />
            <div style={{ width: 130, flex: 'none' }}>
              <CampoPesos valor={f.monto} onChange={(monto) => cambiarFijo(i, { monto })} aria-label="Monto del gasto fijo" />
            </div>
            <button type="button" className="icono-btn" aria-label="Quitar" onClick={() => onChange({ ...valores, fijos: valores.fijos.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="btn chico" onClick={() => onChange({ ...valores, fijos: [...valores.fijos, { nombre: '', monto: '' }] })}>
            + Agregar gasto fijo
          </button>
        </div>
      </div>
    </>
  );
}
