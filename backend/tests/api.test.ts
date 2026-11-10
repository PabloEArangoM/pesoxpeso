import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { pool } from '../src/db';
import { runMigrations } from '../src/migrate';
import { bandejaDePrueba } from '../src/email';
import { pushDePrueba } from '../src/push';
import { enviarRecordatorios } from '../src/servicios/recordatorios';
import { primeraFechaDesde, siguienteFecha } from '../src/servicios/recurrentes';
import { hoyBogota, sumarDias, sumarMeses } from '../src/util/fecha';

const app = createApp();
const api = () => request(app);

async function registrar(email: string, password = 'clave-segura-123') {
  const r = await api().post('/v1/auth/registro').send({ email, password, nombre: 'Pablo' });
  expect(r.status).toBe(201);
  return { token: r.body.token as string, refresh: r.body.refresh_token as string, id: r.body.id as string };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  await runMigrations();
  // DELETE y no TRUNCATE ... CASCADE: categorias referencia a usuarios, y TRUNCATE CASCADE
  // vaciaría también las categorías por defecto. Lo demás cae por ON DELETE CASCADE.
  await pool.query('DELETE FROM usuarios');
});
afterAll(async () => {
  await pool.end();
});

describe('salud', () => {
  it('GET /health', async () => {
    const r = await api().get('/health');
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe('ok');
  });
  it('ruta inexistente devuelve el formato de error estándar', async () => {
    const r = await api().get('/v1/nada');
    expect(r.status).toBe(404);
    expect(r.body.error.codigo).toBe('RUTA_NO_ENCONTRADA');
  });
});

