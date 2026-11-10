import { Link } from 'react-router-dom';

/**
 * Resumen legible de la política de tratamiento de datos.
 * El texto completo (borrador pendiente de revisión legal) está en docs/10-politica-tratamiento-datos.md.
 */
export function Privacidad() {
  return (
    <main className="app prosa" style={{ paddingBottom: 48 }}>
      <p>
        <Link to="/">← Volver</Link>
      </p>
      <h1>Política de privacidad</h1>
      <p className="aviso alerta">
        Borrador: PesoXPeso está en pruebas. Este texto debe ser revisado por un abogado y completado con los datos del responsable antes de abrir la app al público.
      </p>

      <h2>Qué datos guardamos</h2>
      <ul>
        <li>Tu correo, tu nombre (si lo das) y tu contraseña, que se guarda cifrada con un hash irreversible.</li>
        <li>Tu perfil financiero: ocupación, tipo de ingreso, ingreso estimado y gastos fijos.</li>
        <li>Los gastos que anotas: monto, categoría, fecha, hora y nota.</li>
        <li>Tus presupuestos, categorías propias y gastos recurrentes.</li>
        <li>Si activas el recordatorio, el identificador que tu navegador entrega para enviarte notificaciones.</li>
      </ul>
      <p>No pedimos ni guardamos datos bancarios, números de tarjeta ni tu ubicación.</p>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Mostrarte tus gastos, totales, gráficos, presupuesto y racha.</li>
        <li>Enviarte los correos de la cuenta (confirmar correo, recuperar contraseña) y el recordatorio diario si lo activas.</li>
      </ul>
      <p>No vendemos tus datos ni los usamos para publicidad.</p>

      <h2>Tus derechos (Ley 1581 de 2012)</h2>
      <ul>
        <li>
          <b>Conocer y llevarte tus datos:</b> los ves en la app y los descargas en Ajustes → Exportar mis gastos.
        </li>
        <li>
          <b>Corregirlos:</b> puedes editar tu perfil y cada gasto cuando quieras.
        </li>
        <li>
          <b>Eliminarlos:</b> en Ajustes → Borrar mi cuenta se borran de inmediato tu cuenta y todos tus datos.
        </li>
        <li>
          <b>Retirar tu autorización o presentar una queja:</b> escribe al correo de contacto del responsable; también puedes acudir a la Superintendencia de Industria y Comercio.
        </li>
      </ul>

      <h2>Seguridad</h2>
      <p>
        La conexión va cifrada (HTTPS), las contraseñas y los tokens se guardan como hash y cada usuario solo puede ver sus propios datos. Los tokens de los Atajos solo permiten registrar y consultar gastos, y se pueden revocar.
      </p>

      <h2>Responsable y contacto</h2>
      <p>[Nombre del responsable, identificación, domicilio y correo de contacto: por completar].</p>
    </main>
  );
}
