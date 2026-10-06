/* Run against a local static server. Never connects to the production database. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const url = new URL(process.env.LIGA_TEST_URL || 'http://127.0.0.1:8765/juegos/?demo');
  assert(['127.0.0.1', 'localhost'].includes(url.hostname), 'Use a local server');
  url.searchParams.set('demo', '');
  const browser = process.env.PLAYWRIGHT_WS_ENDPOINT
    ? await chromium.connect(process.env.PLAYWRIGHT_WS_ENDPOINT)
    : await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  try {
    await context.route('**/*', route => {
      const host = new URL(route.request().url()).hostname;
      return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(url.href);
    const player = page.locator('#raiz-jugador'), host = page.locator('#raiz-comando');
    const b = (root, name) => root.getByRole('button', { name, exact: true });
    const fixture = path.join(__dirname, '../img/salva-cara.webp');
    const pick = async button => {
      const chooser = page.waitForEvent('filechooser');
      await button.click();
      await (await chooser).setFiles(fixture);
    };
    await page.locator('#nombre-heroe').fill('Aurora de prueba');
    await player.locator('label.opcion-poder').filter({ hasText: 'Vuelo' }).click();
    await b(player, '¡Unirme a la Liga!').click();
    await b(player, '¡A la fiesta!').click();
    await b(player, 'Abrir álbum y crear mi portada ↗').click();
    await pick(player.getByRole('button', { name: 'Crear mi portada con una foto' }));
    await player.locator('.portada-canvas').waitFor();
    await player.locator('[data-ajuste=zoom]').fill('1.4');
    await player.locator('[data-ajuste=y]').fill('0.25');
    const downloadEvent = page.waitForEvent('download');
    await b(player, 'Descargar portada').click();
    const download = await downloadEvent;
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const png = Buffer.concat(chunks);
    assert.equal(png.readUInt32BE(16), 1080);
    assert.equal(png.readUInt32BE(20), 1440);
    assert.equal(await page.evaluate(async () => Object.keys(await __demo.T.leer('recuerdos') || {}).length), 0);
    await page.setViewportSize({ width: 320, height: 740 });
    assert.equal(await player.locator('.estudio-modal').evaluate(el => el.scrollWidth > el.clientWidth), false);
    await player.locator('#permiso-album').check();
    // A failed upload must retain the photo and allow retry without creating metadata.
    await page.evaluate(() => {
      const original = __demo.T.actualizar;
      __demo.T.actualizar = function (p, value) {
        if (p === '' && Object.keys(value).some(k => k.startsWith('recuerdos/'))) {
          __demo.T.actualizar = original;
          return Promise.reject(new Error('QA: offline'));
        }
        return original(p, value);
      };
    });
    await b(player, 'Enviar para aprobación').click();
    await player.getByText('No se pudo completar. Revisa tu conexión e inténtalo otra vez.', { exact: true }).waitFor();
    await b(player, 'Enviar para aprobación').click();
    await player.getByText('Esperando aprobación', { exact: true }).waitFor();
    await b(player, 'La Liga').click();
    assert.equal(await player.locator('.archivo-foto').count(), 0);
    await b(player, 'Cerrar álbum').click();
    console.log('PASS: local export, 320px layout, consent, failed upload and retry');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await host.getByRole('tab', { name: 'Marcador', exact: true }).click();
    await b(host, 'Revisar y aprobar fotos').click();
    await b(host, 'Aprobar').click();
    await host.getByText('Todo al día', { exact: true }).waitFor();
    await b(host, 'Cerrar álbum').click();
    await b(player, 'Abrir álbum y crear mi portada ↗').click();
    await player.locator('.archivo-foto').waitFor();
    assert.equal(await player.locator('.archivo-foto').count(), 1);
    await b(player, 'Cerrar álbum').click();
    // Time capsule: the guest writes from the HQ; the host sees it in the dossier.
    await player.locator('#capsula-texto').fill('Querido Salvador: nunca dejes de volar.');
    await b(player, 'Guardar mi mensaje').click();
    await page.waitForFunction(async () => Object.keys(await __demo.T.leer('capsula') || {}).length === 1);
    await host.locator('[data-vivo="capsula-n"]').filter({ hasText: '1' }).waitFor();
    console.log('PASS: time capsule saved');

    await b(host, 'Comenzar el gran final').click();
    await b(host, '¡A la gran final!').click();
    await player.locator('.op-hackeo').waitFor();
    const me = await page.evaluate(() => __demo.jugador.yo);
    // Jump past the intro so the activation button is on screen.
    await page.evaluate(async () => __demo.T.actualizar('final', { t: __demo.T.ahora() - 30000 }));
    await player.locator('.op-hackeo[data-etapa="boton"]').waitFor();
    assert.match(await player.locator('[data-op-texto]').getAttribute('data-op-texto'), /Te vi, Aurora de prueba\./);
    await player.locator('[data-accion="op-activar"]').click();
    await player.getByText('PODER ACTIVADO', { exact: true }).waitFor();
    await page.waitForFunction(async id => !!(await __demo.T.leer('final')).listos?.[id], me);
    await b(host, '¡Que empiece la batalla!').click();
    const pad = player.locator('[data-op-pad]');
    await pad.waitFor();
    for (let i = 0; i < 12; i++) { await pad.dispatchEvent('pointerdown'); await pad.dispatchEvent('pointerup'); await page.waitForTimeout(120); }
    await page.waitForFunction(async id => Number((await __demo.T.leer('final')).golpes?.[id]) >= 10, me);
    await host.locator('[data-accion="op-chispa"]').click();
    await player.locator('.op-chispa[data-momento="preparar"]').waitFor();
    const chispa = await page.evaluate(async () => { const f = await __demo.T.leer('final'); const p = planChispa(f); return { n: f.orden.length, pasos: p.pasos.length, fin: p.fin }; });
    assert(chispa.n >= 1 && chispa.pasos > 10);
    await assert.rejects(b(host, 'Luces apagadas: encender las velas').click({ timeout: 300 }));
    await page.evaluate(async ms => __demo.T.actualizar('final', { chispaT: __demo.T.ahora() - ms }), chispa.fin + 2400 + 9000);
    await player.locator('.op-chispa[data-momento="oscuro"]').waitFor();
    await b(host, 'Luces apagadas: encender las velas').click();
    await player.locator('.op-velas[data-estado="encendida"]').waitFor();
    await b(host, 'Salvador sopló la vela').click();
    await player.locator('.op-velas[data-estado="soplada"]').waitFor();
    await player.locator('.op-velas[data-estado="feliz"]').waitFor();
    await b(host, 'Ver la película de la Liga').click();
    console.log('PASS: villain takeover, boss fight, shared spark, synchronized candles');
    await player.locator('.cine-etapa-0').waitFor();
    assert.equal(await b(host, 'Continuar al podio').isDisabled(), true);
    // Move shared server time through every chapter; keep the real transport/UI flow.
    for (const [offset, stage] of [[5000, 1], [11000, 2], [14000, 2], [17000, 2], [20000, 2], [23000, 3], [29000, 4]]) {
      await page.evaluate(async ms => __demo.T.actualizar('final', { escenaT: __demo.T.ahora() - ms }), offset);
      await player.locator(`.cine-etapa-${stage}`).waitFor();
      if (stage === 2) await page.waitForFunction(() => document.querySelector('#raiz-jugador .cine-fotograma img')?.naturalWidth > 0);
    }
    await page.evaluate(async () => __demo.T.actualizar('final', { escenaT: __demo.T.ahora() - 36000 }));
    await b(host, 'Continuar al podio').waitFor();
    await page.waitForFunction(() => !document.querySelector('#raiz-comando [data-accion="final-podio"]')?.disabled);
    await b(host, 'Continuar al podio').click();
    for (const name of ['Revelar el 3.er lugar', 'Revelar el 2.º lugar', 'Revelar al campeón']) {
      await b(host, name).click();
    }
    await b(player, 'Abrir álbum y crear mi portada ↗').waitFor();
    const final = await page.evaluate(async () => __demo.T.leer('final'));
    assert.equal(final.paso, final.podio.length);
    await b(player, 'Abrir álbum y crear mi portada ↗').click();
    await b(player, 'Crear portada').click();
    await b(player, 'Descargar portada').click();
    await b(player, 'Cerrar álbum').click();
    await b(host, 'Pasar los créditos finales').click();
    await player.locator('.op-creditos').waitFor();
    assert.equal(await player.locator('.op-c-reparto li.yo').count(), 1);
    await player.getByText('«Querido Salvador: nunca dejes de volar.»', { exact: true }).waitFor();
    const creditos = await page.evaluate(() => __demo.T.leer('final'));
    await page.evaluate(async d => __demo.T.actualizar('final', { creditosT: __demo.T.ahora() - d - 500 }), creditos.creditosDur);
    await player.locator('.op-creditos.terminado').waitFor();
    const fichaEvent = page.waitForEvent('download');
    await b(player, 'Descargar mi ficha de héroe').click();
    const fichaChunks = [];
    for await (const chunk of await (await fichaEvent).createReadStream()) fichaChunks.push(chunk);
    const ficha = Buffer.concat(fichaChunks);
    assert.equal(ficha.readUInt32BE(16), 1080);
    assert.equal(ficha.readUInt32BE(20), 1440);
    console.log('PASS: credits with cast, capsule message and hero card');
    await page.evaluate(async () => __demo.T.actualizar('final', { fase: 'historia', escenaT: __demo.T.ahora() }));
    await b(host, 'Ir al podio ahora').click();
    await b(host.locator('.capa-modal'), 'Ir al podio').click();
    await page.waitForFunction(async () => (await __demo.T.leer('final'))?.fase === 'podio');
    console.log('PASS: approval, shared energy, photo montage, reveal and final keepsake');

    await host.getByRole('tab', { name: 'Marcador', exact: true }).click();
    await b(host, 'Revisar y aprobar fotos').click();
    await b(host, 'Todas').click();
    await b(host, 'Retirar del álbum').click();
    await host.getByText('Fuera del álbum', { exact: true }).waitFor();
    await b(host, 'Cerrar álbum').click();
    await b(player, 'Abrir álbum y crear mi portada ↗').click();
    assert.equal(await player.locator('.archivo-foto').count(), 0);
    await b(player, 'Mis fotos').click();
    await b(player, 'Eliminar foto').click();
    await b(player.locator('.capa-modal'), 'Eliminar foto').click();
    await page.waitForFunction(async () => !(await __demo.T.leer('recuerdos')));
    assert.equal(await page.evaluate(async () => __demo.T.leer('fotos/recuerdos')), null);
    assert.equal(await page.evaluate(async () => __demo.T.leer('fotosMini/recuerdos')), null);
    await b(player, 'Cerrar álbum').click();
    await page.evaluate(async () => __demo.T.actualizar('final', { fase: 'historia', escenaT: __demo.T.ahora() - 12000 }));
    await player.locator('.cine-nombres span').first().waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: withdrawal, deletion, film without photos, no browser errors');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