describe('auth', () => {
  it('registro, login y refresh', async () => {
    const u = await registrar('Auth@Ejemplo.com');
    const login = await api().post('/v1/auth/login').send({ email: 'auth@ejemplo.com', password: 'clave-segura-123' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();

    const ref = await api().post('/v1/auth/refresh').send({ refresh_token: u.refresh });
    expect(ref.status).toBe(200);
    expect(ref.body.token).toBeTruthy();

    // un refresh token no sirve como token de acceso, ni al revés
    const comoAcceso = await api().get('/v1/categorias').set(auth(u.refresh));
    expect(comoAcceso.status).toBe(401);
    const accesoComoRefresh = await api().post('/v1/auth/refresh').send({ refresh_token: u.token });
    expect(accesoComoRefresh.status).toBe(401);
  });

  it('correo duplicado -> 409 (sin importar mayúsculas)', async () => {
    await registrar('dup@ejemplo.com');
    const r = await api().post('/v1/auth/registro').send({ email: 'DUP@ejemplo.com', password: 'otra-clave-123' });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('EMAIL_EN_USO');
  });

  it('validación: correo inválido y clave corta -> 400', async () => {
    const a = await api().post('/v1/auth/registro').send({ email: 'no-es-correo', password: 'clave-segura-123' });
    expect(a.status).toBe(400);
    expect(a.body.error.codigo).toBe('VALIDACION');
    const b = await api().post('/v1/auth/registro').send({ email: 'ok@ejemplo.com', password: 'corta' });
    expect(b.status).toBe(400);
  });

  it('clave incorrecta y usuario inexistente dan el mismo 401', async () => {
    await registrar('login@ejemplo.com');
    const mal = await api().post('/v1/auth/login').send({ email: 'login@ejemplo.com', password: 'incorrecta-123' });
    const noExiste = await api().post('/v1/auth/login').send({ email: 'fantasma@ejemplo.com', password: 'incorrecta-123' });
    expect(mal.status).toBe(401);
    expect(noExiste.status).toBe(401);
    expect(mal.body.error.codigo).toBe(noExiste.body.error.codigo);
  });

  it('cambiar contraseña revoca los refresh anteriores y exige la clave actual', async () => {
    const u = await registrar('clave@ejemplo.com');
    const cambiar = (body: object, t = u.token) => api().patch('/v1/auth/password').set(auth(t)).send(body);

    expect((await cambiar({ password_actual: 'incorrecta-123', password_nueva: 'nueva-clave-456' })).status).toBe(401);
    expect((await cambiar({ password_actual: 'clave-segura-123', password_nueva: 'corta' })).status).toBe(400);

    const ok = await cambiar({ password_actual: 'clave-segura-123', password_nueva: 'nueva-clave-456' });
    expect(ok.status).toBe(200);

    // el refresh de antes ya no sirve; el nuevo sí
    expect((await api().post('/v1/auth/refresh').send({ refresh_token: u.refresh })).status).toBe(401);
    expect((await api().post('/v1/auth/refresh').send({ refresh_token: ok.body.refresh_token })).status).toBe(200);

    const login = (password: string) => api().post('/v1/auth/login').send({ email: 'clave@ejemplo.com', password });
    expect((await login('clave-segura-123')).status).toBe(401);
    expect((await login('nueva-clave-456')).status).toBe(200);
  });

  it('cerrar sesiones invalida los refresh emitidos', async () => {
    const u = await registrar('sesiones@ejemplo.com');
    expect((await api().post('/v1/auth/cerrar-sesiones').set(auth(u.token))).status).toBe(204);
    expect((await api().post('/v1/auth/refresh').send({ refresh_token: u.refresh })).status).toBe(401);
  });

  it('borrar cuenta exige la clave y elimina todos los datos', async () => {
    const u = await registrar('borrar@ejemplo.com');
    await api().post('/v1/gastos').set(auth(u.token)).send({ monto: 1000, categoria: 'Otro' });
    const tok = await api().post('/v1/auth/api-tokens').set(auth(u.token)).send({ nombre: 'Atajo' });

    const borrar = (body?: object) => api().delete('/v1/auth/cuenta').set(auth(u.token)).send(body);
    expect((await borrar()).status).toBe(400);
    expect((await borrar({ password: 'incorrecta-123' })).status).toBe(401);
    // un token personal no puede borrar la cuenta
    const conAtajo = await api().delete('/v1/auth/cuenta').set(auth(tok.body.token)).send({ password: 'clave-segura-123' });
    expect(conAtajo.status).toBe(403);

    expect((await borrar({ password: 'clave-segura-123' })).status).toBe(204);

    const quedan = await pool.query(
      `SELECT (SELECT count(*) FROM usuarios WHERE id = $1)::int AS usuarios,
              (SELECT count(*) FROM gastos WHERE usuario_id = $1)::int AS gastos,
              (SELECT count(*) FROM api_tokens WHERE usuario_id = $1)::int AS tokens`,
      [u.id],
    );
    expect(quedan.rows[0]).toEqual({ usuarios: 0, gastos: 0, tokens: 0 });

    // nada de lo anterior sigue funcionando
    expect((await api().post('/v1/auth/refresh').send({ refresh_token: u.refresh })).status).toBe(401);
    expect((await api().get('/v1/gastos').set(auth(tok.body.token))).status).toBe(401);
    // el access token aún no vence, pero no puede escribir (401, no 500)
    const fantasma = await api().post('/v1/gastos').set(auth(u.token)).send({ monto: 1000, categoria: 'Otro' });
    expect(fantasma.status).toBe(401);
  });

  it('endpoints protegidos exigen token', async () => {
    expect((await api().get('/v1/gastos')).status).toBe(401);
    expect((await api().get('/v1/gastos').set(auth('basura'))).status).toBe(401);
  });
});

describe('perfil', () => {
  it('crear, leer, actualizar sin pisar campos, y no duplicar', async () => {
    const u = await registrar('perfil@ejemplo.com');
    expect((await api().get('/v1/perfil').set(auth(u.token))).status).toBe(404);

    const crear = await api()
      .post('/v1/perfil')
      .set(auth(u.token))
      .send({ ocupacion: 'estudiante', tipo_ingreso: 'mesada', ingreso_estimado: 500000, gastos_fijos: { arriendo: 400000 } });
    expect(crear.status).toBe(201);
    expect(crear.body.gastos_fijos).toEqual({ arriendo: 400000 });

    const otra = await api().post('/v1/perfil').set(auth(u.token)).send({ ocupacion: 'otro', tipo_ingreso: 'mixto' });
    expect(otra.status).toBe(409);

    const patch = await api().patch('/v1/perfil').set(auth(u.token)).send({ tipo_ingreso: 'mixto' });
    expect(patch.status).toBe(200);
    expect(patch.body.tipo_ingreso).toBe('mixto');
    expect(patch.body.gastos_fijos).toEqual({ arriendo: 400000 }); // no se borró
    expect(patch.body.ingreso_estimado).toBe(500000);

    expect((await api().patch('/v1/perfil').set(auth(u.token)).send({})).status).toBe(400);
  });

  it('valida valores del enum', async () => {
    const u = await registrar('perfil2@ejemplo.com');
    const r = await api().post('/v1/perfil').set(auth(u.token)).send({ ocupacion: 'astronauta', tipo_ingreso: 'mesada' });
    expect(r.status).toBe(400);
  });
});

describe('categorias', () => {
  it('devuelve las 5 categorías iniciales', async () => {
    const u = await registrar('cat@ejemplo.com');
    const r = await api().get('/v1/categorias').set(auth(u.token));
    expect(r.status).toBe(200);
    expect(r.body.map((c: any) => c.nombre)).toEqual(['Snacks y bebidas', 'Domicilio', 'Transporte', 'Propina', 'Otro']);
  });
});

describe('gastos', () => {
  it('crea por categoria_id y por nombre (sin tildes/mayúsculas), con montos en texto', async () => {
    const u = await registrar('gastos@ejemplo.com');
    const cats = (await api().get('/v1/categorias').set(auth(u.token))).body;
    const domicilio = cats.find((c: any) => c.nombre === 'Domicilio');

    const a = await api().post('/v1/gastos').set(auth(u.token)).send({ monto: 18000, categoria_id: domicilio.id });
    expect(a.status).toBe(201);
    expect(a.body.categoria).toBe('Domicilio');
    expect(a.body.fecha).toBe(hoyBogota());
    expect(a.body.hora).toMatch(/^\d{2}:\d{2}$/);
    expect(a.body.resumen.total_dia).toBe(18000);

    const b = await api().post('/v1/gastos').set(auth(u.token)).send({ monto: '$3.500', categoria: 'SNACKS Y BEBIDAS' });
    expect(b.status).toBe(201);
    expect(b.body.monto).toBe(3500);
    expect(b.body.resumen.total_dia).toBe(21500);
    expect(b.body.resumen.total_semana).toBeGreaterThanOrEqual(21500);

    // campos vacíos (el Atajo los puede mandar así) se ignoran
    const c = await api()
      .post('/v1/gastos')
      .set(auth(u.token))
      .send({ monto: '2000', categoria: 'transporte', fecha: '', hora: '', categoria_id: '', nota: 'bus' });
    expect(c.status).toBe(201);
    expect(c.body.nota).toBe('bus');
  });

  it('monto: acepta enteros y miles bien agrupados, rechaza decimales', async () => {
    const u = await registrar('montos@ejemplo.com');
    const post = (monto: unknown) => api().post('/v1/gastos').set(auth(u.token)).send({ monto, categoria: 'Otro' });

    const validos: Array<[unknown, number]> = [
      [18000, 18000],
      ['18000', 18000],
      ['18.000', 18000],
      ['18,000', 18000],
      ['$ 18.000', 18000],
      ['1.250.000', 1250000],
      ['500', 500],
    ];
    for (const [entrada, esperado] of validos) {
      const r = await post(entrada);
      expect(r.status, `monto ${JSON.stringify(entrada)}`).toBe(201);
      expect(r.body.monto).toBe(esperado);
    }

    const invalidos = ['18000.00', '18000,00', '18000.5', '18.5', '1,5', '18.0000', '1.250,000', '18.000,00', '1e5', '18000.', '.500', 18000.5, '-500'];
    for (const entrada of invalidos) {
      const r = await post(entrada);
      expect(r.status, `monto ${JSON.stringify(entrada)}`).toBe(400);
      expect(r.body.error.codigo).toBe('VALIDACION');
    }
    expect((await post('18000.00')).body.error.mensaje).toContain('sin decimales');

    // PATCH aplica la misma regla
    const g = await post(2000);
    const editar = await api().patch(`/v1/gastos/${g.body.id}`).set(auth(u.token)).send({ monto: '2000.50' });
    expect(editar.status).toBe(400);
  });

  it('el resumen no falla con totales mayores a 2.147 millones', async () => {
    const u = await registrar('grande@ejemplo.com');
    let ultimo: any;
    for (let i = 0; i < 22; i++) {
      ultimo = await api().post('/v1/gastos').set(auth(u.token)).send({ monto: 100_000_000, categoria: 'Otro' });
      expect(ultimo.status).toBe(201);
    }
    expect(ultimo.body.resumen.total_dia).toBe(2_200_000_000);
  });

  it('valida monto, categoría, fecha y hora', async () => {
    const u = await registrar('valida@ejemplo.com');
    const post = (body: object) => api().post('/v1/gastos').set(auth(u.token)).send(body);
    expect((await post({ monto: 0, categoria: 'Otro' })).status).toBe(400);
    expect((await post({ monto: -5, categoria: 'Otro' })).status).toBe(400);
    expect((await post({ monto: 'abc', categoria: 'Otro' })).status).toBe(400);
    expect((await post({ monto: 1500.5, categoria: 'Otro' })).status).toBe(400);
    expect((await post({ monto: 1000 })).status).toBe(400); // sin categoría
    const mala = await post({ monto: 1000, categoria: 'Inventada' });
    expect(mala.status).toBe(400);
    expect(mala.body.error.codigo).toBe('CATEGORIA_INVALIDA');
    expect((await post({ monto: 1000, categoria: 'Otro', fecha: '2026-02-31' })).status).toBe(400);
    expect((await post({ monto: 1000, categoria: 'Otro', hora: '25:00' })).status).toBe(400);
    expect((await post({ monto: 1000, categoria: 'Otro', fecha: '0000-01-01' })).status).toBe(400);
    expect((await post({ monto: 1000, categoria: 'Otro', fecha: '9999-01-01' })).status).toBe(400);
  });

  it('consulta por día, por rango (con días en cero) y por defecto hoy', async () => {
    const u = await registrar('consulta@ejemplo.com');
    const post = (body: object) => api().post('/v1/gastos').set(auth(u.token)).send(body);
    await post({ monto: 10000, categoria: 'Domicilio', fecha: '2026-09-01', hora: '12:00' });
    await post({ monto: 2000, categoria: 'Transporte', fecha: '2026-09-01', hora: '08:00' });
    await post({ monto: 5000, categoria: 'Domicilio', fecha: '2026-09-03', hora: '20:30' });

    const dia = await api().get('/v1/gastos?fecha=2026-09-01').set(auth(u.token));
    expect(dia.status).toBe(200);
    expect(dia.body.total).toBe(12000);
    expect(dia.body.gastos).toHaveLength(2);
    expect(dia.body.gastos[0].hora).toBe('12:00'); // más reciente primero

    const rango = await api().get('/v1/gastos?desde=2026-09-01&hasta=2026-09-04').set(auth(u.token));
    expect(rango.body.total).toBe(17000);
    expect(rango.body.por_dia).toEqual({
      '2026-09-01': 12000,
      '2026-09-02': 0,
      '2026-09-03': 5000,
      '2026-09-04': 0,
    });
    expect(rango.body.por_categoria).toEqual({ Domicilio: 15000, Transporte: 2000 });

    const hoy = await api().get('/v1/gastos').set(auth(u.token));
    expect(hoy.body.desde).toBe(hoyBogota());
    expect(hoy.body.total).toBe(0);

    expect((await api().get('/v1/gastos?desde=2026-09-01').set(auth(u.token))).status).toBe(400);
    expect((await api().get('/v1/gastos?desde=2026-09-05&hasta=2026-09-01').set(auth(u.token))).status).toBe(400);
    const largo = `/v1/gastos?desde=2025-01-01&hasta=${sumarDias('2025-01-01', 400)}`;
    expect((await api().get(largo).set(auth(u.token))).status).toBe(400);
  });

  it('edita y borra; PATCH no pisa campos no enviados', async () => {
    const u = await registrar('edita@ejemplo.com');
    const g = (await api().post('/v1/gastos').set(auth(u.token)).send({ monto: 7000, categoria: 'Propina', nota: 'mesero' })).body;

    const p = await api().patch(`/v1/gastos/${g.id}`).set(auth(u.token)).send({ monto: 9000 });
    expect(p.status).toBe(200);
    expect(p.body.monto).toBe(9000);
    expect(p.body.nota).toBe('mesero');
    expect(p.body.categoria).toBe('Propina');

    const p2 = await api().patch(`/v1/gastos/${g.id}`).set(auth(u.token)).send({ categoria: 'otro', fecha: '2026-08-15' });
    expect(p2.body.categoria).toBe('Otro');
    expect(p2.body.fecha).toBe('2026-08-15');

    expect((await api().patch(`/v1/gastos/${g.id}`).set(auth(u.token)).send({})).status).toBe(400);
    expect((await api().patch('/v1/gastos/no-es-uuid').set(auth(u.token)).send({ monto: 1 })).status).toBe(404);

    expect((await api().delete(`/v1/gastos/${g.id}`).set(auth(u.token))).status).toBe(204);
    expect((await api().delete(`/v1/gastos/${g.id}`).set(auth(u.token))).status).toBe(404);
  });

  it('un usuario no puede ver, editar ni borrar gastos de otro', async () => {
    const a = await registrar('a@ejemplo.com');
    const b = await registrar('b@ejemplo.com');
    const g = (await api().post('/v1/gastos').set(auth(a.token)).send({ monto: 5000, categoria: 'Otro' })).body;

    const lista = await api().get(`/v1/gastos?fecha=${g.fecha}`).set(auth(b.token));
    expect(lista.body.gastos).toHaveLength(0);
    expect((await api().patch(`/v1/gastos/${g.id}`).set(auth(b.token)).send({ monto: 1 })).status).toBe(404);
    expect((await api().delete(`/v1/gastos/${g.id}`).set(auth(b.token))).status).toBe(404);
    // sigue intacto para su dueño
    const intacto = await api().get(`/v1/gastos?fecha=${g.fecha}`).set(auth(a.token));
    expect(intacto.body.gastos[0].monto).toBe(5000);
  });
});

describe('tokens personales (Atajo de iPhone)', () => {
  it('flujo completo: crear, usar, límites de alcance, listar y revocar', async () => {
    const u = await registrar('atajo@ejemplo.com');

    const nuevo = await api().post('/v1/auth/api-tokens').set(auth(u.token)).send({ nombre: 'Mi iPhone' });
    expect(nuevo.status).toBe(201);
    expect(nuevo.body.token.startsWith('pxp_')).toBe(true);
    const tokenAtajo = nuevo.body.token as string;

    // en la base solo queda el hash
    const guardado = await pool.query('SELECT token_hash FROM api_tokens WHERE id = $1', [nuevo.body.id]);
    expect(guardado.rows[0].token_hash).not.toContain(tokenAtajo);

    // puede registrar y consultar gastos, y ver categorías
    const gasto = await api().post('/v1/gastos').set(auth(tokenAtajo)).send({ monto: '12.000', categoria: 'Domicilio' });
    expect(gasto.status).toBe(201);
    expect(gasto.body.resumen.total_dia).toBe(12000);
    expect((await api().get('/v1/gastos').set(auth(tokenAtajo))).status).toBe(200);
    expect((await api().get('/v1/categorias').set(auth(tokenAtajo))).status).toBe(200);

    // pero no puede tocar perfil, editar/borrar gastos ni crear/listar tokens
    expect((await api().get('/v1/perfil').set(auth(tokenAtajo))).status).toBe(403);
    expect((await api().patch(`/v1/gastos/${gasto.body.id}`).set(auth(tokenAtajo)).send({ monto: 1 })).status).toBe(403);
    expect((await api().delete(`/v1/gastos/${gasto.body.id}`).set(auth(tokenAtajo))).status).toBe(403);
    expect((await api().post('/v1/auth/api-tokens').set(auth(tokenAtajo)).send({})).status).toBe(403);
    expect((await api().get('/v1/auth/api-tokens').set(auth(tokenAtajo))).status).toBe(403);

    // el listado nunca expone el token y registra ultimo_uso
    const lista = await api().get('/v1/auth/api-tokens').set(auth(u.token));
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0].token).toBeUndefined();
    expect(lista.body[0].ultimo_uso).toBeTruthy();

    // revocar: deja de funcionar de inmediato
    expect((await api().delete(`/v1/auth/api-tokens/${nuevo.body.id}`).set(auth(u.token))).status).toBe(204);
    expect((await api().post('/v1/gastos').set(auth(tokenAtajo)).send({ monto: 1000, categoria: 'Otro' })).status).toBe(401);
  });

  it('no se puede revocar el token de otro usuario', async () => {
    const a = await registrar('ta@ejemplo.com');
    const b = await registrar('tb@ejemplo.com');
    const t = (await api().post('/v1/auth/api-tokens').set(auth(a.token)).send({})).body;
    expect((await api().delete(`/v1/auth/api-tokens/${t.id}`).set(auth(b.token))).status).toBe(404);
    expect((await api().post('/v1/gastos').set(auth(t.token)).send({ monto: 1000, categoria: 'Otro' })).status).toBe(201);
  });
});

