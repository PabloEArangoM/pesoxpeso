import { pesos } from '../formato';
import type { Gasto } from '../tipos';

export function ListaGastos({ gastos, alTocar }: { gastos: Gasto[]; alTocar: (g: Gasto) => void }) {
  return (
    <ul className="lista">
      {gastos.map((g) => (
        <li key={g.id}>
          <button type="button" className="gasto" onClick={() => alTocar(g)} aria-label={`Editar ${g.categoria}, ${pesos(g.monto)}`}>
            <span className="emoji" aria-hidden>
              {g.icono}
            </span>
            <span className="crece">
              <span className="nombre">{g.categoria}</span>
              <span className="detalle" style={{ display: 'block' }}>
                {[g.recurrente ? 'Automático' : g.hora, g.nota].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="monto num">{pesos(g.monto)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
