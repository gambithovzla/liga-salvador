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
    await b(host, 'Comenzar el gran final').click();
    await b(host, '¡A la gran final!').click();
    await b(player, 'Enviar mi energía').click();
    await host.locator('[data-final-conteo]').filter({ hasText: '1' }).waitFor();
    assert.equal(await b(player, 'Energía enviada').isDisabled(), true);
    await b(host, 'Encender la ciudad').click();
    await player.locator('.escena-1').waitFor({ timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('#raiz-jugador .cine-recuerdo img')?.naturalWidth > 0);
    await player.locator('.escena-2').waitFor({ timeout: 10000 });
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
    assert.deepEqual(errors, []);
    console.log('PASS: withdrawal, deletion including image data, no browser errors');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