// =====================================================================
// Fase 2
// =====================================================================

/** Saca el token del enlace del último correo enviado a esa dirección. */
function tokenDelCorreo(para: string, ruta: 'verificar' | 'restablecer'): string {
  const correo = [...bandejaDePrueba].reverse().find((c) => c.para === para && c.texto.includes(`/${ruta}?token=`));
  expect(correo, `correo de ${ruta} para ${para}`).toBeTruthy();
  return correo!.texto.match(/token=([\w-]+)/)![1];
}

describe('correo: verificación y contraseña olvidada', () => {
  it('el registro envía un enlace que verifica el correo una sola vez', async () => {
    const u = await registrar('verifica@ejemplo.com');
    const cuenta = () => api().get('/v1/cuenta').set(auth(u.token));
    expect((await cuenta()).body.email_verificado).toBe(false);

    const token = tokenDelCorreo('verifica@ejemplo.com', 'verificar');
    expect((await api().post('/v1/auth/verificar-email').send({ token })).status).toBe(204);
    expect((await cuenta()).body.email_verificado).toBe(true);

    const otraVez = await api().post('/v1/auth/verificar-email').send({ token });
    expect(otraVez.status).toBe(400);
    expect(otraVez.body.error.codigo).toBe('TOKEN_INVALIDO');
  });

  it('recuperar contraseña: enlace de un uso, cierra sesiones y no revela si el correo existe', async () => {
    const u = await registrar('olvido@ejemplo.com');
    const antes = bandejaDePrueba.length;
    expect((await api().post('/v1/auth/recuperar').send({ email: 'nadie@ejemplo.com' })).status).toBe(204);
    expect(bandejaDePrueba.length).toBe(antes); // sin cuenta no sale correo, pero la respuesta es igual

    expect((await api().post('/v1/auth/recuperar').send({ email: 'OLVIDO@ejemplo.com' })).status).toBe(204);
    const token = tokenDelCorreo('olvido@ejemplo.com', 'restablecer');

    // un enlace de verificación no sirve para cambiar la clave
    const cruzado = tokenDelCorreo('olvido@ejemplo.com', 'verificar');
    const mal = await api().post('/v1/auth/restablecer').send({ token: cruzado, password_nueva: 'clave-nueva-789' });
    expect(mal.status).toBe(400);

    const corta = await api().post('/v1/auth/restablecer').send({ token, password_nueva: 'corta' });
    expect(corta.status).toBe(400);
    const ok = await api().post('/v1/auth/restablecer').send({ token, password_nueva: 'clave-nueva-789' });
    expect(ok.status).toBe(204);
    expect((await api().post('/v1/auth/restablecer').send({ token, password_nueva: 'otra-clave-000' })).status).toBe(400);

    const login = (password: string) => api().post('/v1/auth/login').send({ email: 'olvido@ejemplo.com', password });
    expect((await login('clave-segura-123')).status).toBe(401);
    expect((await login('clave-nueva-789')).status).toBe(200);
    expect((await api().post('/v1/auth/refresh').send({ refresh_token: u.refresh })).status).toBe(401);
  });

  it('un enlace vencido no sirve', async () => {
    await registrar('vencido@ejemplo.com');
    await api().post('/v1/auth/recuperar').send({ email: 'vencido@ejemplo.com' });
    const token = tokenDelCorreo('vencido@ejemplo.com', 'restablecer');
    await pool.query(`UPDATE tokens_email SET expira_en = now() - interval '1 minute' WHERE tipo = 'recuperacion'`);
    const r = await api().post('/v1/auth/restablecer').send({ token, password_nueva: 'clave-nueva-789' });
    expect(r.status).toBe(400);
  });
});

