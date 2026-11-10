import { type ReactNode, useState } from 'react';
import { mensajeDe } from '../../api';
import { useDatos } from '../../contexto';

/** Bloque plegable de Ajustes. Se abre solo si la URL trae su ancla (#presupuesto). */
export function Seccion(props: { id: string; emoji: string; titulo: string; children: ReactNode }) {
  return (
    <details className="seccion" id={props.id} open={window.location.hash === `#${props.id}`}>
      <summary>
        <span className="emoji" aria-hidden>
          {props.emoji}
        </span>
        {props.titulo}
      </summary>
      <div className="cuerpo">{props.children}</div>
    </details>
  );
}

/** Ejecuta una acción mostrando el resultado como aviso; devuelve si está en curso. */
export function useAccion() {
  const { avisar } = useDatos();
  const [ocupado, setOcupado] = useState(false);
  async function ejecutar(fn: () => Promise<unknown>, exito?: string): Promise<boolean> {
    setOcupado(true);
    try {
      await fn();
      if (exito) avisar(exito);
      return true;
    } catch (e) {
      avisar(mensajeDe(e));
      return false;
    } finally {
      setOcupado(false);
    }
  }
  return { ocupado, ejecutar };
}
