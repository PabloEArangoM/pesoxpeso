import { type FormEvent, useState } from 'react';
import { api, mensajeDe } from '../api';
import { MensajeError } from '../componentes/Campos';
import { FormularioPerfil, perfilInicial, perfilParaApi, type ValoresPerfil } from '../componentes/FormularioPerfil';
import { useDatos } from '../contexto';
import type { Perfil } from '../tipos';

/** Perfil inicial: tres preguntas y a anotar. */
export function Onboarding() {
  const { cuenta, setPerfil, salir } = useDatos();
  const [valores, setValores] = useState<ValoresPerfil>(perfilInicial(null));
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError(null);
    try {
      setPerfil(await api.post<Perfil>('/perfil', perfilParaApi(valores)));
    } catch (err) {
      setError(mensajeDe(err));
      setOcupado(false);
    }
  }

  return (
    <main className="acceso" style={{ justifyContent: 'flex-start' }}>
      <div className="marca-app">
        <img src="/icon.svg" alt="" /> PesoXPeso
      </div>
      <div className="pila-s">
        <h1>{cuenta?.nombre ? `Hola, ${cuenta.nombre}` : 'Bienvenido'}</h1>
        <p className="suave">Cuéntanos un poco de tu plata. Lo puedes cambiar después en Ajustes.</p>
      </div>
      <form className="pila" onSubmit={guardar}>
        <FormularioPerfil valores={valores} onChange={setValores} />
        <MensajeError>{error}</MensajeError>
        <button type="submit" className="btn primario bloque" disabled={ocupado}>
          Empezar
        </button>
      </form>
      <button type="button" className="btn-texto" onClick={salir}>
        Cerrar sesión
      </button>
    </main>
  );
}