describe('cuenta', () => {
  it('lee y edita nombre y recordatorio; un token personal no entra', async () => {
    const u = await registrar('cuenta@ejemplo.com');
    const g = await api().get('/v1/cuenta').set(auth(u.token));
    expect(g.status).toBe(200);
    expect(g.body).toMatchObject({ email: 'cuenta@ejemplo.com', nombre: 'Pablo', recordatorio_activo: false, recordatorio_hora: '20:00' });
    expect(g.body.password_hash).toBeUndefined();

    const p = await api().patch('/v1/cuenta').set(auth(u.token)).send({ nombre: 'Pablo E.', recordatorio_activo: true, recordatorio_hora: '21:30' });
    expect(p.body).toMatchObject({ nombre: 'Pablo E.', recordatorio_activo: true, recordatorio_hora: '21:30' });
    expect((await api().patch('/v1/cuenta').set(auth(u.token)).send({ recordatorio_hora: '25:00' })).status).toBe(400);
    expect((await api().patch('/v1/cuenta').set(auth(u.token)).send({ email: 'otro@ejemplo.com' })).status).toBe(400);

    const tok = await api().post('/v1/auth/api-tokens').set(auth(u.token)).send({});
    expect((await api().get('/v1/cuenta').set(auth(tok.body.token))).status).toBe(403);
  });
});

