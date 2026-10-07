/* Gran Premio de Barranco: la Carrera de la Liga.
   Un mundo pintado en capas (cielo, mar, acantilados, casonas, palmeras, faroles) que pasa del
   atardecer a la noche mientras se corre. Cada celular dibuja su propia cámara; el centro de mando
   lo transmite como en la tele. Los datos compartidos siguen siendo los de siempre:
   mj/{id}/pasos/{agente}, mj/{id}/llegada/{agente} y, para los efectos, mj/{id}/fx/{agente}. */

const GP_OBSTACULOS = [
  { p: 38, tipo: "charco", nombre: "el charco del malecón" },
  { p: 82, tipo: "cajas", nombre: "las cajas de la feria" },
  { p: 120, tipo: "nube", nombre: "la nube del Doctor Siesta" },
];
const GP_PUENTE = [52, 74];      // el Puente de los Suspiros, en pasos
const GP_IMPULSO = 10;           // pasos que regala el poder
const GP_PODER_DESDE = 8;        // se puede usar después de los primeros pasos
const GP_CICLO_SALTO = 1100;     // el anillo del salto se cierra cada 1,1 s
const GP_ATURDIDO = 1100;
const GP_BPM = 112;

const GP_PODERES = {
  fuerza: { color: "#ff7a45", nombre: "Puñetazo de fuerza", grito: "¡PUÑO DE ACERO!" },
  rayo: { color: "#ffd84a", nombre: "Sprint del rayo", grito: "¡VELOCIDAD DEL RAYO!" },
  vuelo: { color: "#86d8ff", nombre: "Planeo", grito: "¡A VOLAR!" },
  invisible: { color: "#c3b3ff", nombre: "Paso fantasma", grito: "¡INVISIBLE!" },
  abrazos: { color: "#ff9ccc", nombre: "Abrazo turbo", grito: "¡SÚPER ABRAZO!" },
  risa: { color: "#93ffa8", nombre: "Carcajada cohete", grito: "¡JA, JA, JAAA!" },
  laser: { color: "#ff5468", nombre: "Rayo láser", grito: "¡VISIÓN LÁSER!" },
  escudo: { color: "#5fb0ff", nombre: "Embestida de escudo", grito: "¡ESCUDO INVENCIBLE!" },
};
function gpPoder(id) { return GP_PODERES[id] || GP_PODERES.rayo; }
function gpZona(p) {
  if (p < GP_PUENTE[0]) return "Malecón de Barranco";
  if (p < GP_PUENTE[1]) return "Puente de los Suspiros";
  if (p < 108) return "Bajada de Baños";
  return "Recta final";
}
function gpSuperficie(p) { return p >= GP_PUENTE[0] && p < GP_PUENTE[1] ? "madera" : "piedra"; }

