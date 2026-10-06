/* Real Firebase rehearsal of the finale: one host and two phones in a throwaway room, deleted at the end.
   Writes to the production database (never to the "fiesta" room), so it only runs with LIGA_FIREBASE_ENSAYO=1.
   Serve the repo with a plain static server (no demo injection), e.g. python -m http.server 8790 --bind 127.0.0.1 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

if (process.env.LIGA_FIREBASE_ENSAYO !== '1') { console.log('Skipped: set LIGA_FIREBASE_ENSAYO=1 to write to a throwaway Firebase room.'); process.exit(0); }
const DB = 'https://liga-salvador-default-rtdb.firebaseio.com';
const SALA = `ensayo-${Date.now().toString(36)}`;
const BASE = new URL(process.env.LIGA_TEST_URL || 'http://127.0.0.1:8790/juegos/');
assert(['127.0.0.1', 'localhost'].includes(BASE.hostname), 'Use a local server');
const URL0 = `${BASE.origin}${BASE.pathname}?sala=${SALA}`;
const borrarSala = () => fetch(`${DB}/salas/${SALA}.json`, { method: 'DELETE' });

(async () => {
  console.log('room', SALA);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const errors = [];
    const nueva = async (vp, url) => {
      const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
      const p = await ctx.newPage(); p.setDefaultTimeout(20000);
      p.on('pageerror', e => errors.push(`${url}: ${e.message}`));
      p.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
      await p.goto(url);
      assert.notEqual(await p.evaluate(() => MODO), 'demo', 'The server injected demo mode: use a plain static server');
      return p;
    };
    const host = await nueva({ width: 420, height: 900 }, URL0 + '#comando');
    await host.locator('#pin').fill('1110'); await host.locator('#pin').press('Enter');
    const b = (p, n) => p.getByRole('button', { name: n, exact: true });
    const jugadores = [];
    for (const [nombre, poder] of [['Ana Ensayo', 'Velocidad del rayo'], ['Beto Ensayo', 'Escudo invencible']]) {
      const p = await nueva({ width: 390, height: 844 }, URL0);
      await p.locator('#nombre-heroe').fill(nombre);
      await p.locator('label.opcion-poder').filter({ hasText: poder }).click();
      await b(p, '¡Unirme a la Liga!').click();
      await b(p, '¡A la fiesta!').click();
      await p.evaluate(() => {
        const T = __jugador.T, o = T.afinarReloj.bind(T);
        window.__reloj = []; window.__base = T.ahora() - Date.now();
        T.afinarReloj = async (r) => { const x = await o(r); __reloj.push({ x, off: T.ahora() - Date.now() }); return x; };
        window.__eventos = [];
        new MutationObserver(() => {
          // Count a flash when it turns on, not on every mutation while it is lit.
          const lit = !!document.querySelector('[data-op-destello].brilla');
          if (lit && !window.__lit) __eventos.push(['destello', T.ahora()]);
          window.__lit = lit;
          const v = document.querySelector('.op-velas[data-estado="soplada"]');
          if (v && !v.__v) { v.__v = 1; __eventos.push(['soplada', T.ahora()]); }
          const c = document.querySelector('.op-chispa[data-momento="golpe"]');
          if (c && !c.__v) { c.__v = 1; __eventos.push(['golpe', T.ahora()]); }
        }).observe(document.body, { subtree: true, attributes: true, childList: true, attributeFilter: ['class', 'data-estado', 'data-momento'] });
      });
      jugadores.push({ p, nombre });
    }
    const [A, B] = jugadores.map(j => j.p);
    await A.locator('#capsula-texto').fill('Salvador: este mensaje viajó por Firebase real.');
    await b(A, 'Guardar mi mensaje').click();
    await host.getByRole('tab', { name: 'Marcador', exact: true }).click();
    await host.locator('[data-vivo="capsula-n"]').filter({ hasText: '1' }).waitFor();
    await b(host, 'Comenzar el gran final').click();
    await b(host, '¡A la gran final!').click();
    const t0 = Date.now();
    for (const p of [A, B]) await p.locator('.op-hackeo[data-etapa="boton"]').waitFor({ timeout: 30000 });
    console.log('hackeo hasta el botón:', ((Date.now() - t0) / 1000).toFixed(1), 's');
    for (const p of [A, B]) await p.locator('[data-accion="op-activar"]').click();
    await host.locator('[data-vivo="op-listos"]').filter({ hasText: '2' }).waitFor();
    await b(host, '¡Que empiece la batalla!').click();
    await A.locator('[data-op-pad]').waitFor(); await B.locator('[data-op-pad]').waitFor();
    const padB = B.locator('[data-op-pad]'); await padB.dispatchEvent('pointerdown');
    for (let i = 0; i < 40; i++) { await A.locator('[data-op-pad]').dispatchEvent('pointerdown'); await A.waitForTimeout(110); }
    await padB.dispatchEvent('pointerup');
    await A.waitForTimeout(1500);
    const g = await host.evaluate(async () => (await __comando.T.leer('final')).golpes);
    console.log('golpes en Firebase:', JSON.stringify(g));
    console.log('vida en el host:', await host.locator('[data-vivo="op-vida"]').textContent(), '| en A:', await A.locator('[data-op-pct]').textContent(), '| en B:', await B.locator('[data-op-pct]').textContent());
    await host.locator('[data-accion="op-chispa"]').click();
    await host.waitForFunction(() => !document.querySelector('[data-vivo="op-velas-boton"]')?.disabled, null, { timeout: 30000 });
    await b(host, 'Luces apagadas: encender las velas').click();
    for (const p of [A, B]) await p.locator('.op-velas[data-estado="encendida"]').waitFor();
    await b(host, 'Salvador sopló la vela').click();
    for (const p of [A, B]) await p.locator('.op-velas[data-estado="feliz"]').waitFor();
    const f = await host.evaluate(async () => __comando.T.leer('final'));
    for (const { p, nombre } of jugadores) {
      const r = await p.evaluate(() => ({ reloj: __reloj, base: __base, eventos: __eventos, yo: __jugador.yo }));
      const plan = await p.evaluate((f) => planChispa(f), f);
      const mios = plan.pasos.filter((x) => x.quien === r.yo).map((x) => f.chispaT + x.t);
      const dest = r.eventos.filter((e) => e[0] === 'destello').map((e) => e[1]);
      const golpe = r.eventos.find((e) => e[0] === 'golpe'), soplo = r.eventos.find((e) => e[0] === 'soplada');
      const retrasos = dest.map((t) => { const m = mios.filter((x) => x <= t + 5).pop(); return m === undefined ? null : t - m; }).filter((x) => x !== null);
      console.log(`${nombre}: offset inicial ${r.base} ms; afinado: ${r.reloj.map((x) => (x.x ? `rtt ${x.x.rtt} ms, offset ${Math.round(x.off)}` : 'sin muestra')).join(' | ')}`);
      console.log(`  destellos: ${dest.length} de ${mios.length} planeados; retraso medio ${retrasos.length ? Math.round(retrasos.reduce((s, x) => s + x, 0) / retrasos.length) : '-'} ms`);
      assert(r.reloj.some((x) => x.x), `${nombre}: the clock could not be refined`);
      assert(soplo && Math.abs(soplo[1] - f.sopladoT) < 150, `${nombre}: candle went out out of sync (${soplo ? Math.round(soplo[1] - f.sopladoT) + " ms" : "no soplada event"}; events ${JSON.stringify(r.eventos.filter((e) => e[0] !== "destello"))}; sopladoT ${f.sopladoT})`);
      assert.equal(dest.length, mios.length, `${nombre}: missed spark flashes`);
      console.log(`  golpe final ${golpe ? Math.round(golpe[1] - (f.chispaT + plan.fin + 2400)) : '?'} ms después de lo previsto · vela apagada ${soplo ? Math.round(soplo[1] - f.sopladoT) : '?'} ms después (hora del servidor)`);
    }
    await b(host, 'Ver la película de la Liga').click();
    await b(host, 'Ir al podio ahora').click();
    await b(host.locator('.capa-modal'), 'Ir al podio').click();
    for (const n of ['Revelar el 2.º lugar', 'Revelar al campeón']) { await b(host, n).click(); await host.waitForTimeout(2800); }
    await b(host, 'Pasar los créditos finales').click();
    for (const p of [A, B]) { await p.locator('.op-creditos').waitFor(); assert.equal(await p.locator('.op-c-reparto li').count(), 2); }
    await A.getByText('«Salvador: este mensaje viajó por Firebase real.»', { exact: true }).waitFor();
    const dur = (await host.evaluate(async () => __comando.T.leer('final'))).creditosDur;
    console.log('créditos:', dur / 1000, 's; esperando el final real…');
    await A.locator('.op-creditos.terminado').waitFor({ timeout: dur + 15000 });
    const dl = A.waitForEvent('download'); await b(A, 'Descargar mi ficha de héroe').click(); await dl;
    console.log('ficha descargada');
    await b(host, 'Volver a la fiesta').click(); await b(host.locator('.capa-modal'), 'Volver a la fiesta').click();
    for (const p of [A, B]) await p.locator('.op-escena').waitFor({ state: 'detached' });
    console.log('de vuelta en el cuartel');
    assert.deepEqual(errors, []);
    console.log('PASS: real Firebase finale, synchronized phones, no browser errors');
  } finally {
    await browser.close();
    await borrarSala();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