describe('categorías propias', () => {
  it('crear, usar, renombrar y borrar (los gastos pasan a Otro); aisladas por usuario', async () => {
    const a = await registrar('cat-a@ejemplo.com');
    const b = await registrar('cat-b@ejemplo.com');
    const crear = (t: string, body: object) => api().post('/v1/categorias').set(auth(t)).send(body);

    const gym = await crear(a.token, { nombre: 'Gimnasio', icono: '🏋️' });
    expect(gym.status).toBe(201);
    expect(gym.body).toMatchObject({ nombre: 'Gimnasio', icono: '🏋️', propia: true });

    // no se repite con las propias ni con las de por defecto, sin importar tildes o mayúsculas
    expect((await crear(a.token, { nombre: 'gimnasio' })).status).toBe(409);
    expect((await crear(a.token, { nombre: 'DOMICILIO' })).body.error.codigo).toBe('CATEGORIA_EXISTENTE');
    // otro usuario sí puede usar el mismo nombre
    expect((await crear(b.token, { nombre: 'Gimnasio' })).status).toBe(201);

    const deA = (await api().get('/v1/categorias').set(auth(a.token))).body;
    expect(deA).toHaveLength(6);
    expect(deA[5]).toMatchObject({ nombre: 'Gimnasio', propia: true });

    const gasto = await api().post('/v1/gastos').set(auth(a.token)).send({ monto: 90000, categoria: 'gimnasio' });
    expect(gasto.status).toBe(201);
    expect(gasto.body.categoria_id).toBe(gym.body.id);

    // b no puede usar, editar ni borrar la categoría de a
    expect((await api().post('/v1/gastos').set(auth(b.token)).send({ monto: 1000, categoria_id: gym.body.id })).status).toBe(400);
    expect((await api().patch(`/v1/categorias/${gym.body.id}`).set(auth(b.token)).send({ nombre: 'X' })).status).toBe(404);
    expect((await api().delete(`/v1/categorias/${gym.body.id}`).set(auth(b.token))).status).toBe(404);

    // las de por defecto no se tocan
    const domicilio = deA.find((c: any) => c.nombre === 'Domicilio');
    expect((await api().patch(`/v1/categorias/${domicilio.id}`).set(auth(a.token)).send({ nombre: 'X' })).status).toBe(404);
    expect((await api().delete(`/v1/categorias/${domicilio.id}`).set(auth(a.token))).status).toBe(404);

    const ren = await api().patch(`/v1/categorias/${gym.body.id}`).set(auth(a.token)).send({ nombre: 'Gym' });
    expect(ren.body).toMatchObject({ nombre: 'Gym', icono: '🏋️' });

    expect((await api().delete(`/v1/categorias/${gym.body.id}`).set(auth(a.token))).status).toBe(204);
    const hoy = (await api().get('/v1/gastos').set(auth(a.token))).body;
    expect(hoy.gastos[0]).toMatchObject({ monto: 90000, categoria: 'Otro' });
  });

  it('un token personal ve las categorías pero no las crea', async () => {
    const u = await registrar('cat-atajo@ejemplo.com');
    const tok = (await api().post('/v1/auth/api-tokens').set(auth(u.token)).send({})).body.token;
    expect((await api().get('/v1/categorias').set(auth(tok))).status).toBe(200);
    expect((await api().post('/v1/categorias').set(auth(tok)).send({ nombre: 'Nueva' })).status).toBe(403);
  });
});

