import { Link } from 'react-router-dom';
import { SeccionAtajo, SeccionBorrarCuenta, SeccionExportar, SeccionRecordatorios, SeccionSeguridad } from './ajustes/Cuenta';
import { SeccionCategorias, SeccionPerfil, SeccionPresupuesto, SeccionRecurrentes } from './ajustes/Dinero';

export function Ajustes() {
  return (
    <>
      <div className="cabecera">
        <h1>Ajustes</h1>
      </div>
      <div className="pila-s">
        <SeccionPresupuesto />
        <SeccionCategorias />
        <SeccionRecurrentes />
        <SeccionRecordatorios />
        <SeccionAtajo />
        <SeccionExportar />
        <SeccionPerfil />
        <SeccionSeguridad />
        <SeccionBorrarCuenta />
      </div>
      <p className="tenue" style={{ textAlign: 'center' }}>
        <Link to="/privacidad">Política de privacidad</Link> · PesoXPeso
      </p>
    </>
  );
}
