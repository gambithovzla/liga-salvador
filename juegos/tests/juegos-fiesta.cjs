/* Run against a local static server. Never connects to the production database.
   Plays the reworked games in the demo: Gran Premio de Barranco, bingo, bomba,
   «Un, dos, tres… ¡Zzz!» and the three minigames, at desktop and phone width. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const url = new URL(process.env.LIGA_TEST_URL || 'http://127.0.0.1:8765/juegos/?demo');
  assert(['127.0.0.1', 'localhost'].includes(url.hostname), 'Use a local server');
  url.searchParams.set('demo', '');
  const browser = process.env.PLAYWRIGHT_WS_ENDPOINT
    ? await chromium.connect(process.env.PLAYWRIGHT_WS_ENDPOINT)
    : await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, headless: true } : { channel: 'chrome', headless: true });
  const errors = [];
  async function abrir(viewport) {
    const context = await browser.newContext({ viewport });
    await context.route('**/*', route => {
      const host = new URL(route.request().url()).hostname;
      return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(9000);
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(url.href);
    const player = page.locator('#raiz-jugador'), host = page.locator('#raiz-comando');
    await page.locator('#nombre-heroe').fill('Aurora de prueba');
    await player.locator('label.opcion-poder').filter({ hasText: 'Velocidad del rayo' }).click();
    await player.getByRole('button', { name: '¡Unirme a la Liga!', exact: true }).click();
    await player.getByRole('button', { name: '¡A la fiesta!', exact: true }).click();
    await page.waitForFunction(() => Object.keys(__demo.comando.S.agentes || {}).length >= 4);
    return { context, page, player, host };
  }
  const mision = (page) => page.evaluate(() => __demo.T.leer('mision'));
  const mj = (page, ruta) => page.evaluate(async (r) => { const m = await __demo.T.leer('mision'); return __demo.T.leer(`mj/${m.id}/${r}`); }, ruta);
  async function lanzar(page, player, host, tipo, cfg, sala) {
    await page.evaluate(([t, c]) => __demo.comando.lanzarTipo(t, c), [tipo, cfg || {}]);
    await player.getByRole('button', { name: /vamos/i }).click();
    if (sala) {
      await player.getByRole('button', { name: /estoy listo/i }).click();
      await page.waitForFunction(() => Object.keys((__demo.comando.S.mj || {}).listos || {}).length >= 3, null, { timeout: 15000 });
      await host.locator('[data-accion="empezar"]').click();
    }
  }
  async function resultados(page) { await page.waitForFunction(() => (__demo.comando.S.mision || {}).fase === 'resultados', null, { timeout: 60000 }); }

  try {
    const { context, page, player, host } = await abrir({ width: 1440, height: 1000 });

    // Gran Premio de Barranco: alternate feet, jump the three obstacles, use the power once, reach the finish.
    await lanzar(page, player, host, 'carrera', {}, true);
    await player.locator('.gp-lienzo').waitFor();
    await host.locator('.gp-tv .gp-lienzo').waitFor();
    await page.waitForFunction(() => __demo.T.ahora() >= __demo.comando.S.mision.sub.inicio, null, { timeout: 9000 });
    const pies = player.locator('.gp-pie');
    let saltos = 0, poder = false;
    for (let k = 0; k < 700 && !(await player.locator('.gp-cartel.meta').count()); k++) {
      if (await player.locator('[data-gp-salto]:not([hidden])').count()) { await player.locator('[data-gp-saltar]').dispatchEvent('pointerdown'); saltos++; await page.waitForTimeout(1300); continue; }
      if (!poder && await player.locator('[data-gp-poder]:not([disabled])').count()) { await player.locator('[data-gp-poder]').dispatchEvent('pointerdown'); poder = true; await page.waitForTimeout(950); continue; }
      await pies.nth(k % 2).dispatchEvent('pointerdown');
      await page.waitForTimeout(25);
    }
    await player.locator('.gp-cartel.meta').waitFor();
    assert(poder, 'the power was used');
    assert(saltos >= 2, 'jumped the obstacles that the power did not cross');
    const fx = await mj(page, 'fx');
    assert(Object.keys(fx || {}).length >= 1, 'race effects are shared with the broadcast');
    assert.equal(Number((await mj(page, 'pasos'))[await page.evaluate(() => __demo.jugador.yo)]), 150);
    await host.locator('[data-gp-relato] p').first().waitFor();
    await resultados(page);
    const res = await mision(page);
    assert(Object.values(res.resultados || {}).some((r) => r.txt.endsWith(' s')));
    console.log('PASS: Gran Premio de Barranco with jumps, power, broadcast and finish');

    // Bingo: the holographic card, the board and the shared celebration.
    await player.getByRole('button', { name: 'Volver al cuartel', exact: true }).click().catch(() => {});
    await lanzar(page, player, host, 'bingo', { modo: 'manual' }, false);
    await player.locator('.carton').waitFor();
    for (let k = 0; k < 48; k++) {
      if (Object.keys((await mj(page, 'lleno')) || {}).length) break;
      await host.locator('[data-accion="cantar"]').click();
      await page.waitForTimeout(950);
    }
    await host.locator('.bg-carta b').waitFor();
    assert.ok(await host.locator('.bg-tablero span.sale').count() > 8);
    await player.locator('.bg-celebra').waitFor();
    await host.locator('[data-vivo="celebra"]:not([hidden])').waitFor();
    await resultados(page);
    console.log('PASS: bingo with tombola, board, near-bingo suspense and shared celebration');

    // Bomba: the holder's screen beats red; the explosion leaves soot, and nobody can avoid it.
    await player.getByRole('button', { name: 'Volver al cuartel', exact: true }).click().catch(() => {});
    await lanzar(page, player, host, 'bomba', {}, true);
    await host.locator('.bm-tv .bm-bomba').waitFor();
    await page.evaluate(async () => {
      const m = await __demo.T.leer('mision'), yo = __demo.jugador.yo, bb = await __demo.T.leer(`mj/${m.id}/bomba`);
      await __demo.T.escribir(`mj/${m.id}/bomba`, Object.assign({}, bb, { holder: yo, de: 'x', t: __demo.T.ahora() }));
      await __demo.T.actualizar('mision', { 'sub/inicio': __demo.T.ahora() - 50000, 'sub/explota': __demo.T.ahora() + 2500 });
    });
    await page.waitForFunction(() => !!document.querySelector('#raiz-jugador .bm-caliente'));
    assert.match(await player.locator('.bm-caliente').evaluate((el) => el.style.getPropertyValue('--bm-ritmo')), /^\d+ms$/);
    await player.locator('.bm-explota.bm-mia .bm-tizne').waitFor({ timeout: 8000 });
    assert.equal(await player.locator('.bm-caliente').count(), 0);
    await host.locator('.bm-explota').waitFor();
    await page.evaluate(() => __demo.comando && __demo.T.actualizar('mision', { 'sub/estado': 'pausa', 'sub/k': 3, 'sub/hasta': __demo.T.ahora() - 1 }));
    await resultados(page);
    console.log('PASS: bomb with accelerating tick, red pulse, flight and soot explosion');

    // Un, dos, tres… ¡Zzz!: walking while he sleeps advances; moving while he looks sends you back.
    await player.getByRole('button', { name: 'Volver al cuartel', exact: true }).click().catch(() => {});
    await lanzar(page, player, host, 'zzz', {}, true);
    const caminar = player.locator('[data-zz-caminar]');
    await caminar.waitFor();
    const fase = () => page.evaluate(async () => { const m = await __demo.T.leer('mision'); return m.sub ? faseZzz(m.sub, __demo.T.ahora()).tipo : 'fin'; });
    await page.waitForFunction(() => faseZzz(__demo.comando.S.mision.sub, __demo.T.ahora()).tipo === 'duerme', null, { timeout: 12000 });
    const caja = await caminar.boundingBox();
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    const avance = Number((await player.locator('[data-zz-pct]').textContent()).replace(/\D/g, ''));
    assert(avance >= 4 && avance <= 12, `walking 1.5 s advances about 7 %, got ${avance}`);
    while (await fase() !== 'mira') await page.waitForTimeout(100);
    await player.locator('[data-zz-visto]:not([hidden])').waitFor({ timeout: 4000 });
    await page.mouse.up();
    assert.ok(Number((await mj(page, 'vistos'))[await page.evaluate(() => __demo.jugador.yo)]) >= 1);
    await host.locator('[data-vivo="zz-relato"] p').first().waitFor();
    await page.evaluate(() => __demo.T.actualizar('mision', { 'sub/limite': __demo.T.ahora() - 1 }));
    await resultados(page);
    console.log('PASS: Un, dos, tres… ¡Zzz! walking, caught while looking, broadcast and results');

    // Minigames: they finish and record a mark (villain with combo and blackout, balloons, stars).
    for (const [tipo, jugar] of [
      ['rescate', async () => {
        for (let n = 1; n <= 20; n++) { await player.locator(`.num[data-n="${n}"]`).dispatchEvent('pointerdown'); await page.waitForTimeout(40); }
        await player.locator('.globos-uno').waitFor();
      }],
      ['villano', async () => {
        const fin = Date.now() + 26000;
        while (Date.now() < fin && await player.locator('[data-arena]').count()) {
          const v = player.locator('.ventana.arriba:not([data-quien="salva"])').first();
          if (await v.count()) await v.dispatchEvent('pointerdown').catch(() => {});
          if (await player.locator('.villano-arena.apagado').count()) break;
          await page.waitForTimeout(60);
        }
        await player.locator('.villano-arena.apagado').waitFor();
      }],
      ['estrellas', async () => { await player.locator('.estrellas-suben').waitFor({ timeout: 35000 }); }],
    ]) {
      await player.getByRole('button', { name: 'Volver al cuartel', exact: true }).click().catch(() => {});
      await page.evaluate((t) => __demo.comando.lanzarTipo(t, { minutos: 3 }), tipo);
      await player.getByRole('button', { name: /vamos/i }).click();
      await player.getByRole('button', { name: /ya sé jugar|^¡jugar!$/i }).first().click();
      await player.locator('[data-arena]').waitFor();
      await jugar();
      await page.waitForFunction(() => !!((__demo.comando.S.mj || {}).res || {})[__demo.jugador.yo], null, { timeout: 35000 });
      if (tipo === 'estrellas') await host.locator('.constelacion svg circle.luz').first().waitFor();
      await page.evaluate(() => __demo.T.actualizar('mision', { cierra: __demo.T.ahora() - 1000 }));
      await resultados(page);
    }
    console.log('PASS: balloons form the giant 1, villain blackout, stars light the constellation');
    await context.close();

    // Phone width: the race fits without horizontal scroll and the controls are reachable.
    const tel = await abrir({ width: 375, height: 760 });
    await tel.page.evaluate(() => { __demo.comando.lanzarTipo('carrera', {}); __demo.ver('celular'); });
    await tel.player.getByRole('button', { name: /vamos/i }).click();
    await tel.player.getByRole('button', { name: /estoy listo/i }).click();
    await tel.page.waitForTimeout(2500);
    await tel.page.evaluate(() => __demo.ver('comando'));
    await tel.host.locator('[data-accion="empezar"]').click();
    await tel.page.evaluate(() => __demo.ver('celular'));
    await tel.player.locator('.gp-controles').waitFor();
    assert.equal(await tel.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    const pie = await tel.player.locator('.gp-pie').first().boundingBox();
    assert(pie && pie.height >= 90, 'feet buttons are large enough for the thumb');
    console.log('PASS: race layout at 375 px');
    await tel.context.close();

    assert.deepEqual(errors, []);
    console.log('PASS: no browser errors');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
