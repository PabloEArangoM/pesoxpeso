import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { pool } from '../src/db';
import { runMigrations } from '../src/migrate';
import { hoyBogota, sumarDias } from '../src/util/fecha';

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
  await pool.query('TRUNCATE usuarios CASCADE'); // categorias no se toca
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