describe('presupuesto', () => {
  it('avisa al acercarse y al pasarse; se puede quitar', async () => {
    const u = await registrar('presupuesto@ejemplo.com');
    const put = (body: object) => api().put('/v1/presupuesto').set(auth(u.token)).send(body);
    const gastar = (monto: number) => api().post('/v1/gastos').set(auth(u.token)).send({ monto, categoria: 'Otro' });

    const vacio = await api().get('/v1/presupuesto').set(auth(u.token));
    expect(vacio.body).toEqual({ semanal: null, mensual: null });

    expect((await put({})).status).toBe(400);
    expect((await put({ semanal: '10.5' })).status).toBe(400); // sin decimales, igual que los gastos
    const p = await put({ semanal: '10.000' });
    expect(p.body.semanal).toEqual({ monto: 10000, gastado: 0, restante: 10000, porcentaje: 0, estado: 'ok' });

    expect((await gastar(5000)).body.resumen.alertas).toEqual([]);
    const cerca = await gastar(3500);
    expect(cerca.body.resumen.alertas).toHaveLength(1);
    expect(cerca.body.resumen.alertas[0]).toContain('85%');
    const pasado = await gastar(2000);
    expect(pasado.body.resumen.alertas[0]).toContain('Te pasaste $500');

    const estado = (await api().get('/v1/presupuesto').set(auth(u.token))).body;
    expect(estado.semanal).toMatchObject({ gastado: 10500, restante: -500, porcentaje: 105, estado: 'excedido' });

    // agregar el mensual no borra el semanal; null lo quita
    const ambos = await put({ mensual: 1_000_000 });
    expect(ambos.body.semanal.monto).toBe(10000);
    expect(ambos.body.mensual).toMatchObject({ monto: 1_000_000, estado: 'ok' });
    expect((await put({ semanal: null })).body.semanal).toBeNull();
  });
});

