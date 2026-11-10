import { conMiles, soloDigitos } from '../formato';

/** Campo de pesos: solo deja escribir dígitos y muestra los miles ("18.000"). Entrega los dígitos. */
export function CampoPesos(props: {
  valor: string;
  onChange: (digitos: string) => void;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
}) {
  return (
    <input
      id={props.id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      autoFocus={props.autoFocus}
      aria-label={props['aria-label']}
      placeholder={props.placeholder ?? '0'}
      value={conMiles(props.valor)}
      onChange={(e) => props.onChange(soloDigitos(e.target.value))}
    />
  );
}

export function MensajeError({ children }: { children: string | null | undefined }) {
  if (!children) return null;
  return (
    <p className="error" role="alert">
      {children}
    </p>
  );
}

/** Estado de carga o error de una pantalla, con botón de reintento. */
export function Estado({ error, reintentar }: { error: unknown; reintentar: () => void }) {
  if (!error) return <div className="cargando">Cargando…</div>;
  return (
    <div className="vacio">
      <p>No se pudieron cargar los datos.</p>
      <button type="button" className="btn chico" style={{ marginTop: 12 }} onClick={reintentar}>
        Reintentar
      </button>
    </div>
  );
}
