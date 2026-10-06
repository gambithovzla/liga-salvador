/* The real app against the Firebase emulator with database.rules.json applied (never production).
   Guests play the finale and write capsule messages; the host runs the party signed out, then signs in
   with the emulator's Google account to delete, approve and hide. Any permission_denied during normal play fails.
   Needs: emulators (database 9000, auth 9099) and a plain static server (LIGA_TEST_URL, default port 8790). */
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const ADMIN = process.env.LIGA_ADMIN_EMAIL;
assert(ADMIN, 'Set LIGA_ADMIN_EMAIL to the email in the emulator rules');
const BASE = new URL(process.env.LIGA_TEST_URL || 'http://127.0.0.1:8790/juegos/');
const SALA = `reglas-${Date.now().toString(36)}`;
const URL0 = `${BASE.origin}${BASE.pathname}?sala=${SALA}`;
const EMU = () => {
  window.__FB_EMULADOR__ = '127.0.0.1:9000';
  window.__FB_AUTH_EMULADOR__ = 'http://127.0.0.1:9099';
  window.__FB_AUTH_CONFIG__ = { apiKey: 'fake-api-key', authDomain: '127.0.0.1', projectId: 'demo-liga' };
};

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const denegados = [], errores = [];
  const nueva = async (vp, url) => {
    const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
    await ctx.addInitScript(EMU);
    // Only local traffic and Google's SDK scripts; nothing reaches the production database.
    await ctx.route('**/*', (r) => {
      const h = new URL(r.request().url()).hostname;
      return ['127.0.0.1', 'localhost', 'www.gstatic.com', 'apis.google.com'].includes(h) ? r.continue() : r.abort();
    });
    const p = await ctx.newPage(); p.setDefaultTimeout(20000);
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => { const t = m.text(); if (/permission_denied/i.test(t)) denegados.push(t); else if (m.type() === 'error') errores.push(t); });
    await p.goto(url);
    return p;
  };
  const b = (p, n) => p.getByRole('button', { name: n, exact: true });
  const aviso = (p, t) => p.locator('.aviso').filter({ hasText: t }).first().waitFor();
  try {
    const host = await nueva({ width: 430, height: 900 }, URL0 + '#comando');
    await host.locator('#pin').fill('1110'); await host.locator('#pin').press('Enter');
    const jugadores = [];
    for (const [nombre, poder] of [['Ana Reglas', 'Velocidad del rayo'], ['Beto Reglas', 'Escudo invencible']]) {
      const p = await nueva({ width: 390, height: 844 }, URL0);
      await p.locator('#nombre-heroe').fill(nombre);
      await p.locator('label.opcion-poder').filter({ hasText: poder }).click();
      await b(p, '¡Unirme a la Liga!').click();
      await b(p, '¡A la fiesta!').click();
      jugadores.push(p);
    }
    const [A, B] = jugadores;

    // Capsule: create, edit (a new version), then empty it.
    await A.locator('#capsula-texto').fill('Primera versión');
    await b(A, 'Guardar mi mensaje').click();
    await aviso(A, 'Tu mensaje quedó guardado');
    await A.locator('#capsula-texto').fill('Querido Salvador: vuela alto.');
    await b(A, 'Actualizar mi mensaje').click();
    await B.locator('#capsula-texto').fill('Un mensaje que luego quito');
    await b(B, 'Guardar mi mensaje').click();
    await aviso(B, 'Tu mensaje quedó guardado');
    await B.locator('#capsula-texto').fill('');
    await b(B, 'Actualizar mi mensaje').click();
    await aviso(B, 'Quitaste tu mensaje');
    const cap = await host.evaluate(() => ({ n: mensajesCapsula(__comando.S).length, a: Object.keys(__comando.S.capsula[Object.keys(__comando.S.capsula).find((k) => __comando.S.agentes[k].nombre === 'Ana Reglas')].v).length }));
    assert.deepEqual(cap, { n: 1, a: 2 });
    console.log('PASS: capsule versions (create, edit, remove) as a guest');

    // Album: a guest uploads, then withdraws; the signed-out host cannot approve.
    const foto = path.join(__dirname, '../img/salva-cara.webp');
    const subir = async (p) => {
      await b(p, 'Abrir álbum y crear mi portada ↗').click();
      const chooser = p.waitForEvent('filechooser');
      await b(p, 'Crear mi portada con una foto').click();
      await (await chooser).setFiles(foto);
      await p.locator('#permiso-album').check();
      await b(p, 'Enviar para aprobación').click();
      await p.getByText('Esperando aprobación', { exact: true }).waitFor();
    };
    await subir(A);
    await b(A, 'Eliminar foto').click();
    await b(A.locator('.capa-modal'), 'Eliminar foto').click();
    await A.getByText('Foto retirada del álbum y del final.', { exact: true }).waitFor();
    await b(A, 'Cerrar álbum').click();
    await subir(B);
    await b(B, 'Cerrar álbum').click();
    await host.getByRole('tab', { name: 'Marcador', exact: true }).click();
    await b(host, 'Revisar y aprobar fotos').click();
    await b(host, 'Aprobar').click();
    await host.getByText('Solo el anfitrión con sesión iniciada', { exact: false }).first().waitFor();
    await b(host, 'Cerrar álbum').click();
    console.log('PASS: guest withdraws a photo; signed-out host cannot approve');

    // The signed-out host still runs the whole finale.
    denegados.length = 0;
    await b(host, 'Comenzar el gran final').click();
    await b(host, '¡A la gran final!').click();
    await host.evaluate(async () => __comando.T.actualizar('final', { t: __comando.T.ahora() - 30000 }));
    for (const p of [A, B]) { await p.locator('.op-hackeo[data-etapa="boton"]').waitFor(); await p.locator('[data-accion="op-activar"]').click(); }
    await host.locator('[data-vivo="op-listos"]').filter({ hasText: '2' }).waitFor();
    await b(host, '¡Que empiece la batalla!').click();
    for (let i = 0; i < 15; i++) { await A.locator('[data-op-pad]').dispatchEvent('pointerdown'); await A.waitForTimeout(110); }
    await A.waitForTimeout(800);
    await host.locator('[data-accion="op-chispa"]').click();
    await host.evaluate(async () => { const f = await __comando.T.leer('final'); await __comando.T.actualizar('final', { chispaT: __comando.T.ahora() - planChispa(f).fin - 12000 }); });
    await b(host, 'Luces apagadas: encender las velas').click();
    await b(host, 'Salvador sopló la vela').click();
    for (const p of [A, B]) await p.locator('.op-velas[data-estado="feliz"]').waitFor();
    await b(host, 'Ver la película de la Liga').click();
    await b(host, 'Ir al podio ahora').click();
    await b(host.locator('.capa-modal'), 'Ir al podio').click();
    for (const n of ['Revelar el 2.º lugar', 'Revelar al campeón']) { await b(host, n).click(); await host.waitForTimeout(2700); }
    await b(host, 'Pasar los créditos finales').click();
    await A.getByText('«Querido Salvador: vuela alto.»', { exact: true }).waitFor();
    assert.equal(await A.getByText('Un mensaje que luego quito', { exact: false }).count(), 0);
    await b(host, 'Volver a la fiesta').click(); await b(host.locator('.capa-modal'), 'Volver a la fiesta').click();
    assert.deepEqual(denegados, [], 'normal play was denied');
    console.log('PASS: signed-out host runs the finale with no permission errors');

    // A regular mission played by test agents: results, points and history under the rules.
    await host.getByRole('tab', { name: 'Agentes', exact: true }).click();
    await b(host, 'Agregar 6 de prueba').click();
    await host.waitForFunction(() => Object.keys(__comando.S.agentes).length === 8);
    await host.evaluate(() => __comando.lanzarTipo('reflejos', { minutos: 3 }));
    await host.waitForFunction(() => Object.keys((__comando.S.mj || {}).res || {}).length >= 3, null, { timeout: 60000 });
    await host.evaluate(async () => __comando.T.actualizar('mision', { cierra: __comando.T.ahora() - 1000 }));
    await host.waitForFunction(() => __comando.S.mision && __comando.S.mision.fase === 'resultados', null, { timeout: 20000 });
    await host.waitForFunction(() => Object.keys(__comando.S.historial || {}).length === 1 && Object.keys(__comando.S.puntos || {}).length >= 3);
    assert.deepEqual(denegados, [], 'a regular mission was denied');
    console.log('PASS: a regular mission with points and history under the rules');

    // Signed out, the host cannot wipe anything, and nothing is half-deleted.
    await host.getByRole('tab', { name: 'Agentes', exact: true }).click();
    await b(host, 'Borrar todo').click();
    await b(host.locator('.capa-modal'), 'Sí, borrar todo').click();
    await host.getByText('Solo el anfitrión con sesión iniciada', { exact: false }).first().waitFor();
    assert.equal(await host.evaluate(() => Object.keys(__comando.S.agentes).length), 8);
    assert.equal(await host.evaluate(() => Object.keys(__comando.S.historial || {}).length), 1);
    console.log('PASS: signed-out host cannot wipe the room');

    // Sign in with the emulator's Google account.
    await host.getByRole('tab', { name: 'Marcador', exact: true }).click();
    const popup = host.context().waitForEvent('page');
    await b(host, 'Iniciar sesión con Google').click();
    const g = await popup;
    await g.waitForLoadState();
    await g.getByText('Add new account', { exact: false }).click();
    await g.locator('#email-input').fill(ADMIN);
    await g.locator('#sign-in').click();
    await host.getByText(`Sesión iniciada: ${ADMIN}`, { exact: false }).waitFor();
    console.log('PASS: host signs in with Google');

    await host.getByRole('tab', { name: 'Marcador', exact: true }).click();
    await b(host, 'Revisar y aprobar fotos').click();
    await b(host, 'Aprobar').click();
    await host.getByText('Todo al día', { exact: true }).waitFor();
    await b(host, 'Todas').click();
    await host.getByText('Retirada por su autor', { exact: true }).waitFor();
    await b(host, 'Cerrar álbum').click();
    await host.locator('details summary').filter({ hasText: 'Revisar los mensajes' }).click();
    await b(host, 'Ocultar de los créditos').click();
    await b(host, 'Mostrar en los créditos').waitFor();
    await host.getByRole('tab', { name: 'Agentes', exact: true }).click();
    await b(host, 'Borrar todo').click();
    await b(host.locator('.capa-modal'), 'Sí, borrar todo').click();
    await host.getByText('Listo: la Liga quedó vacía.', { exact: true }).waitFor();
    assert.equal(await host.evaluate(() => __comando.T.leer('agentes')), null);
    console.log('PASS: signed-in host approves, hides and wipes');
    assert.deepEqual(errores.filter((e) => !/permission_denied|Permission denied/i.test(e)), []);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