/* ---------- color ---------- */
const gpCacheHex = new Map();
function gpHex(h) {
  let v = gpCacheHex.get(h);
  if (!v) { const n = parseInt(h.slice(1), 16); v = [n >> 16 & 255, n >> 8 & 255, n & 255]; gpCacheHex.set(h, v); }
  return v;
}
function gpMezcla(a, b, t, alfa) {
  const x = gpHex(a), y = gpHex(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return alfa === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${alfa})`;
}
function gpSuave(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function gpRuido(i, s) { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); }

// Un destello radial ya pintado: dibujarlo escalado cuesta mucho menos que crear degradados en cada cuadro.
const gpCacheBrillo = new Map();
function gpBrillo(color) {
  let c = gpCacheBrillo.get(color);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, gpMezcla(color, "#ffffff", 0.55, 1));
  r.addColorStop(0.18, gpMezcla(color, color, 0, 0.75));
  r.addColorStop(0.5, gpMezcla(color, color, 0, 0.18));
  r.addColorStop(1, gpMezcla(color, color, 0, 0));
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  gpCacheBrillo.set(color, c);
  return c;
}
function gpGlow(g, color, x, y, radio, alfa) {
  if (alfa <= 0.01 || radio <= 0) return;
  g.globalAlpha = alfa;
  g.drawImage(gpBrillo(color), x - radio, y - radio, radio * 2, radio * 2);
  g.globalAlpha = 1;
}

// El Doctor Siesta y Salvador, como imágenes para el lienzo.
let gpSiestaImg = null, gpSalvaImg = null;
function gpImagenes() {
  if (!gpSiestaImg && typeof jefeSVG === "function") {
    const svg = jefeSVG("").replace(/<g class="op-ojos-cerrados">.*?<\/g>/, "").replace(/<path class="op-boca-dormida"[^>]*\/>/, "")
      .replace('class="op-villano "', 'xmlns="http://www.w3.org/2000/svg"');
    gpSiestaImg = new Image();
    gpSiestaImg.src = "data:image/svg+xml," + encodeURIComponent(svg);
  }
  if (!gpSalvaImg) {
    const src = typeof imagenSalva === "function" && imagenSalva("salvador");
    if (src) { gpSalvaImg = new Image(); gpSalvaImg.src = src; }
  }
}
const gpLista = (img) => !!(img && img.complete && img.naturalWidth);

/* ---------- el mundo ---------- */
// modo "jugador": la cámara te sigue a ti. modo "tv": sigue la carrera completa.
function crearMundoCarrera(lienzo, opc) {
  gpImagenes();
  const g = lienzo.getContext("2d");
  const suave = !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0, u = 1, raf = 0, vivo = true, camX = null, ultimo = 0;
  const vista = new Map();          // id -> pasos dibujados (suavizados)
  let particulas = [];
  let destello = 0, camaraLenta = 0, focoMeta = 0;
  const huellas = new Map();        // id -> último paso con partícula
  function medir() {
    const r = lienzo.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = r.width; H = r.height; u = H / 300;
    lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const obs = typeof ResizeObserver === "function" ? new ResizeObserver(medir) : null;
  if (obs) obs.observe(lienzo);
  medir();

  const PX = () => 40 * u;                       // un paso, en la pista
  const xPista = (p) => p * PX();
  const sueloY = () => H * 0.86;

  /* cielo, sol, luna y estrellas */
  function cielo(n, t) {
    const hor = H * 0.47;
    const gr = g.createLinearGradient(0, 0, 0, hor);
    gr.addColorStop(0, gpMezcla("#1c2459", "#030817", n));
    gr.addColorStop(0.55, gpMezcla("#71498e", "#0a1c3f", n));
    gr.addColorStop(1, gpMezcla("#ffad62", "#1f5f78", n));
    g.fillStyle = gr; g.fillRect(0, 0, W, hor + 2);
    if (n > 0.25) {
      for (let i = 0; i < 70; i++) {
        const sx = (gpRuido(i, 1) * W * 1.3 - (camX || 0) * 0.01) % W;
        const sy = gpRuido(i, 2) * hor * 0.8;
        const titila = suave ? 0.6 + 0.4 * Math.sin(t / 700 + i) : 1;
        g.globalAlpha = (n - 0.25) * 1.3 * titila * (0.35 + gpRuido(i, 3) * 0.65);
        g.fillStyle = "#eef6ff";
        const tam = gpRuido(i, 4) > 0.85 ? 1.8 * u : 1 * u;
        g.fillRect((sx + W) % W, sy, tam, tam);
      }
      g.globalAlpha = 1;
    }
    // El sol se hunde en el mar; la luna sube por el otro lado.
    const solX = W * 0.74, solY = hor - H * 0.1 + n * H * 0.16;
    if (n < 0.9) {
      g.save(); g.beginPath(); g.rect(0, 0, W, hor); g.clip();
      gpGlow(g, "#ffb35c", solX, solY, H * 0.42, 0.55 * (1 - n));
      g.fillStyle = gpMezcla("#fff1c4", "#ff9a52", n, 1 - n * 0.6);
      g.beginPath(); g.arc(solX, solY, H * 0.055, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    if (n > 0.3) {
      const lunaX = W * 0.22, lunaY = hor - (n - 0.3) * H * 0.55;
      gpGlow(g, "#9fd2ff", lunaX, lunaY, H * 0.3, 0.45 * gpSuave(0.3, 0.8, n));
      g.globalAlpha = gpSuave(0.3, 0.7, n);
      g.fillStyle = "#f4f8ff";
      g.beginPath(); g.arc(lunaX, lunaY, H * 0.04, 0, Math.PI * 2); g.fill();
      g.fillStyle = gpMezcla("#0a1c3f", "#0a1c3f", 0, 0.9);
      g.beginPath(); g.arc(lunaX + H * 0.016, lunaY - H * 0.008, H * 0.036, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    }
    return { hor, solX, solY };
  }

  /* el mar del Pacífico con su reflejo */
  function mar(n, t, astro) {
    const hor = astro.hor, fondo = H * 0.66;
    const gr = g.createLinearGradient(0, hor, 0, fondo);
    gr.addColorStop(0, gpMezcla("#d98a6a", "#173d5a", n));
    gr.addColorStop(1, gpMezcla("#3b2f62", "#06142b", n));
    g.fillStyle = gr; g.fillRect(0, hor, W, fondo - hor);
    const rx = n < 0.6 ? astro.solX : W * 0.22;
    const color = n < 0.6 ? "#ffd38a" : "#bfe3ff";
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 16; i++) {
      const y = hor + 2 * u + i * (fondo - hor) / 16;
      const ancho = (10 + i * 5) * u * (0.6 + 0.4 * Math.sin(t / 500 + i * 1.7));
      g.globalAlpha = 0.28 * (1 - i / 18);
      g.fillStyle = color;
      g.fillRect(rx - ancho / 2 + Math.sin(t / 900 + i) * 6 * u, y, ancho, 1.2 * u);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  /* los acantilados de la Costa Verde, muy lejos */
  function acantilados(n) {
    const f = 0.06, off = (camX || 0) * f, base = H * 0.5;
    g.fillStyle = gpMezcla("#5b4677", "#0d2038", n, 0.9);
    g.beginPath(); g.moveTo(0, H * 0.7);
    for (let x = 0; x <= W + 8; x += 8 * u) {
      const wx = (x + off) / u;
      const y = base - (Math.sin(wx / 37) * 6 + Math.sin(wx / 13 + 2) * 2.5 + Math.sin(wx / 91) * 9 + 6) * u;
      g.lineTo(x, y);
    }
    g.lineTo(W, H * 0.7); g.closePath(); g.fill();
    // bruma sobre el agua
    const br = g.createLinearGradient(0, base - 20 * u, 0, H * 0.66);
    br.addColorStop(0, gpMezcla("#ffb88a", "#2a6a86", n, 0));
    br.addColorStop(1, gpMezcla("#ffb88a", "#2a6a86", n, 0.25));
    g.fillStyle = br; g.fillRect(0, base - 20 * u, W, H * 0.66 - base + 20 * u);
  }

  /* casonas de Barranco con balcones y la Ermita */
  function casonas(n, t) {
    const f = 0.32, off = (camX || 0) * f, ranura = 64 * u, base = H * 0.7;
    const i0 = Math.floor(off / ranura) - 1, i1 = Math.ceil((off + W) / ranura) + 1;
    for (let i = i0; i <= i1; i++) {
      const r = gpRuido(i, 7), ancho = (40 + r * 22) * u;
      const x = i * ranura - off + gpRuido(i, 8) * 10 * u;
      const ermita = ((i % 23) + 23) % 23 === 11;
      const alto = (ermita ? 92 : 38 + gpRuido(i, 9) * 34) * u;
      const y = base - alto;
      // cuerpo
      g.fillStyle = gpMezcla(["#6a4a7e", "#7a4a6a", "#5a4f86"][i & 1 ? 1 : (i % 3 + 3) % 3 === 2 ? 2 : 0], "#0d1832", n);
      g.fillRect(x, y, ancho, alto);
      // luz de borde: dorada al atardecer, turquesa de noche
      g.fillStyle = gpMezcla("#ffbf7a", "#3fa7b6", n, 0.5);
      g.fillRect(x + ancho - 2 * u, y, 2 * u, alto);
      if (ermita) {
        // la Ermita: fachada escalonada y dos campanarios
        g.fillStyle = gpMezcla("#7d5a86", "#13213f", n);
        g.fillRect(x - 6 * u, y + 20 * u, ancho + 12 * u, alto - 20 * u);
        g.fillRect(x + 2 * u, y - 16 * u, 10 * u, 20 * u);
        g.fillRect(x + ancho - 12 * u, y - 16 * u, 10 * u, 20 * u);
        g.beginPath(); g.moveTo(x + ancho / 2 - 14 * u, y); g.lineTo(x + ancho / 2, y - 14 * u); g.lineTo(x + ancho / 2 + 14 * u, y); g.fill();
        gpGlow(g, "#ffcf7a", x + ancho / 2, y + 40 * u, 26 * u, 0.25 + 0.4 * n);
        g.fillStyle = gpMezcla("#3a2a4a", "#ffcf7a", 0.3 + n * 0.6);
        g.beginPath(); g.arc(x + ancho / 2, y + 44 * u, 9 * u, Math.PI, 0); g.fill();
        g.fillRect(x + ancho / 2 - 9 * u, y + 44 * u, 18 * u, 26 * u);
        continue;
      }
      // techo: a dos aguas o con baranda
      g.fillStyle = gpMezcla("#4a3460", "#09122a", n);
      if (r > 0.5) { g.beginPath(); g.moveTo(x - 3 * u, y); g.lineTo(x + ancho / 2, y - 12 * u); g.lineTo(x + ancho + 3 * u, y); g.fill(); }
      else { g.fillRect(x - 2 * u, y - 4 * u, ancho + 4 * u, 4 * u); for (let k = 0; k < ancho; k += 6 * u) g.fillRect(x + k, y - 8 * u, 2 * u, 4 * u); }
      // ventanas: se encienden al caer la noche
      const filas = Math.max(1, Math.floor(alto / (16 * u)) - 1), cols = Math.max(1, Math.floor(ancho / (13 * u)));
      for (let a = 0; a < filas; a++) for (let b = 0; b < cols; b++) {
        const wx = x + 5 * u + b * (ancho - 10 * u) / cols, wy = y + 8 * u + a * 16 * u;
        const luz = gpRuido(i * 13 + a * 5 + b, 11) < 0.15 + n * 0.75;
        g.fillStyle = luz ? gpMezcla("#ffd99a", "#ffc766", n) : gpMezcla("#3b2a52", "#0a1328", n);
        g.fillRect(wx, wy, 6 * u, 8 * u);
        if (luz && n > 0.35) gpGlow(g, "#ffc766", wx + 3 * u, wy + 4 * u, 9 * u, 0.35 * n);
      }
      // balcón de madera, como los de Barranco
      if (gpRuido(i, 12) > 0.45) {
        const by = y + 14 * u;
        g.fillStyle = gpMezcla("#5a3424", "#1d1420", n);
        g.fillRect(x + ancho * 0.18, by, ancho * 0.64, 12 * u);
        g.fillStyle = gpMezcla("#c98a52", "#4a3a3a", n, 0.6);
        for (let k = 0; k < ancho * 0.64; k += 4 * u) g.fillRect(x + ancho * 0.18 + k, by + 2 * u, 1 * u, 8 * u);
      }
    }
    void t;
  }

  /* palmeras y faroles del malecón */
  function palmeras(n, t) {
    const f = 0.62, off = (camX || 0) * f, ranura = 120 * u, base = H * 0.72;
    const i0 = Math.floor(off / ranura) - 1, i1 = Math.ceil((off + W) / ranura) + 1;
    for (let i = i0; i <= i1; i++) {
      const x = i * ranura - off + gpRuido(i, 21) * 30 * u;
      if (gpRuido(i, 22) > 0.4) {
        // palmera
        const alto = (70 + gpRuido(i, 23) * 30) * u, curva = (gpRuido(i, 24) - 0.5) * 30 * u;
        const tope = { x: x + curva, y: base - alto };
        g.strokeStyle = gpMezcla("#3a2440", "#050b1a", n); g.lineWidth = 4 * u; g.lineCap = "round";
        g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + curva * 0.2, base - alto * 0.6, tope.x, tope.y); g.stroke();
        const viento = suave ? Math.sin(t / 1300 + i) * 0.08 : 0;
        g.fillStyle = gpMezcla("#3a2440", "#050b1a", n);
        for (let k = 0; k < 7; k++) {
          const ang = -Math.PI / 2 + (k - 3) * 0.55 + viento, largo = (26 + (k % 2) * 8) * u;
          const ex = tope.x + Math.cos(ang) * largo, ey = tope.y + Math.sin(ang) * largo * 0.6 + largo * 0.35;
          g.beginPath(); g.moveTo(tope.x, tope.y);
          g.quadraticCurveTo(tope.x + Math.cos(ang) * largo * 0.6, tope.y + Math.sin(ang) * largo * 0.6 - 8 * u, ex, ey);
          g.quadraticCurveTo(tope.x + Math.cos(ang) * largo * 0.5, tope.y + Math.sin(ang) * largo * 0.5, tope.x, tope.y + 3 * u);
          g.fill();
        }
        // luz de borde en las hojas
        g.strokeStyle = gpMezcla("#ffb36b", "#4cc6c9", n, 0.35); g.lineWidth = 1 * u;
        g.beginPath(); g.moveTo(x + 2 * u, base); g.quadraticCurveTo(x + curva * 0.2 + 2 * u, base - alto * 0.6, tope.x + 2 * u, tope.y); g.stroke();
      } else {
        // farol
        const alto = 62 * u;
        g.fillStyle = gpMezcla("#2b1d33", "#040914", n);
        g.fillRect(x - 1.5 * u, base - alto, 3 * u, alto);
        g.fillRect(x - 5 * u, base - 4 * u, 10 * u, 4 * u);
        g.fillRect(x - 6 * u, base - alto - 10 * u, 12 * u, 12 * u);
        const enc = 0.35 + 0.65 * n;
        g.fillStyle = gpMezcla("#ffe0a0", "#ffd277", n, 0.9);
        g.fillRect(x - 4 * u, base - alto - 8 * u, 8 * u, 8 * u);
        g.globalCompositeOperation = "lighter";
        gpGlow(g, "#ffc766", x, base - alto - 4 * u, 46 * u, 0.55 * enc);
        gpGlow(g, "#ffb24a", x, base + 10 * u, 40 * u, 0.25 * enc);
        g.globalCompositeOperation = "source-over";
      }
    }
  }

  /* rayos de luz que bajan entre las palmeras */
  function rayos(n, t, astro) {
    const fuerza = n < 0.6 ? 0.08 * (1 - n / 0.6) : 0.05 * gpSuave(0.6, 1, n);
    if (fuerza <= 0.005) return;
    const ox = n < 0.6 ? astro.solX : W * 0.22, oy = n < 0.6 ? astro.solY : H * 0.1;
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 5; i++) {
      const ang = Math.PI * (0.62 + i * 0.07) + (suave ? Math.sin(t / 3000 + i) * 0.02 : 0);
      const largo = H * 1.4, ancho = 0.035 + (i % 2) * 0.02;
      const gr = g.createLinearGradient(ox, oy, ox + Math.cos(ang) * largo, oy + Math.sin(ang) * largo);
      gr.addColorStop(0, n < 0.6 ? `rgba(255,214,150,${fuerza})` : `rgba(160,220,255,${fuerza})`);
      gr.addColorStop(1, "rgba(255,214,150,0)");
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(ox, oy);
      g.lineTo(ox + Math.cos(ang - ancho) * largo, oy + Math.sin(ang - ancho) * largo);
      g.lineTo(ox + Math.cos(ang + ancho) * largo, oy + Math.sin(ang + ancho) * largo);
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
  }

  /* la pista: piedra del malecón, madera del puente, la largada y la meta */
  function pista(n, carriles) {
    const y0 = sueloY(), alto = (carriles * 7 + 16) * u, top = y0 - alto + 6 * u;
    const desde = Math.floor(camX / PX()) - 2, hasta = Math.ceil((camX + W) / PX()) + 2;
    // tierra y muro bajo la pista
    const tierra = g.createLinearGradient(0, top, 0, H);
    tierra.addColorStop(0, gpMezcla("#6a5470", "#1a2440", n));
    tierra.addColorStop(1, gpMezcla("#2a1a30", "#050914", n));
    g.fillStyle = tierra; g.fillRect(0, top, W, H - top);
    for (let p = desde; p <= hasta; p++) {
      const x = xPista(p) - camX;
      const madera = gpSuperficie(p) === "madera";
      if (madera) {
        g.fillStyle = gpMezcla(p % 2 ? "#9a6a48" : "#8a5c3e", p % 2 ? "#3a2c34" : "#33262f", n);
        g.fillRect(x, top, PX() + 1, alto);
        g.fillStyle = gpMezcla("#5a3424", "#140e16", n, 0.6);
        g.fillRect(x, top, 1.2 * u, alto);
      } else {
        g.fillStyle = gpMezcla("#8c7a8e", "#26304c", n);
        g.fillRect(x, top, PX() + 1, alto);
        // adoquines: cada uno con su tono y un brillo arriba
        const filas = Math.ceil(alto / (7 * u));
        for (let k = 0; k < filas; k++) for (let j = 0; j < 3; j++) {
          const r = gpRuido(p * 31 + k * 7 + j, 51);
          const bx = x + (j + (k % 2) * 0.5 - 0.5) * PX() / 3, by = top + k * 7 * u;
          g.fillStyle = gpMezcla(r > 0.5 ? "#9c8a9a" : "#7c6a80", r > 0.5 ? "#2e3a58" : "#212a44", n);
          g.fillRect(bx + 0.8 * u, by + 0.8 * u, PX() / 3 - 1.6 * u, 5.4 * u);
          g.fillStyle = gpMezcla("#ffd2a0", "#7fd6e8", n, 0.12 + r * 0.1);
          g.fillRect(bx + 0.8 * u, by + 0.8 * u, PX() / 3 - 1.6 * u, 1 * u);
        }
      }
    }
    // arcos bajo el Puente de los Suspiros
    const pa = xPista(GP_PUENTE[0]) - camX, pb = xPista(GP_PUENTE[1]) - camX;
    if (pb > 0 && pa < W) {
      g.fillStyle = gpMezcla("#2c1d34", "#060b18", n);
      g.fillRect(pa, y0 + 6 * u, pb - pa, H - y0);
      const arco = (pb - pa) / 5;
      g.fillStyle = gpMezcla("#d98a6a", "#173d5a", n, 0.8);
      for (let k = 0; k < 5; k++) {
        g.beginPath(); g.ellipse(pa + arco * (k + 0.5), H, arco * 0.38, (H - y0) * 0.75, 0, Math.PI, 0); g.fill();
      }
      // barandas del puente
      g.fillStyle = gpMezcla("#c48a5a", "#4a3a44", n);
      for (const yy of [top - 8 * u, y0 + 2 * u]) {
        g.fillRect(pa, yy, pb - pa, 2.2 * u);
        for (let x = pa; x < pb; x += 9 * u) g.fillRect(x, yy, 1.6 * u, 8 * u);
      }
    }
    // muro de piedra del malecón bajo la pista
    const muroY = y0 + 8 * u;
    for (let fila = 0; muroY + fila * 9 * u < H; fila++) {
      const yy = muroY + fila * 9 * u;
      const desdeX = -((camX * 1) % (22 * u)) - (fila % 2) * 11 * u;
      for (let x = desdeX; x < W; x += 22 * u) {
        const wx = Math.round((x + camX) / (22 * u));
        if (wx * 22 * u >= xPista(GP_PUENTE[0]) && wx * 22 * u < xPista(GP_PUENTE[1])) continue;
        g.fillStyle = gpMezcla(gpRuido(wx + fila * 13, 52) > 0.5 ? "#4a3650" : "#3e2d46", "#0d1426", n, 0.9 - fila * 0.08);
        g.fillRect(x + 0.8 * u, yy + 0.8 * u, 20.4 * u, 7.4 * u);
      }
    }
    // charcos de luz de los faroles sobre la pista
    g.globalCompositeOperation = "lighter";
    const ranura = 120 * u, offF = camX * 0.62;
    for (let i = Math.floor(offF / ranura) - 1; i <= Math.ceil((offF + W) / ranura) + 1; i++) {
      if (gpRuido(i, 22) > 0.4) continue;
      const fx = i * ranura - offF + gpRuido(i, 21) * 30 * u;
      g.save(); g.translate(fx, (top + y0) / 2); g.scale(1, 0.32);
      gpGlow(g, "#ffbe5a", 0, 0, 70 * u, 0.25 + 0.35 * n);
      g.restore();
    }
    g.globalCompositeOperation = "source-over";
    // borde luminoso de la pista
    g.fillStyle = gpMezcla("#ffd9a0", "#6fd6e0", n, 0.35);
    g.fillRect(0, top, W, 1.5 * u);
    // largada
    const xl = xPista(0) - camX;
    if (xl > -40 * u && xl < W + 40 * u) {
      for (let k = 0; k < carriles + 2; k++) for (let j = 0; j < 2; j++) {
        g.fillStyle = (k + j) % 2 ? "#f8f2e4" : "#151a2c";
        g.fillRect(xl + j * 4 * u, top + k * 7 * u, 4 * u, 7 * u);
      }
    }
    return { top, alto };
  }

  function meta(n, t, carriles, pistaInfo) {
    const xm = xPista(PASOS_META) - camX;
    if (xm < -120 * u || xm > W + 160 * u) return;
    const top = pistaInfo.top;
    // franja de cuadros
    for (let k = 0; k < carriles + 2; k++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (k + j) % 2 ? "#fffaf0" : "#121625";
      g.fillRect(xm + j * 5 * u, top + k * 7 * u, 5 * u, 7 * u);
    }
    // arco de la meta
    const alto = 92 * u, y0 = sueloY() + 4 * u;
    g.fillStyle = gpMezcla("#3a2a52", "#0c1430", n);
    g.fillRect(xm - 6 * u, y0 - alto, 5 * u, alto);
    g.fillRect(xm + 60 * u, y0 - alto, 5 * u, alto);
    g.fillStyle = "#d62b1f";
    g.fillRect(xm - 10 * u, y0 - alto - 4 * u, 80 * u, 18 * u);
    g.fillStyle = "#ffd21f";
    g.font = `${12 * u}px "Luckiest Guy", "Bangers", Impact, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("META", xm + 30 * u, y0 - alto + 5.5 * u);
    // guirnalda de luces
    g.globalCompositeOperation = "lighter";
    for (let k = 0; k < 9; k++) {
      const lx = xm - 6 * u + k * 9 * u, ly = y0 - alto + 18 * u + Math.sin(k / 8 * Math.PI) * 7 * u;
      gpGlow(g, ["#ffd25a", "#ff7a7a", "#7ad0ff"][k % 3], lx, ly, 8 * u, 0.8);
    }
    g.globalCompositeOperation = "source-over";
    // Salvador espera en la meta, flotando y brillando
    const sx = xm + 92 * u, sy = sueloY() - 70 * u + (suave ? Math.sin(t / 600) * 4 * u : 0);
    g.globalCompositeOperation = "lighter";
    gpGlow(g, "#ffd98a", sx, sy, 70 * u, 0.55);
    g.globalCompositeOperation = "source-over";
    if (gpLista(gpSalvaImg)) {
      const h = 84 * u, w = h * gpSalvaImg.naturalWidth / gpSalvaImg.naturalHeight;
      g.drawImage(gpSalvaImg, sx - w / 2, sy - h / 2, w, h);
    }
    // globos
    for (let k = 0; k < 5; k++) {
      const bx = xm + 70 * u + k * 13 * u, by = sueloY() - 120 * u - (k % 2) * 10 * u + (suave ? Math.sin(t / 800 + k) * 3 * u : 0);
      g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 0.7 * u;
      g.beginPath(); g.moveTo(bx, by + 8 * u); g.lineTo(xm + 92 * u, sueloY() - 98 * u); g.stroke();
      g.fillStyle = ["#e94a3d", "#ffd21f", "#3f7ee8", "#3fbf7a", "#b56ae8"][k];
      g.beginPath(); g.ellipse(bx, by, 6 * u, 8 * u, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,.45)";
      g.beginPath(); g.ellipse(bx - 2 * u, by - 3 * u, 1.5 * u, 2.4 * u, -0.4, 0, Math.PI * 2); g.fill();
    }
    void n;
  }

  /* obstáculos */
  function obstaculos(n, t, carriles, pistaInfo) {
    for (const o of GP_OBSTACULOS) {
      const x = xPista(o.p) - camX + PX() / 2;
      if (x < -90 * u || x > W + 90 * u) continue;
      const top = pistaInfo.top, y0 = sueloY();
      if (o.tipo === "charco") {
        const gr = g.createLinearGradient(0, top, 0, y0);
        gr.addColorStop(0, gpMezcla("#ffb58a", "#2a6f8f", n, 0.9));
        gr.addColorStop(1, gpMezcla("#6a4a8e", "#0c2a48", n, 0.9));
        g.fillStyle = gr;
        g.beginPath(); g.ellipse(x, (top + y0) / 2 + 3 * u, 20 * u, (y0 - top) / 2 + 2 * u, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 0.8 * u;
        for (let k = 0; k < 3; k++) {
          const r = ((t / 900 + k / 3) % 1) * 14 * u;
          g.globalAlpha = 1 - ((t / 900 + k / 3) % 1);
          g.beginPath(); g.ellipse(x - 4 * u, (top + y0) / 2 + 3 * u, r, r * 0.35, 0, 0, Math.PI * 2); g.stroke();
        }
        g.globalAlpha = 1;
      } else if (o.tipo === "cajas") {
        for (let k = 0; k < carriles; k++) {
          const y = y0 - k * 7 * u, s = 1 - k * 0.05, lado = 14 * u * s;
          for (const [dx, dy] of [[-lado / 2, 0], [lado / 2, 0], [0, -lado]]) {
            const bx = x + dx - lado / 2, by = y + dy - lado;
            g.fillStyle = gpMezcla("#b07a46", "#4a3430", n);
            g.fillRect(bx, by, lado, lado);
            g.strokeStyle = gpMezcla("#6a4428", "#1e1418", n); g.lineWidth = 1.2 * u;
            g.strokeRect(bx, by, lado, lado);
            g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + lado, by + lado); g.moveTo(bx + lado, by); g.lineTo(bx, by + lado); g.stroke();
          }
        }
      } else {
        // la nube de sueño del Doctor Siesta
        g.globalCompositeOperation = "lighter";
        gpGlow(g, "#9b5cff", x, y0 - 20 * u, 60 * u, 0.5);
        g.globalCompositeOperation = "source-over";
        for (let k = 0; k < 9; k++) {
          const cx = x + Math.cos(k * 0.7 + t / 1600) * 18 * u, cy = y0 - 18 * u + Math.sin(k * 1.3 + t / 1300) * 9 * u;
          g.fillStyle = `rgba(${150 + k * 6},${110 + k * 4},235,0.45)`;
          g.beginPath(); g.arc(cx, cy, (12 + (k % 3) * 4) * u, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = "#efe4ff";
        g.font = `${11 * u}px "Bangers", Impact, sans-serif`;
        g.textAlign = "center";
        for (let k = 0; k < 3; k++) {
          const ph = ((t / 1400 + k / 3) % 1);
          g.globalAlpha = 1 - ph;
          g.fillText("Z", x + 10 * u + ph * 16 * u, y0 - 40 * u - ph * 30 * u);
        }
        g.globalAlpha = 1;
        if (gpLista(gpSiestaImg)) {
          const h = 64 * u, flota = suave ? Math.sin(t / 700) * 5 * u : 0;
          g.drawImage(gpSiestaImg, x - h * 0.48, y0 - 140 * u + flota, h * 230 / 240, h);
        }
      }
    }
  }

  /* un héroe corriendo: capa del color de su poder, emblema que brilla */
  function heroe(c, x, y, s, t) {
    const pod = gpPoder(c.poder), col = pod.color;
    const fase = c.fase || 0;
    const fx = c.fx, edad = fx ? t - fx.vista : 1e9;
    let dy = 0, giro = 0;
    if (fx && fx.k === "salto" && edad < 650) dy = -Math.sin(edad / 650 * Math.PI) * 30 * u;
    if (fx && fx.k === "perfecto" && edad < 700) dy = -Math.sin(edad / 700 * Math.PI) * 36 * u;
    if (fx && fx.k === "tropiezo" && edad < GP_ATURDIDO) giro = 0.5 * Math.sin(Math.min(1, edad / 250) * Math.PI / 2);
    const poder = fx && fx.k === "poder" && edad < 1600;
    g.save();
    // sombra
    g.fillStyle = "rgba(0,0,0,.28)";
    g.beginPath(); g.ellipse(x, y + 1 * u, 11 * u * s * (1 + dy / (120 * u)), 2.5 * u * s, 0, 0, Math.PI * 2); g.fill();
    g.translate(x, y + dy); g.scale(s * u, s * u); g.rotate(giro);
    if (poder) {
      g.globalCompositeOperation = "lighter";
      gpGlow(g, col, 0, -22, 46, 0.9 * (1 - edad / 1600));
      g.globalCompositeOperation = "source-over";
    }
    if (c.yo) { g.globalCompositeOperation = "lighter"; gpGlow(g, "#ffe6a0", 0, -20, 30, 0.35); g.globalCompositeOperation = "source-over"; }
    const pierna = (a, frente) => {
      const muslo = a * 0.85, rodilla = Math.max(0, -a) * 1.1 + 0.2;
      const kx = Math.sin(muslo) * 9, ky = Math.cos(muslo) * 9;
      const fx2 = kx + Math.sin(muslo - rodilla) * 9, fy2 = ky + Math.cos(muslo - rodilla) * 9;
      g.strokeStyle = frente ? "#1f2f66" : "#16224a"; g.lineWidth = 3.6; g.lineCap = "round"; g.lineJoin = "round";
      g.beginPath(); g.moveTo(0, -17); g.lineTo(kx, -17 + ky); g.lineTo(fx2, -17 + fy2); g.stroke();
      g.strokeStyle = "#d62b1f"; g.lineWidth = 3.8;
      g.beginPath(); g.moveTo(fx2 - 0.5, -17 + fy2); g.lineTo(fx2 + 2.6, -17 + fy2); g.stroke();
    };
    const brazo = (a, frente) => {
      g.strokeStyle = frente ? "#2a3f86" : "#1a285a"; g.lineWidth = 3; g.lineCap = "round";
      const ex = Math.sin(a) * 6, ey = Math.cos(a) * 6;
      g.beginPath(); g.moveTo(0, -29); g.lineTo(ex, -29 + ey); g.lineTo(ex + Math.sin(a + 1.2) * 6, -29 + ey + Math.cos(a + 1.2) * 6); g.stroke();
    };
    const sa = Math.sin(fase);
    pierna(-sa, false); brazo(sa * 1.1, false);
    // capa
    const ola = Math.sin(t / 120 + (c.semilla || 0)) * 2;
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-2, -31);
    g.quadraticCurveTo(-12, -22 + ola, -20 - Math.abs(sa) * 3, -12 + ola);
    g.lineTo(-10, -14); g.quadraticCurveTo(-6, -20, -1, -18); g.closePath(); g.fill();
    g.fillStyle = "rgba(0,0,0,.18)";
    g.beginPath(); g.moveTo(-4, -28); g.quadraticCurveTo(-12, -19 + ola, -18, -13 + ola); g.lineTo(-10, -14); g.fill();
    // torso
    g.fillStyle = "#2a3f86";
    g.beginPath(); g.moveTo(-5, -32); g.lineTo(5, -32); g.lineTo(4, -17); g.lineTo(-4, -17); g.closePath(); g.fill();
    g.fillStyle = "#ffd21f"; g.fillRect(-4.2, -19.5, 8.4, 2.2);
    g.globalCompositeOperation = "lighter";
    gpGlow(g, col, 0.5, -26, 7, 0.9);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = col; g.beginPath(); g.arc(0.5, -26, 2.4, 0, Math.PI * 2); g.fill();
    pierna(sa, true);
    // cabeza con antifaz
    g.fillStyle = "#f2c9a0"; g.beginPath(); g.arc(1.5, -37, 5.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#3a2418"; g.beginPath(); g.arc(0.5, -39.5, 5.4, Math.PI * 1.05, Math.PI * 1.95); g.fill();
    g.fillStyle = col; g.fillRect(-3.4, -38.6, 10, 2.6);
    g.fillStyle = "#fff"; g.fillRect(3.4, -38.2, 1.6, 1.4);
    brazo(-sa * 1.1, true);
    // estrellitas de tropiezo
    if (fx && fx.k === "tropiezo" && edad < GP_ATURDIDO) {
      g.fillStyle = "#ffe066";
      for (let k = 0; k < 3; k++) { const a = t / 180 + k * 2.1; g.fillRect(Math.cos(a) * 8 - 1, -48 + Math.sin(a) * 3 - 1, 2.4, 2.4); }
    }
    g.restore();
  }

  function etiqueta(c, x, y, s) {
    const texto = c.nombre.length > 14 ? c.nombre.slice(0, 13) + "…" : c.nombre;
    const tam = Math.max(8, 9.5 * u * Math.min(1.1, s));
    g.font = `${tam}px "Bangers", Impact, sans-serif`;
    const w = g.measureText(texto).width + 10 * u;
    const yy = y - 54 * u * s;
    g.fillStyle = c.yo ? "rgba(255,210,31,.95)" : "rgba(8,14,34,.72)";
    const r = 6 * u;
    g.beginPath();
    if (g.roundRect) g.roundRect(x - w / 2, yy - tam * 0.75, w, tam * 1.5, r); else g.rect(x - w / 2, yy - tam * 0.75, w, tam * 1.5);
    g.fill();
    g.fillStyle = c.yo ? "#16130f" : "#fff6dd";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(texto, x, yy + 0.5 * u);
    if (c.puesto && c.puesto <= 3) {
      g.fillStyle = ["#ffd21f", "#dfe6f0", "#e09a5a"][c.puesto - 1];
      g.beginPath(); g.arc(x - w / 2 - 2 * u, yy, 5 * u, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#16130f"; g.font = `${7 * u}px "Bangers", Impact, sans-serif`;
      g.fillText(String(c.puesto), x - w / 2 - 2 * u, yy + 0.5 * u);
    }
  }

  /* partículas: estelas de poder, polvo dorado y luciérnagas */
  function emitir(x, y, color, n, fuerza) {
    if (!suave) return;
    for (let i = 0; i < n; i++) {
      particulas.push({ x, y, vx: -(0.02 + Math.random() * 0.06) * fuerza * u, vy: (-0.04 - Math.random() * 0.05) * u, vida: 1, dur: 500 + Math.random() * 500, color, tam: (1 + Math.random() * 2) * u, mundo: true, wx: x + camX });
    }
    if (particulas.length > 240) particulas.splice(0, particulas.length - 240);
  }
  function luciernagas(n, t) {
    if (!suave) return;
    g.globalCompositeOperation = "lighter";
    const f = 0.85, off = camX * f;
    for (let i = 0; i < 26; i++) {
      const base = gpRuido(i, 31) * W * 3;
      const x = ((base - off) % (W * 3) + W * 3) % (W * 3) - W * 0.5 + Math.sin(t / 1700 + i) * 14 * u;
      const y = H * (0.45 + gpRuido(i, 32) * 0.35) + Math.cos(t / 1300 + i * 2) * 10 * u;
      const a = (0.25 + 0.75 * n) * (0.5 + 0.5 * Math.sin(t / 400 + i * 3));
      gpGlow(g, n > 0.5 ? "#b6ffcf" : "#ffe3a0", x, y, 7 * u, a);
    }
    g.globalCompositeOperation = "source-over";
  }
  function primerPlano(n, t) {
    const f = 1.35, off = camX * f, ranura = 170 * u;
    const i0 = Math.floor(off / ranura) - 1, i1 = Math.ceil((off + W) / ranura) + 1;
    g.fillStyle = gpMezcla("#1a0f22", "#02050c", n, 0.92);
    for (let i = i0; i <= i1; i++) {
      const x = i * ranura - off + gpRuido(i, 41) * 60 * u;
      const alto = (14 + gpRuido(i, 42) * 22) * u;
      // matas de hierba
      g.beginPath(); g.moveTo(x - 30 * u, H);
      for (let k = 0; k <= 8; k++) {
        const bx = x - 30 * u + k * 7.5 * u, mece = suave ? Math.sin(t / 900 + k + i) * 2 * u : 0;
        g.quadraticCurveTo(bx + mece, H - alto * (0.6 + gpRuido(i * 9 + k, 43) * 0.6), bx + 3.7 * u, H);
      }
      g.fill();
      if (opc.modo === "jugador" && gpRuido(i, 44) > 0.72) {
        // ramas de un ficus que asoman desde arriba, con lianas que se mecen
        for (let k = 0; k < 9; k++) {
          const lx = x + k * 12 * u, ly = -6 * u + Math.sin(k * 1.7) * 6 * u + (k > 3 && k < 7 ? 8 * u : 0);
          g.beginPath(); g.arc(lx, ly, (9 + gpRuido(i * 7 + k, 45) * 9) * u, 0, Math.PI * 2); g.fill();
        }
        g.strokeStyle = g.fillStyle; g.lineWidth = 1.4 * u;
        for (let k = 0; k < 3; k++) {
          const vx = x + (20 + k * 30) * u, largo = (30 + gpRuido(i + k, 46) * 40) * u, mece = suave ? Math.sin(t / 1500 + k + i) * 5 * u : 0;
          g.beginPath(); g.moveTo(vx, 6 * u); g.quadraticCurveTo(vx + mece, largo * 0.6, vx + mece * 1.6, largo); g.stroke();
          for (let h = 1; h < 5; h++) { g.beginPath(); g.ellipse(vx + mece * h / 3, largo * h / 5, 3.2 * u, 1.6 * u, 0.6 * (h % 2 ? 1 : -1), 0, Math.PI * 2); g.fill(); }
        }
      }
    }
  }
  function vineta() {
    const gr = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.8);
    gr.addColorStop(0, "rgba(2,5,16,0)");
    gr.addColorStop(1, "rgba(2,5,16,.55)");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  /* cuadro */
  function cuadro(t) {
    if (!vivo) return;
    if (!lienzo.isConnected) { destruir(); return; }
    raf = requestAnimationFrame(cuadro);
    if (!W) { medir(); if (!W) return; }
    const e = opc.estado();
    if (!e) return;
    const dt = Math.min(50, t - (ultimo || t)); ultimo = t;
    const lento = t < camaraLenta ? 0.35 : 1;
    // pasos dibujados: los demás se suavizan; los míos van al instante
    let lider = 0, yoP = null;
    for (const c of e.corredores) {
      const meta = c.llegada ? PASOS_META + 0.15 + ((c.puesto || 1) - 1) % 4 * 0.3 : c.pasos;
      const prev = vista.has(c.id) ? vista.get(c.id) : meta;
      const v = c.yo ? meta : prev + (meta - prev) * Math.min(1, dt / 1000 * 7);
      vista.set(c.id, v);
      c.v = v;
      c.fase = (c.fase || 0);
      if (v > lider) lider = v;
      if (c.yo) yoP = v;
    }
    const foco = opc.modo === "jugador" && yoP !== null ? yoP : lider;
    const n = gpSuave(0.12, 0.95, foco / PASOS_META);
    // cámara
    let objetivo;
    if (opc.modo === "jugador" && yoP !== null) {
      objetivo = (e.miLlegada ? xPista(PASOS_META) + 40 * u : xPista(yoP)) - W * (e.miLlegada ? 0.45 : 0.3);
    } else {
      const xs = e.corredores.map((c) => xPista(c.v));
      const max = Math.max(0, ...xs), prom = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
      objetivo = Math.max(max - W * 0.78, Math.min(max - W * 0.5, prom - W * 0.45));
      if (e.corredores.length && e.corredores.every((c) => c.llegada)) objetivo = xPista(PASOS_META) - W * 0.4;
    }
    if (t < focoMeta) objetivo = xPista(PASOS_META) - W * 0.5;
    objetivo = Math.max(-W * 0.2, objetivo);
    camX = camX === null ? objetivo : camX + (objetivo - camX) * Math.min(1, dt / 1000 * (opc.modo === "jugador" || t < focoMeta ? 9 : 3.2));

    const astro = cielo(n, t);
    mar(n, t, astro);
    acantilados(n);
    casonas(n, t);
    rayos(n, t, astro);
    palmeras(n, t);
    const carriles = opc.modo === "jugador" ? 6 : Math.max(3, Math.min(8, e.corredores.length));
    const pistaInfo = pista(n, carriles);
    obstaculos(n, t, carriles, pistaInfo);
    meta(n, t, carriles, pistaInfo);

    // corredores, del fondo hacia adelante
    const orden = e.corredores.slice().sort((a, b) => b.carril - a.carril);
    for (const c of orden) {
      const x = xPista(c.v) - camX + PX() / 2;
      const y = sueloY() - c.carril * 7 * u;
      const s = (1 - c.carril * 0.05) * (opc.modo === "tv" ? 1.3 : 1.08);
      const ant = huellas.get(c.id) || 0;
      if (c.v > ant + 0.5) {
        huellas.set(c.id, c.v);
        if (e.activa && (c.yo || Math.random() < 0.5)) emitir(x - 12 * u * s, y - 22 * u * s, gpPoder(c.poder).color, 1, 1);
      }
      c.fase = c.v * Math.PI;
      if (x < -60 * u || x > W + 60 * u) continue;
      if (!c.yo && opc.modo === "jugador") g.globalAlpha = 0.9;
      heroe(c, x, y, s, t);
      g.globalAlpha = 1;
      if (!c.llegada || c.yo || (c.puesto && c.puesto <= 3)) etiqueta(c, x, y, s);
    }

    // partículas
    g.globalCompositeOperation = "lighter";
    for (const p of particulas) {
      p.vida -= dt * lento / p.dur;
      p.wx += p.vx * dt * lento * 10; p.y += p.vy * dt * lento * 10;
      const x = p.wx - camX;
      gpGlow(g, p.color, x, p.y, p.tam * 2.6, Math.max(0, p.vida) * 0.45);
    }
    particulas = particulas.filter((p) => p.vida > 0);
    g.globalCompositeOperation = "source-over";
    luciernagas(n, t);
    primerPlano(n, t);
    vineta();
    if (destello > 0) {
      g.fillStyle = `rgba(255,250,235,${destello})`;
      g.fillRect(0, 0, W, H);
      destello = Math.max(0, destello - dt / 600);
    }
  }
  raf = requestAnimationFrame(cuadro);
  function destruir() { vivo = false; cancelAnimationFrame(raf); if (obs) obs.disconnect(); }
  return {
    destruir,
    destellar(fuerza) { destello = Math.max(destello, fuerza || 0.8); },
    lento(ms) { camaraLenta = performance.now() + ms; },
    enfocarMeta(ms) { focoMeta = performance.now() + ms; },
    estallido(id, color) {
      const v = vista.get(id);
      if (v === undefined || camX === null) return;
      for (let i = 0; i < 18; i++) emitir(xPista(v) - camX + PX() / 2, sueloY() - (14 + Math.random() * 30) * u, color, 1, 2 + Math.random() * 4);
    },
    foto() { try { return lienzo.toDataURL("image/jpeg", 0.82); } catch (e) { return ""; } },
  };
}

/* ---------- música de la transmisión (solo en el centro de mando) ---------- */
// Am - F - C - G a 112 pulsos por minuto. Las capas entran a medida que avanza la carrera.
function crearMusicaCarrera() {
  const ACORDES = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
  const BAJO = [110, 87.31, 130.81, 98];
  const beat = 60000 / GP_BPM;
  let ultimo = -1;
  return {
    tic(inicio, ahora, progreso, terminada) {
      if (!Sonido.activo || !Sonido.listo) return;
      const hasta = Math.floor((ahora + 350 - inicio) / beat);
      if (ultimo < 0) ultimo = Math.max(-8, Math.floor((ahora - inicio) / beat));
      for (let b = ultimo + 1; b <= hasta; b++) {
        const en = Math.max(0, (inicio + b * beat - ahora) / 1000);
        const acorde = ((Math.floor(b / 4) % 4) + 4) % 4, enCompas = ((b % 4) + 4) % 4;
        if (terminada && b > 0) continue;
        if (enCompas === 0) ACORDES[acorde].forEach((f) => Sonido.nota(f, en, beat * 4 / 1000, "sine", 0.018));
        if (b < 0) continue;
        if (enCompas === 0 || enCompas === 2) Sonido.nota(BAJO[acorde], en, beat / 1000 * 0.9, "triangle", 0.07);
        if (progreso > 0.15) {
          const notas = ACORDES[acorde];
          Sonido.nota(notas[(b * 2) % 3] * 2, en, 0.22, "triangle", 0.022);
          Sonido.nota(notas[(b * 2 + 1) % 3] * 2, en + beat / 2000, 0.22, "triangle", 0.018);
        }
        if (progreso > 0.45) {
          Sonido.nota(62, en, 0.16, "sine", 0.12, 38);
          Sonido.ruido(en + beat / 2000, 0.05, 0.035, 7000);
        }
        if (progreso > 0.75 && enCompas % 2 === 1) Sonido.ruido(en, 0.09, 0.07, 1800);
      }
      ultimo = Math.max(ultimo, hasta);
    },
  };
}

/* ---------- datos de la carrera ---------- */
function gpCorredores(ctx, local) {
  const s = ctx.m.sub, pasos = (ctx.mj && ctx.mj.pasos) || {}, llegada = (ctx.mj && ctx.mj.llegada) || {}, fx = (ctx.mj && ctx.mj.fx) || {};
  const lista = TIPOS.carrera.progreso(ctx, local);
  const puestos = new Map(lista.map((c, i) => [c.id, i + 1]));
  const ids = s.corredores.filter((id) => ctx.S.agentes[id]);
  const otros = ids.filter((id) => id !== ctx.yo);
  return ids.map((id) => {
    const yo = id === ctx.yo && local;
    const i = otros.indexOf(id);
    const carril = local ? (yo ? 0 : 1 + (i % 5)) : (ids.indexOf(id) % 8);
    const f = fx[id];
    return {
      id, yo: !!yo, nombre: nombreDe(ctx.S, id), poder: poderDeAgente(ctx.S, id), carril, semilla: hash(id) % 100,
      pasos: yo ? local.pasos : llegada[id] ? PASOS_META : Number(pasos[id]) || 0,
      llegada: yo ? local.llego : Number(llegada[id]) || 0,
      fx: yo ? local.fx : f && f.t ? { k: f.k, vista: performance.now() - clamp(ctx.ahora() - f.t, 0, 5000) } : null,
      puesto: puestos.get(id) || 0,
    };
  });
}

/* ---------- el tipo de misión ---------- */
function tipoCarrera() {
  return {
    id: "carrera", nombre: "Gran Premio de Barranco", icono: "bandera", cat: "celular", usaSala: true,
    resumen: "Una carrera por el malecón de Barranco: alterna los pies, salta los obstáculos y usa tu poder.",
    ayuda: "Toca IZQ y DER alternando para correr. Cuando llegues a un obstáculo, toca ¡SALTA! justo cuando el anillo se cierra. Tu poder te da un impulso una vez por carrera. Salvador te espera en la meta.",
    campos: [],
    empezar(ctx) {
      const corredores = listosDe(ctx);
      if (!corredores.length) { avisar("Primero tiene que haber agentes listos."); return false; }
      const inicio = ctx.ahora() + 5200;
      ctx.T.actualizar("mision", { fase: "juego", sub: { inicio, limite: inicio + 120000, corredores } });
      return true;
    },
    progreso(ctx, local) {
      const s = ctx.m.sub, pasos = (ctx.mj && ctx.mj.pasos) || {}, llegada = (ctx.mj && ctx.mj.llegada) || {};
      return s.corredores.filter((id) => ctx.S.agentes[id]).map((id) => {
        const mio = local && id === ctx.yo;
        const ll = mio ? local.llego || 0 : Number(llegada[id]) || 0;
        return { id, pasos: ll ? PASOS_META : mio ? local.pasos || 0 : Number(pasos[id]) || 0, llegada: ll };
      }).sort((a, b) => (a.llegada && b.llegada ? a.llegada - b.llegada : a.llegada ? -1 : b.llegada ? 1 : b.pasos - a.pasos));
    },
    cerrar(ctx) {
      const entradas = this.progreso(ctx).map((c) => ({ id: c.id, v: c.llegada ? c.llegada : 1e9 - c.pasos, llegada: c.llegada, pasos: c.pasos }));
      const l = rankear(entradas, true, 1);
      const mejor = Math.min(...l.filter((e) => e.llegada).map((e) => e.llegada), Infinity);
      l.forEach((e) => { e.pts = e.llegada ? Math.round(10 + 90 * mejor / e.llegada) : Math.round(10 + 40 * e.pasos / PASOS_META); });
      ctx.premiar(l.map((e) => ({ id: e.id, pos: e.pos, pts: e.pts, txt: e.llegada ? `${(e.llegada / 1000).toFixed(1).replace(".", ",")} s` : `${e.pasos} de ${PASOS_META} pasos` })));
    },
    host: {
      clave() { return "carrera"; },
      html() {
        return `<section class="gp gp-tv"><div class="gp-escenario"><canvas class="gp-lienzo" aria-label="Transmisión en vivo de la carrera"></canvas>` +
          `<div class="gp-hud"><span class="gp-envivo">EN VIVO</span><span class="gp-zona" data-gp-zona>Malecón de Barranco</span><span class="gp-reloj" data-gp-reloj>0:00</span></div>` +
          `<div class="gp-mapa" data-gp-mapa aria-hidden="true"></div>` +
          `<div class="gp-cartel" data-gp-cartel aria-live="polite"></div>` +
          `<div class="gp-relato" data-gp-relato aria-live="polite"></div>` +
          `<ol class="gp-tabla" data-gp-tabla></ol><div class="gp-foto" data-gp-foto hidden></div></div></section>` +
          `<section class="pagina"><span class="cap" data-vivo="estado">En sus marcas</span><p class="suave">Conecta esta pantalla a la tele o al proyector: la música de la carrera sale de aquí.</p>` +
          `<button class="boton blanco" data-accion="cerrar-ya">Terminar y dar puntos</button></section>`;
      },
      actualizar(ctx, raiz) {
        const s = ctx.m.sub, ahora = ctx.ahora(), L = ctx.local;
        L.ctx = ctx;
        const e = $('[data-vivo="estado"]', raiz);
        if (e) e.textContent = ahora < s.inicio ? `Arranca en ${Math.ceil((s.inicio - ahora) / 1000)}` : `Carrera · ${reloj(ahora - s.inicio)}`;
        const lienzo = $(".gp-lienzo", raiz);
        if (lienzo && L.lienzo !== lienzo) {
          if (L.mundo) L.mundo.destruir();
          L.lienzo = lienzo;
          L.musica = crearMusicaCarrera();
          L.mundo = crearMundoCarrera(lienzo, { modo: "tv", estado: () => gpEstadoTV(L) });
        }
        gpHudTV(ctx, raiz, L);
      },
      click(accion, el, ctx) { if (accion === "cerrar-ya") ctx.cerrarMision(); },
      tic(ctx) {
        const s = ctx.m.sub, ahora = ctx.ahora();
        const lista = TIPOS.carrera.progreso(ctx);
        if (ahora > s.limite || (lista.length && lista.every((c) => c.llegada) && ahora - Math.max(...lista.map((c) => s.inicio + c.llegada)) > 6000)) ctx.cerrarMision();
      },
    },
    jugador: {
      clave(ctx) { return ctx.m.sub.corredores.includes(ctx.yo) ? "corre" : "mira"; },
      html(ctx) {
        const corre = ctx.m.sub.corredores.includes(ctx.yo);
        const pod = gpPoder(poderDeAgente(ctx.S, ctx.yo));
        return `<section class="gp gp-jugador" data-gp><div class="gp-escenario"><canvas class="gp-lienzo" aria-hidden="true"></canvas>` +
          `<div class="gp-hud"><span class="gp-puesto" data-gp-puesto>—</span><span class="gp-zona" data-gp-zona>Malecón de Barranco</span><span class="gp-pasos" data-gp-pasos>0/${PASOS_META}</span></div>` +
          `<div class="gp-mapa" data-gp-mapa aria-hidden="true"></div>` +
          `<div class="gp-cartel" data-gp-cartel aria-live="polite"></div>` +
          (corre ? `<p class="gp-aviso-obstaculo" data-gp-obstaculo hidden></p>` : "") +
          `</div>` +
          (corre ? `<div class="gp-controles"><div class="gp-salto" data-gp-salto hidden><button class="gp-boton-salto" data-gp-saltar><i class="gp-anillo" data-gp-anillo></i><i class="gp-blanco"></i><span>¡SALTA!</span></button></div><button class="gp-pie" data-pie="0" disabled><span class="gp-huella"></span>IZQ</button>` +
            `<button class="gp-poder" data-gp-poder disabled style="--gp-color:${pod.color}">${icono(poderDeAgente(ctx.S, ctx.yo))}<b>${esc(pod.nombre)}</b><small>Una vez</small></button>` +
            `<button class="gp-pie" data-pie="1" disabled><span class="gp-huella"></span>DER</button></div>`
            : `<p class="centro gp-mira">Esta carrera empezó sin ti. ¡Mira la transmisión!</p>`) +
          `</section>`;
      },
      actualizar(ctx, raiz) { gpActualizarJugador(ctx, raiz); },
      salir(ctx) { const L = ctx.local; if (L.mundo) { L.mundo.destruir(); L.mundo = null; L.lienzo = null; } },
    },
  };
}

/* ---------- centro de mando: la transmisión ---------- */
function gpEstadoTV(L) {
  const ctx = L.ctx;
  if (!ctx || !ctx.m || ctx.m.tipo !== "carrera" || !ctx.m.sub) return null;
  const s = ctx.m.sub, ahora = ctx.ahora();
  const corredores = gpCorredores(ctx, null);
  const terminada = corredores.length && corredores.every((c) => c.llegada);
  const lider = Math.max(0, ...corredores.map((c) => c.pasos));
  if (L.musica) L.musica.tic(s.inicio, ahora, lider / PASOS_META, terminada);
  return { corredores, activa: ahora >= s.inicio };
}
function gpHudTV(ctx, raiz, L) {
  const s = ctx.m.sub, ahora = ctx.ahora();
  const lista = TIPOS.carrera.progreso(ctx);
  const lider = lista[0];
  const zona = $("[data-gp-zona]", raiz);
  if (zona) { const z = lider ? gpZona(lider.pasos) : "Malecón de Barranco"; if (zona.textContent !== z) zona.textContent = z; }
  const r = $("[data-gp-reloj]", raiz);
  if (r) r.textContent = ahora < s.inicio ? "0:00" : reloj(Math.min(ahora, s.limite) - s.inicio);
  gpCuentaRegresiva(ctx, raiz, L, s.inicio, ahora);
  gpMapa(ctx, raiz, lista, null);
  const tabla = $("[data-gp-tabla]", raiz);
  if (tabla) {
    const h = lista.slice(0, 5).map((c, i) => `<li><b>${i + 1}</b>${poderHTML(poderDeAgente(ctx.S, c.id))}<span>${esc(nombreDe(ctx.S, c.id))}</span><small>${c.llegada ? `${(c.llegada / 1000).toFixed(1).replace(".", ",")} s` : `${Math.round(c.pasos / PASOS_META * 100)}%`}</small></li>`).join("");
    if (tabla.dataset.h !== h) { tabla.dataset.h = h; tabla.innerHTML = h; }
  }
  // Relato: adelantamientos, poderes, saltos perfectos y llegadas.
  const relato = [];
  const orden = lista.map((c) => c.id);
  if (L.orden && ahora > s.inicio + 2500) {
    for (let i = 0; i < Math.min(3, orden.length); i++) {
      const id = orden[i], antes = L.orden.indexOf(id);
      if (antes > i && !lista[i].llegada) {
        const pasado = L.orden[i];
        if (pasado && pasado !== id) relato.push(i === 0 ? `¡${nombreDe(ctx.S, id)} toma la punta!` : `¡${nombreDe(ctx.S, id)} adelanta a ${nombreDe(ctx.S, pasado)}!`);
        break;
      }
    }
  }
  L.orden = orden;
  const fx = (ctx.mj && ctx.mj.fx) || {};
  L.fxVistos = L.fxVistos || {};
  for (const [id, f] of Object.entries(fx)) {
    if (!f || !f.t || L.fxVistos[id] === f.t || ahora - f.t > 4000) continue;
    L.fxVistos[id] = f.t;
    const quien = nombreDe(ctx.S, id);
    if (f.k === "poder") { relato.push(`${quien}: ${gpPoder(poderDeAgente(ctx.S, id)).grito}`); if (L.mundo) L.mundo.estallido(id, gpPoder(poderDeAgente(ctx.S, id)).color); Sonido.tocar("poderGP"); }
    if (f.k === "perfecto") relato.push(`¡Salto perfecto de ${quien}!`);
    if (f.k === "tropiezo" && f.o === 2) relato.push(`¡${quien} se durmió en la nube del Doctor Siesta!`);
  }
  const llegadas = lista.filter((c) => c.llegada);
  L.llegadas = L.llegadas || 0;
  if (llegadas.length > L.llegadas) {
    const nueva = llegadas[llegadas.length - 1];
    relato.push(llegadas.length === 1 ? `¡${nombreDe(ctx.S, nueva.id)} GANA EL GRAN PREMIO!` : `${nombreDe(ctx.S, nueva.id)} llega en el puesto ${llegadas.length}`);
    if (L.llegadas === 0 && llegadas.length >= 1 && L.mundo) {
      L.mundo.enfocarMeta(2600);
      L.mundo.lento(1200);
      Sonido.tocar("fanfarria");
      const foto = $("[data-gp-foto]", raiz);
      setTimeout(() => { if (L.mundo) L.mundo.destellar(0.9); }, 760);
      setTimeout(() => {
        const src = L.mundo && L.mundo.foto();
        if (foto && src) { foto.innerHTML = `<figure><img src="${src}" alt="Foto de llegada"><figcaption>FOTO DE LLEGADA · ${esc(nombreDe(ctx.S, lista[0].id))}</figcaption></figure>`; foto.hidden = false; }
      }, 650);
    }
    L.llegadas = llegadas.length;
  }
  if (relato.length) gpRelatar(raiz, relato[relato.length - 1]);
}
function gpRelatar(raiz, texto) {
  const el = $("[data-gp-relato]", raiz);
  if (!el) return;
  const p = document.createElement("p");
  p.textContent = texto;
  el.prepend(p);
  while (el.children.length > 3) el.lastChild.remove();
  setTimeout(() => p.classList.add("viejo"), 3500);
}
function gpMapa(ctx, raiz, lista, yo) {
  const mapa = $("[data-gp-mapa]", raiz);
  if (!mapa) return;
  if (!mapa.dataset.listo) {
    mapa.dataset.listo = "1";
    mapa.innerHTML = `<i class="gp-mapa-puente" style="left:${GP_PUENTE[0] / PASOS_META * 100}%;width:${(GP_PUENTE[1] - GP_PUENTE[0]) / PASOS_META * 100}%"></i>` +
      GP_OBSTACULOS.map((o) => `<i class="gp-mapa-obs ${o.tipo}" style="left:${o.p / PASOS_META * 100}%"></i>`).join("") + `<i class="gp-mapa-meta"></i>`;
  }
  const vistos = new Set();
  for (const c of lista) {
    vistos.add(c.id);
    let punto = mapa.querySelector(`[data-id="${CSS.escape(c.id)}"]`);
    if (!punto) {
      punto = document.createElement("b");
      punto.dataset.id = c.id;
      punto.style.setProperty("--gp-color", gpPoder(poderDeAgente(ctx.S, c.id)).color);
      if (c.id === yo) punto.className = "yo";
      mapa.appendChild(punto);
    }
    punto.style.left = `${Math.min(100, c.pasos / PASOS_META * 100)}%`;
  }
  for (const b of mapa.querySelectorAll("b[data-id]")) if (!vistos.has(b.dataset.id)) b.remove();
}
function gpCuentaRegresiva(ctx, raiz, L, inicio, ahora) {
  const cartel = $("[data-gp-cartel]", raiz);
  if (!cartel) return;
  const falta = inicio - ahora;
  let texto = "";
  if (falta > 3000) texto = "EN SUS MARCAS";
  else if (falta > 0) texto = String(Math.ceil(falta / 1000));
  else if (falta > -900) texto = "¡YA!";
  if (texto && L.cuenta !== texto) {
    L.cuenta = texto;
    Sonido.tocar(texto === "¡YA!" ? "inicio" : /^\d$/.test(texto) ? "cuenta" : "tic", texto === "1" ? 1 : 2);
  }
  gpCartel(cartel, texto, texto && !/^\d|¡YA/.test(texto) ? "chico" : "");
}
function gpCartel(cartel, texto, clase) {
  if (cartel.dataset.t === texto) return;
  cartel.dataset.t = texto;
  cartel.className = "gp-cartel" + (clase ? " " + clase : "");
  cartel.innerHTML = texto ? `<span>${esc(texto)}</span>` : "";
}

/* ---------- celular del corredor ---------- */
function gpActualizarJugador(ctx, raiz) {
  const s = ctx.m.sub, ahora = ctx.ahora(), L = ctx.local;
  L.ctx = ctx;
  if (L.pasos === undefined) { L.pasos = 0; L.ultimo = 1; L.saltados = {}; L.llego = 0; L.fx = null; }
  const corre = s.corredores.includes(ctx.yo);
  const sec = $("[data-gp]", raiz);
  if (!sec) return;
  const lienzo = $(".gp-lienzo", sec);
  if (lienzo && L.lienzo !== lienzo) {
    if (L.mundo) L.mundo.destruir();
    L.lienzo = lienzo;
    L.mundo = crearMundoCarrera(lienzo, { modo: corre ? "jugador" : "tv", estado: () => gpEstadoJugador(L) });
  }
  const llegada = ((ctx.mj && ctx.mj.llegada) || {})[ctx.yo];
  if (llegada && !L.llego) { L.llego = llegada; L.pasos = PASOS_META; }
  const activa = corre && ahora >= s.inicio && ahora < s.limite && !L.llego;
  if (activa && !L.arranque) L.arranque = performance.now() - (ahora - s.inicio);
  if (!L.arranque && !L.cuentaFin) gpCuentaRegresiva(ctx, sec, L, s.inicio, ahora);
  else if (L.cuenta !== "") { gpCuentaRegresiva(ctx, sec, L, s.inicio, ahora); if (ahora - s.inicio > 900) { L.cuenta = ""; L.cuentaFin = true; } }
  const lista = TIPOS.carrera.progreso(ctx, corre ? L : null);
  gpMapa(ctx, sec, lista, ctx.yo);
  const puesto = $("[data-gp-puesto]", sec);
  if (puesto && corre) { const i = lista.findIndex((c) => c.id === ctx.yo); const t = `${i + 1}/${lista.length}`; if (puesto.textContent !== t) puesto.textContent = t; }
  const zona = $("[data-gp-zona]", sec);
  if (zona) { const z = gpZona(corre ? L.pasos : (lista[0] || {}).pasos || 0); if (zona.textContent !== z) zona.textContent = z; }
  const cuenta = $("[data-gp-pasos]", sec);
  if (cuenta) cuenta.textContent = corre ? `${Math.min(PASOS_META, Math.floor(L.pasos))}/${PASOS_META}` : "";
  if (!corre) return;
  const bloqueado = !activa || !!L.obstaculo || !!L.aturdido || !!L.impulso;
  $$(".gp-pie", sec).forEach((b) => { if (b.disabled !== bloqueado) b.disabled = bloqueado; });
  const poder = $("[data-gp-poder]", sec);
  if (poder) {
    const usable = activa && !L.poderUsado && L.pasos >= GP_PODER_DESDE && !L.aturdido;
    if (poder.disabled === usable) poder.disabled = !usable;
    poder.classList.toggle("usado", !!L.poderUsado);
    poder.classList.toggle("listo", usable);
  }
  if (L.llego && !L.mostroLlegada) {
    L.mostroLlegada = true;
    const pos = lista.findIndex((c) => c.id === ctx.yo) + 1;
    gpCartel($("[data-gp-cartel]", sec), `${pos === 1 ? "¡GANASTE!" : `¡LLEGASTE! Puesto ${pos}`} · ${(L.llego / 1000).toFixed(1).replace(".", ",")} s`, "meta");
  }
  if (!sec.dataset.enlazado) {
    sec.dataset.enlazado = "1";
    sec.addEventListener("pointerdown", (ev) => gpToque(ev, ctx.fresco ? () => ctx.fresco() : () => ctx, sec));
  }
}
function gpEstadoJugador(L) {
  const ctx = L.ctx;
  if (!ctx || !ctx.m || ctx.m.tipo !== "carrera" || !ctx.m.sub) return null;
  const ahora = ctx.ahora(), s = ctx.m.sub;
  gpAvanzarImpulso(L, ctx);
  gpAnillo(L);
  return { corredores: gpCorredores(ctx, s.corredores.includes(ctx.yo) ? L : null), activa: ahora >= s.inicio, miLlegada: L.llego };
}
function gpMarcarFx(L, ctx, k, extra) {
  const t = ctx.ahora();
  L.fx = { k, vista: performance.now() };
  ctx.T.escribir(`mj/${ctx.m.id}/fx/${ctx.yo}`, Object.assign({ k, t }, extra || {}));
}
function gpEnviarPasos(L, ctx) {
  if (L.enviando || L.llego) return;
  L.enviando = true;
  const id = ctx.m.id;
  setTimeout(() => { L.enviando = false; if (!L.llego && ctx.m && ctx.m.id === id) ctx.T.escribir(`mj/${id}/pasos/${ctx.yo}`, Math.floor(L.pasos)); }, 220);
}
// Avanza un paso (o varios) y se detiene en el siguiente obstáculo sin saltar.
function gpAvanzar(L, ctx, cuanto, tiempo, atraviesa) {
  let p = L.pasos + cuanto;
  for (let i = 0; i < GP_OBSTACULOS.length; i++) {
    const o = GP_OBSTACULOS[i];
    if (L.saltados[i] || L.pasos > o.p || p < o.p) continue;
    if (atraviesa) { L.saltados[i] = "poder"; continue; }
    p = o.p;
    L.obstaculo = { i, desde: performance.now() };
    break;
  }
  L.pasos = Math.min(PASOS_META, p);
  if (L.pasos >= PASOS_META && !L.llego) {
    L.llego = Math.max(1, Math.round(tiempo - L.arranque));
    L.obstaculo = null;
    ctx.T.escribir(`mj/${ctx.m.id}/llegada/${ctx.yo}`, L.llego);
    ctx.T.escribir(`mj/${ctx.m.id}/pasos/${ctx.yo}`, PASOS_META);
    vibrar([40, 60, 40, 60, 120]);
    Sonido.tocar("metaGP");
    if (L.mundo) { L.mundo.destellar(0.85); L.mundo.lento(1100); }
    return;
  }
  gpEnviarPasos(L, ctx);
}
function gpAvanzarImpulso(L, ctx) {
  const imp = L.impulso;
  if (!imp) return;
  const ahora = performance.now(), k = clamp((ahora - imp.desde) / 900, 0, 1);
  const objetivo = imp.base + GP_IMPULSO * (1 - Math.pow(1 - k, 2));
  if (objetivo > L.pasos) gpAvanzar(L, ctx, objetivo - L.pasos, ahora, true);
  if (k >= 1 || L.llego) L.impulso = null;
}
function gpAnillo(L) {
  const sec = L.lienzo && L.lienzo.closest("[data-gp]");
  if (!sec) return;
  const caja = $("[data-gp-salto]", sec);
  if (!caja) return;
  const o = L.obstaculo;
  const aviso = $("[data-gp-obstaculo]", sec);
  if (!o) { if (!caja.hidden) { caja.hidden = true; if (aviso) aviso.hidden = true; } return; }
  if (caja.hidden) {
    caja.hidden = false;
    const ob = GP_OBSTACULOS[o.i];
    if (aviso) { aviso.hidden = false; aviso.textContent = `¡${ob.nombre.charAt(0).toUpperCase() + ob.nombre.slice(1)}! Toca ¡SALTA! cuando el anillo se cierre`; }
    Sonido.tocar("alertaGP");
    vibrar(60);
  }
  const fase = ((performance.now() - o.desde) % GP_CICLO_SALTO) / GP_CICLO_SALTO;
  const anillo = $("[data-gp-anillo]", caja);
  if (anillo) anillo.style.transform = `scale(${(2.3 - 1.3 * fase).toFixed(3)})`;
  // Si no salta en 3,5 s, tropieza solo y sigue.
  if (performance.now() - o.desde > 3500 && L.ctx) gpSaltar(L, L.ctx, 1);
}
function gpSaltar(L, ctx, forzar) {
  const o = L.obstaculo;
  if (!o) return;
  const fase = ((performance.now() - o.desde) % GP_CICLO_SALTO) / GP_CICLO_SALTO;
  const lejos = Math.min(1 - fase, fase) * GP_CICLO_SALTO;
  L.obstaculo = null;
  L.saltados[o.i] = true;
  const sec = L.lienzo && L.lienzo.closest("[data-gp]");
  const cartel = sec && $("[data-gp-cartel]", sec);
  if (!forzar && lejos < 120) {
    gpMarcarFx(L, ctx, "perfecto", { o: o.i });
    Sonido.tocar("perfectoGP");
    vibrar([20, 30, 20]);
    if (cartel) { gpCartel(cartel, "¡PERFECTO!", "perfecto"); setTimeout(() => gpCartel(cartel, ""), 800); }
    gpAvanzar(L, ctx, 3, performance.now());
  } else if (!forzar && lejos < 280) {
    gpMarcarFx(L, ctx, "salto", { o: o.i });
    Sonido.tocar("saltoGP");
    vibrar(25);
    if (cartel) { gpCartel(cartel, "¡BIEN!", "bien"); setTimeout(() => gpCartel(cartel, ""), 650); }
    gpAvanzar(L, ctx, 1, performance.now());
  } else {
    gpMarcarFx(L, ctx, "tropiezo", { o: o.i });
    Sonido.tocar("tropiezoGP");
    vibrar(160);
    if (cartel) gpCartel(cartel, o.i === 2 ? "¡ZZZ…! ¡DESPIERTA!" : "¡UY!", "uy");
    L.aturdido = true;
    setTimeout(() => {
      L.aturdido = false;
      if (cartel) gpCartel(cartel, "");
      if (L.ctx && !L.llego) gpAvanzar(L, L.ctx, 1, performance.now());
    }, GP_ATURDIDO);
  }
}
function gpToque(ev, fresco, sec) {
  const ctx = fresco();
  if (!ctx || !ctx.m || ctx.m.tipo !== "carrera") return;
  const L = ctx.local, s = ctx.m.sub;
  const ahora = ctx.ahora();
  if (!s.corredores.includes(ctx.yo) || ahora < s.inicio || L.llego) return;
  if (ev.target.closest("[data-gp-saltar]")) { ev.preventDefault(); if (L.obstaculo) gpSaltar(L, ctx); return; }
  const poder = ev.target.closest("[data-gp-poder]");
  if (poder) {
    ev.preventDefault();
    if (poder.disabled || L.poderUsado || L.aturdido) return;
    L.poderUsado = true;
    L.obstaculo = null;
    L.impulso = { desde: performance.now(), base: L.pasos };
    gpMarcarFx(L, ctx, "poder");
    const pod = gpPoder(poderDeAgente(ctx.S, ctx.yo));
    gpCartel($("[data-gp-cartel]", sec), pod.grito, "impulso");
    setTimeout(() => gpCartel($("[data-gp-cartel]", sec), ""), 1200);
    Sonido.tocar("poderGP");
    vibrar([30, 20, 60]);
    if (L.mundo) L.mundo.estallido(ctx.yo, pod.color);
    return;
  }
  const b = ev.target.closest(".gp-pie");
  if (!b || b.disabled) return;
  ev.preventDefault();
  const lado = Number(b.dataset.pie);
  b.classList.add("toca");
  setTimeout(() => b.classList.remove("toca"), 70);
  if (lado === L.ultimo) return;
  L.ultimo = lado;
  Sonido.tocar("pasoGP", gpSuperficie(L.pasos));
  gpAvanzar(L, ctx, 1, tiempoEvento(ev));
}

/* ---------- práctica: alternar y saltar ---------- */
function practicaCarrera(el) {
  const META = 24, OBST = 12;
  el.innerHTML = `<div class="medidor"><i></i><b>0 de ${META} pasos</b></div>` +
    `<div class="gp-practica-salto" hidden><button class="gp-boton-salto" data-p-saltar><i class="gp-anillo"></i><i class="gp-blanco"></i><span>¡SALTA!</span></button></div>` +
    `<div class="pies mini"><button class="pie" data-p-pie="0">IZQ</button><button class="pie" data-p-pie="1">DER</button></div>`;
  const barra = $(".medidor i", el), rotulo = $(".medidor b", el), caja = $(".gp-practica-salto", el), anillo = $(".gp-anillo", el);
  let pasos = 0, ultimo = 1, pausa = false, vuelta = 0, salto = 0, raf = 0;
  function animar() {
    if (!salto) return;
    const fase = ((performance.now() - salto) % GP_CICLO_SALTO) / GP_CICLO_SALTO;
    anillo.style.transform = `scale(${(2.3 - 1.3 * fase).toFixed(3)})`;
    raf = requestAnimationFrame(animar);
  }
  function toque(e) {
    if (pausa) return;
    if (e.target.closest("[data-p-saltar]")) {
      e.preventDefault();
      const fase = ((performance.now() - salto) % GP_CICLO_SALTO) / GP_CICLO_SALTO, lejos = Math.min(fase, 1 - fase) * GP_CICLO_SALTO;
      rotulo.textContent = lejos < 120 ? "¡PERFECTO! Así se salta" : lejos < 280 ? "¡Bien! Casi perfecto" : "¡Uy! Toca justo cuando el anillo toca el círculo";
      Sonido.tocar(lejos < 120 ? "perfectoGP" : lejos < 280 ? "saltoGP" : "tropiezoGP");
      salto = 0; cancelAnimationFrame(raf); caja.hidden = true;
      pasos++;
      return;
    }
    const b = e.target.closest("[data-p-pie]");
    if (!b || salto) return;
    e.preventDefault();
    const lado = Number(b.dataset.pPie);
    b.classList.add("toca");
    setTimeout(() => b.classList.remove("toca"), 70);
    if (lado === ultimo) { rotulo.textContent = "¡Alterna! Izquierdo, derecho…"; return; }
    ultimo = lado;
    pasos++;
    Sonido.tocar("pasoGP", "piedra");
    barra.style.width = (pasos / META) * 100 + "%";
    rotulo.textContent = `${pasos} de ${META} pasos`;
    if (pasos === OBST) { salto = performance.now(); caja.hidden = false; rotulo.textContent = "¡Un charco! Toca ¡SALTA! cuando el anillo se cierre"; animar(); }
    if (pasos >= META) {
      pausa = true;
      rotulo.textContent = `¡Así se corre! En la carrera son ${PASOS_META} pasos y 3 obstáculos`;
      Sonido.tocar("exito");
      vuelta = setTimeout(() => { pasos = 0; ultimo = 1; pausa = false; barra.style.width = "0"; rotulo.textContent = `0 de ${META} pasos`; }, 2600);
    }
  }
  el.addEventListener("pointerdown", toque);
  return () => { clearTimeout(vuelta); cancelAnimationFrame(raf); el.removeEventListener("pointerdown", toque); };
}
