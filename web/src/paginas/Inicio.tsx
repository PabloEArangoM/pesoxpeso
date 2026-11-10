import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, mensajeDe } from '../api';
import { Estado } from '../componentes/Campos';
import { Medidor } from '../componentes/Graficos';
import { ListaGastos } from '../componentes/ListaGastos';
import { useRegistro } from '../componentes/Marco';
import { useCarga, useDatos } from '../contexto';
import { fechaLarga, mayuscula, pesos } from '../formato';
import type { Rango, Resumen } from '../tipos';

function Racha({ r }: { r: Resumen['racha'] }) {
  let texto: string;
  if (r.actual === 0) texto = 'Anota un gasto hoy para empezar tu racha.';
  else if (r.registro_hoy) texto = r.actual === 1 ? 'Primer día de racha. ¡Vuelve mañana!' : `Llevas ${r.actual} días seguidos anotando.`;
  else texto = `Racha de ${r.actual} ${r.actual === 1 ? 'día' : 'días'}. Anota hoy para no perderla.`;
  return (
    <div className="tarjeta fila">
      <span style={{ fontSize: '1.8rem' }} aria-hidden>
        {r.actual > 0 ? '🔥' : '🌱'}
      </span>
      <div className="crece">
        <div style={{ fontWeight: 600 }}>{texto}</div>
        {r.mejor > 0 && <div className="tenue">Tu mejor racha: {r.mejor} {r.mejor === 1 ? 'día' : 'días'}</div>}
      </div>
    </div>
  );
}

function AvisoCorreo() {
  const { cuenta, avisar } = useDatos();
  const [enviado, setEnviado] = useState(false);
  if (!cuenta || cuenta.email_verificado) return null;
  async function reenviar() {
    try {
      await api.post('/auth/reenviar-verificacion');
      setEnviado(true);
    } catch (e) {
      avisar(mensajeDe(e));
    }
  }
  return (
    <div className="aviso fila entre ajusta">
      <span>{enviado ? `Enlace enviado a ${cuenta.email}.` : 'Confirma tu correo para poder recuperar tu cuenta.'}</span>
      {!enviado && (
        <button type="button" className="btn-texto" onClick={reenviar}>
          Reenviar enlace
        </button>
      )}
    </div>
  );
}

export function Inicio() {
  const { cuenta } = useDatos();
  const { anotar, editar } = useRegistro();
  const [params, setParams] = useSearchParams();
  const resumen = useCarga(() => api.get<Resumen>('/resumen'), []);
  const dia = useCarga(() => api.get<Rango>('/gastos'), []);

  // ?nuevo=1 llega desde el recordatorio y desde el acceso directo de la app instalada.
  useEffect(() => {
    if (params.get('nuevo')) {
      anotar();
      setParams({}, { replace: true });
    }
  }, [params, setParams, anotar]);

  if (!resumen.datos || !dia.datos) {
    return <Estado error={resumen.error ?? dia.error} reintentar={() => { resumen.reintentar(); dia.reintentar(); }} />;
  }
  const r = resumen.datos;
  const { semanal, mensual } = r.presupuesto;

  return (
    <>
      <header>
        <p className="tenue">{mayuscula(fechaLarga(r.fecha))}</p>
        <h1>{cuenta?.nombre ? `Hola, ${cuenta.nombre}` : 'Hola'}</h1>
      </header>

      <AvisoCorreo />

      <section className="cifras" aria-label="Totales">
        <div className="cifra principal">
          <div className="rotulo">Hoy llevas</div>
          <div className="valor num">{pesos(r.total_dia)}</div>
        </div>
        <div className="cifra">
          <div className="rotulo">Esta semana</div>
          <div className="valor num">{pesos(r.total_semana)}</div>
        </div>
        <div className="cifra" style={{ gridColumn: 'span 2' }}>
          <div className="rotulo">Este mes</div>
          <div className="valor num">{pesos(r.total_mes)}</div>
        </div>
      </section>

      {semanal || mensual ? (
        <section className="tarjeta pila">
          <h2 style={{ marginBottom: 0 }}>Presupuesto</h2>
          {semanal && <Medidor titulo="Semanal" p={semanal} />}
          {mensual && <Medidor titulo="Mensual" p={mensual} />}
        </section>
      ) : (
        <p className="tenue">
          ¿Quieres un tope de gasto? <Link to="/ajustes#presupuesto">Define un presupuesto</Link>.
        </p>
      )}

      <Racha r={r.racha} />

      <section className="tarjeta">
        <h2>Gastos de hoy</h2>
        {dia.datos.gastos.length ? (
          <ListaGastos gastos={dia.datos.gastos} alTocar={editar} />
        ) : (
          <div className="vacio">
            <span className="emoji" aria-hidden>
              🪙
            </span>
            Aún no has anotado nada hoy.
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn primario" onClick={() => anotar()}>
                Anotar un gasto
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