describe('gastos recurrentes', () => {
  it('fechas: mensual conserva el día y recorta en meses cortos', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(sumarMeses('2026-11-30', 3)).toBe('2027-02-28');
    expect(siguienteFecha('mensual', '2026-01-31', '2026-01-31')).toBe('2026-02-28');
    expect(siguienteFecha('mensual', '2026-01-31', '2026-02-28')).toBe('2026-03-31');
    expect(siguienteFecha('semanal', '2026-01-05', '2026-01-12')).toBe('2026-01-19');
    expect(siguienteFecha('diaria', '2026-01-05', '2026-12-31')).toBe('2027-01-01');
    expect(primeraFechaDesde('semanal', '2026-01-05', '2026-01-20')).toBe('2026-01-26');
    expect(primeraFechaDesde('semanal', '2026-01-05', '2026-01-19')).toBe('2026-01-19');
    expect(primeraFechaDesde('mensual', '2026-01-31', '2026-03-01')).toBe('2026-03-31');
    expect(primeraFechaDesde('diaria', '2026-01-05', '2026-01-20')).toBe('2026-01-20');
    expect(primeraFechaDesde('mensual', '2026-05-10', '2026-01-01')).toBe('2026-05-10');
  });

  it('crea el gasto del día, pone al día los atrasados, se pausa y se reanuda', async () => {
    const u = await registrar('recurrente@ejemplo.com');
    const hoy = hoyBogota();
    const crear = (body: object) => api().post('/v1/recurrentes').set(auth(u.token)).send(body);

    expect((await crear({ monto: 3000, categoria: 'Transporte', frecuencia: 'quincenal' })).status).toBe(400);
    expect((await crear({ monto: 3000, categoria: 'Transporte', frecuencia: 'diaria', inicio: sumarDias(hoy, -1) })).status).toBe(400);

    // Empieza hoy: el primer gasto queda creado de inmediato.
    const r = await crear({ monto: '3.000', categoria: 'Transporte', frecuencia: 'diaria', nota: 'bus' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ monto: 3000, categoria: 'Transporte', frecuencia: 'diaria', activo: true, proxima_fecha: sumarDias(hoy, 1) });
    const lista = (await api().get('/v1/gastos').set(auth(u.token))).body;
    expect(lista.gastos).toHaveLength(1);
    expect(lista.gastos[0]).toMatchObject({ monto: 3000, nota: 'bus', recurrente: true });
    // consultar otra vez no lo duplica
    expect((await api().get('/v1/gastos').set(auth(u.token))).body.gastos).toHaveLength(1);

    // Otro que empieza mañana; se simula que pasaron tres días sin abrir la app.
    const s = await crear({ monto: 12000, categoria: 'Domicilio', frecuencia: 'diaria', inicio: sumarDias(hoy, 1) });
    await pool.query(`UPDATE gastos_recurrentes SET inicio = $1, proxima_fecha = $1 WHERE id = $2`, [sumarDias(hoy, -2), s.body.id]);
    const rango = await api().get(`/v1/gastos?desde=${sumarDias(hoy, -2)}&hasta=${hoy}`).set(auth(u.token));
    expect(rango.body.gastos.filter((g: any) => g.monto === 12000)).toHaveLength(3);
    expect(rango.body.por_dia[sumarDias(hoy, -2)]).toBe(12000);
    expect(rango.body.por_dia[hoy]).toBe(15000);

    // En pausa no genera nada; al reanudar no crea lo atrasado.
    const editar = (id: string, body: object) => api().patch(`/v1/recurrentes/${id}`).set(auth(u.token)).send(body);
    expect((await editar(s.body.id, { activo: false })).body.activo).toBe(false);
    await pool.query(`UPDATE gastos_recurrentes SET proxima_fecha = $1 WHERE id = $2`, [sumarDias(hoy, -10), s.body.id]);
    await api().get('/v1/gastos').set(auth(u.token));
    const reanudado = await editar(s.body.id, { activo: true, monto: 15000 });
    expect(reanudado.body).toMatchObject({ activo: true, monto: 15000, proxima_fecha: sumarDias(hoy, 1) });
    const total = await api().get(`/v1/gastos?desde=${sumarDias(hoy, -30)}&hasta=${hoy}`).set(auth(u.token));
    expect(total.body.gastos.filter((g: any) => g.recurrente)).toHaveLength(5); // 1 + 3 + el de hoy al reanudar

    // Borrar el recurrente conserva los gastos ya creados.
    expect((await api().delete(`/v1/recurrentes/${s.body.id}`).set(auth(u.token))).status).toBe(204);
    expect((await api().get('/v1/recurrentes').set(auth(u.token))).body).toHaveLength(1);
    const despues = await api().get(`/v1/gastos?desde=${sumarDias(hoy, -30)}&hasta=${hoy}`).set(auth(u.token));
    expect(despues.body.gastos).toHaveLength(5);
  });

  it('no se ven ni se tocan los de otro usuario', async () => {
    const a = await registrar('rec-a@ejemplo.com');
    const b = await registrar('rec-b@ejemplo.com');
    const r = await api().post('/v1/recurrentes').set(auth(a.token)).send({ monto: 1000, categoria: 'Otro', frecuencia: 'semanal' });
    expect((await api().get('/v1/recurrentes').set(auth(b.token))).body).toEqual([]);
    expect((await api().patch(`/v1/recurrentes/${r.body.id}`).set(auth(b.token)).send({ monto: 1 })).status).toBe(404);
    expect((await api().delete(`/v1/recurrentes/${r.body.id}`).set(auth(b.token))).status).toBe(404);
  });
});

describe('resumen y racha', () => {
  it('cuenta días seguidos anotando a mano; los recurrentes no suman', async () => {
    const u = await registrar('racha@ejemplo.com');
    const hoy = hoyBogota();
    const resumen = async () => (await api().get('/v1/resumen').set(auth(u.token))).body;
    const gastar = (dias: number, monto = 1000) =>
      api().post('/v1/gastos').set(auth(u.token)).send({ monto, categoria: 'Otro', fecha: sumarDias(hoy, dias) });

    expect((await resumen()).racha).toEqual({ actual: 0, mejor: 0, registro_hoy: false });

    // un recurrente diario genera el gasto de hoy, pero no cuenta como racha
    await api().post('/v1/recurrentes').set(auth(u.token)).send({ monto: 500, categoria: 'Otro', frecuencia: 'diaria' });
    let r = await resumen();
    expect(r.total_dia).toBe(500);
    expect(r.racha.actual).toBe(0);

    // racha vieja de 4 días, un hueco, y luego ayer y anteayer
    for (const d of [-10, -9, -8, -7, -2, -1]) await gastar(d);
    r = await resumen();
    expect(r.racha).toEqual({ actual: 2, mejor: 4, registro_hoy: false }); // sigue viva: aún puede anotar hoy

    await gastar(0, 2500);
    r = await resumen();
    expect(r.racha).toEqual({ actual: 3, mejor: 4, registro_hoy: true });
    expect(r.total_dia).toBe(3000);
    expect(r.total_mes).toBeGreaterThanOrEqual(r.total_dia);
    expect(r.presupuesto).toEqual({ semanal: null, mensual: null });
    expect(r.fecha).toBe(hoy);
  });
});

describe('exportar CSV', () => {
  it('descarga el rango en orden y neutraliza fórmulas', async () => {
    const u = await registrar('csv@ejemplo.com');
    const hoy = hoyBogota();
    const post = (body: object) => api().post('/v1/gastos').set(auth(u.token)).send(body);
    await post({ monto: 2000, categoria: 'Transporte', fecha: sumarDias(hoy, -1), hora: '07:15', nota: 'bus; ida' });
    await post({ monto: 18000, categoria: 'Domicilio', fecha: hoy, hora: '13:00', nota: '=HYPERLINK("http://malo")' });

    const r = await api().get(`/v1/gastos/exportar?desde=${sumarDias(hoy, -1)}&hasta=${hoy}`).set(auth(u.token));
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.headers['content-disposition']).toContain(`pesoxpeso_${sumarDias(hoy, -1)}_${hoy}.csv`);
    expect(r.text.charCodeAt(0)).toBe(0xfeff);
    const lineas = r.text.slice(1).trim().split('\r\n');
    expect(lineas[0]).toBe('Fecha;Hora;Categoría;Monto;Nota;Recurrente');
    expect(lineas[1]).toBe(`${sumarDias(hoy, -1)};07:15;Transporte;2000;"bus; ida";no`);
    expect(lineas[2]).toBe(`${hoy};13:00;Domicilio;18000;"'=HYPERLINK(""http://malo"")";no`);

    const tok = (await api().post('/v1/auth/api-tokens').set(auth(u.token)).send({})).body.token;
    expect((await api().get('/v1/gastos/exportar').set(auth(tok))).status).toBe(403);
  });
});

describe('recordatorios', () => {
  it('avisa una vez al día a quien no ha anotado, y solo a servicios de push conocidos', async () => {
    const pendiente = await registrar('recordar@ejemplo.com');
    const cumplido = await registrar('ya-anoto@ejemplo.com');
    const suscribir = (t: string, endpoint: string) =>
      api().post('/v1/cuenta/push').set(auth(t)).send({ endpoint, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } });

    // el servidor no acepta llamar a cualquier URL
    for (const malo of ['https://ejemplo.com/push', 'http://fcm.googleapis.com/x', 'https://fcm.googleapis.com.malo.net/x', 'no-es-url']) {
      expect((await suscribir(pendiente.token, malo)).status, malo).toBe(400);
    }

    const endpointA = 'https://fcm.googleapis.com/fcm/send/aaa';
    const endpointB = 'https://web.push.apple.com/bbb';
    expect((await suscribir(pendiente.token, endpointA)).status).toBe(204);
    expect((await suscribir(pendiente.token, endpointA)).status).toBe(204); // repetir no duplica
    expect((await suscribir(cumplido.token, endpointB)).status).toBe(204);
    for (const u of [pendiente, cumplido]) {
      await api().patch('/v1/cuenta').set(auth(u.token)).send({ recordatorio_activo: true, recordatorio_hora: '00:00' });
    }
    await api().post('/v1/gastos').set(auth(cumplido.token)).send({ monto: 1000, categoria: 'Otro' });

    pushDePrueba.length = 0;
    expect(await enviarRecordatorios()).toBe(1);
    expect(pushDePrueba).toHaveLength(1);
    expect(pushDePrueba[0].endpoint).toBe(endpointA);
    expect(pushDePrueba[0].notificacion.cuerpo).toContain('Anótalo');
    expect(await enviarRecordatorios()).toBe(0); // no insiste el mismo día

    // todavía no es la hora: no avisa
    await pool.query(`UPDATE usuarios SET ultimo_recordatorio = NULL, recordatorio_hora = '23:59' WHERE id = $1`, [pendiente.id]);
    expect(await enviarRecordatorios(new Date('2026-11-10T15:00:00Z'))).toBe(0);

    // quitar la suscripción
    const quitar = await api().delete('/v1/cuenta/push').set(auth(pendiente.token)).send({ endpoint: endpointA });
    expect(quitar.status).toBe(204);
    const quedan = await pool.query(`SELECT count(*)::int AS n FROM push_suscripciones WHERE usuario_id = $1`, [pendiente.id]);
    expect(quedan.rows[0].n).toBe(0);
  });
});
