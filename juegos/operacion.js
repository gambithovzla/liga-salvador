/* Operación Primer Vuelo: el gran final en todos los celulares.
   hackeo -> jefe -> chispa -> velas -> historia (película) -> podio -> creditos.
   Los momentos compartidos se derivan del reloj del servidor. Cada celular solo escribe lo suyo:
   final/listos/{id}, final/golpes/{id}, final/reloj/{id} y capsula/{id}. */

const FASES_OPERACION = ["hackeo", "jefe", "chispa", "velas", "creditos"];
const OP_CHISPA_ESPERA = 4000;   // tiempo para levantar los celulares antes de que viaje la energía
const OP_CHISPA_VIAJE = 8000;
const OP_CUENTA = 2400;          // 3, 2, 1
const OP_DERROTA = 5200;         // desde el golpe final hasta "la ciudad quedó a oscuras"
const OP_SOPLIDO_ESPERA = 700;   // margen para que todas las velas se apaguen en el mismo instante
const OP_GOLPES_POR_HEROE = 110; // ~30 s de batalla si todos participan
const OP_GOLPES_POR_SEGUNDO = 9;

function esFaseOperacion(f) { return !!f && FASES_OPERACION.includes(f.fase); }

const OP_PODERES = {
  fuerza: { modo: "sacudir", verbo: "¡SACUDE!", ayuda: "Sacude el celular con toda tu súper fuerza." },
  rayo: { modo: "tocar", verbo: "¡TOCA!", ayuda: "Toca la pantalla a la velocidad del rayo." },
  vuelo: { modo: "sacudir", verbo: "¡ARRIBA!", ayuda: "Agita el celular hacia arriba, como si despegaras." },
  invisible: { modo: "mantener", verbo: "¡MANTÉN!", ayuda: "Mantén el dedo en el botón: el villano no te ve venir." },
  abrazos: { modo: "mantener", verbo: "¡ABRAZA!", ayuda: "Mantén el dedo en el botón y aprieta con cariño." },
  risa: { modo: "sacudir", verbo: "¡JA, JA!", ayuda: "Sacúdete de risa con el celular en la mano." },
  laser: { modo: "tocar", verbo: "¡DISPARA!", ayuda: "Toca la pantalla para disparar tu visión láser." },
  escudo: { modo: "mantener", verbo: "¡RESISTE!", ayuda: "Mantén el dedo en el escudo para cargarlo." },
};
const OP_BURLAS_PODER = {
  fuerza: "¿Súper fuerza? Ni levantando montañas vas a mantener los ojos abiertos.",
  rayo: "¿Velocidad del rayo? Corre lo que quieras: el sueño siempre llega primero.",
  vuelo: "¿Vuelo? Vas a aterrizar directo en tu almohada.",
  invisible: "¿Invisibilidad? Te veo igual. Te veo con sueño.",
  abrazos: "¿Súper abrazos? Un abrazo… y a dormir.",
  risa: "¿Risa contagiosa? Lo único contagioso aquí es el bostezo.",
  laser: "¿Visión láser? Esos ojos se van a cerrar.",
  escudo: "¿Escudo invencible? Contra el sueño no hay escudo que valga.",
};
const OP_ALIAS_PODER = {
  fuerza: "Puño de acero", rayo: "Chispa veloz", vuelo: "Alas de Barranco", invisible: "Sombra silenciosa",
  abrazos: "Abrazo invencible", risa: "Carcajada atómica", laser: "Mirada láser", escudo: "Muralla de la Liga",
};
const OP_BURLAS_BATALLA = [
  [0.75, "¿Eso es todo? Zzz…"],
  [0.5, "¡Ay! ¿Quién trajo tanta energía a esta fiesta?"],
  [0.25, "¡No! ¡Me están despertando!"],
  [0.0001, "¡Imposible! ¡Esa energía…! ¡Esa Liga…!"],
];

/* ---------- utilidades ---------- */
function azarSemilla(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function listosOperacion(S, f) { return Object.keys((f && f.listos) || {}).filter((id) => S.agentes && S.agentes[id] && S.agentes[id].nombre); }
function golpesTotales(f) { return Object.values((f && f.golpes) || {}).reduce((s, n) => s + (Number(n) || 0), 0); }
function vidaJefe(f, total) { return clamp(1 - total / Math.max(1, Number(f.vida) || 100), 0, 1); }

// iOS solo entrega el movimiento si se pide permiso dentro del toque.
function pedirSensoresOperacion() {
  const pedidos = [];
  try { if (typeof DeviceMotionEvent !== "undefined" && DeviceMotionEvent.requestPermission) pedidos.push(DeviceMotionEvent.requestPermission()); } catch (e) { /* sin sensores */ }
  try { if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) pedidos.push(DeviceOrientationEvent.requestPermission()); } catch (e) { /* sin sensores */ }
  return Promise.allSettled(pedidos).then((r) => r.every((x) => x.status === "fulfilled" && x.value === "granted"));
}

/* ---------- la energía que salta de celular en celular ---------- */
// Cada celular calcula el mismo plan con la misma semilla. Un celular no destella más de ~3 veces por segundo.
const cachePlanChispa = new Map();
function planChispa(f) {
  const orden = (f.orden || []).filter(Boolean);
  const clave = `${f.chispaT}:${orden.join(",")}`;
  if (cachePlanChispa.has(clave)) return cachePlanChispa.get(clave);
  const rnd = azarSemilla(hash(String(f.chispaT)));
  const pasos = [], ultimo = {};
  let t = 0, i = 0, previo = null;
  while (t < OP_CHISPA_VIAJE) {
    const intervalo = Math.max(110, 640 * Math.pow(0.85, i));
    let libres = orden.filter((id) => t - (ultimo[id] ?? -1e9) >= 340);
    if (libres.length > 1) libres = libres.filter((id) => id !== previo);
    if (libres.length) {
      const quien = libres[Math.floor(rnd() * libres.length)];
      ultimo[quien] = t; previo = quien;
      pasos.push({ i: pasos.length, t, quien, dur: clamp(intervalo * 1.3, 160, 300), ang: Math.floor(rnd() * 360) });
    }
    t += intervalo; i++;
  }
  const plan = { pasos, fin: t };
  cachePlanChispa.clear();
  cachePlanChispa.set(clave, plan);
  return plan;
}
function momentoChispa(f, ahora) {
  const plan = planChispa(f);
  const t = ahora - (Number(f.chispaT) || ahora);
  const finCuenta = plan.fin + OP_CUENTA;
  const momento = t < 0 ? "preparar" : t < plan.fin ? "viaje" : t < finCuenta ? "cuenta" : t < finCuenta + 700 ? "golpe" : t < finCuenta + OP_DERROTA ? "derrota" : "oscuro";
  return { momento, t, plan, finCuenta };
}

/* ---------- estadísticas de la noche: alimentan al villano y los créditos ---------- */
function estadisticasOperacion(S) {
  const f = S.final || {};
  const tabla = new Map((f.tabla || []).map((x) => [x.id, x]));
  const lista = agentesValidos(S.agentes).map((a) => ({
    id: a.id, nombre: a.nombre, poder: a.poder, unido: Number(a.unido) || 0,
    pos: (tabla.get(a.id) || {}).pos || 0, total: tabla.has(a.id) ? Number(tabla.get(a.id).total) || 0 : totalDe(S, a.id),
    duelosG: 0, mejorMs: 0, ganadas: 0, misiones: 0, bombas: 0, golpes: Number((f.golpes || {})[a.id]) || 0,
  }));
  const por = new Map(lista.map((e) => [e.id, e]));
  for (const d of Object.values(S.duelos || {})) {
    if (!d || d.estado !== "resuelto") continue;
    if (por.has(d.ganador)) por.get(d.ganador).duelosG++;
    for (const [id, ms] of Object.entries(d.r || {})) {
      const e = por.get(id), v = Number(ms);
      if (e && v > 0 && (!e.mejorMs || v < e.mejorMs)) e.mejorMs = v;
    }
  }
  for (const h of Object.values(S.historial || {})) {
    const g = ((h && h.top) || [])[0];
    if (g && Number(g.pts) > 0 && por.has(g.id)) por.get(g.id).ganadas++;
  }
  for (const [id, entradas] of Object.entries(S.puntos || {})) {
    const e = por.get(id);
    if (!e) continue;
    for (const [k, p] of Object.entries(entradas || {})) {
      if (!k.startsWith("m_")) continue;
      e.misiones++;
      if (Number(p && p.p) < 0 && /bomba/i.test(String(p && p.m))) e.bombas++;
    }
  }
  return lista;
}

// Cada récord va a una sola persona; el resto recibe un alias según su poder.
function repartoOperacion(S) {
  const lista = estadisticasOperacion(S);
  const alias = new Map();
  const dar = (candidatos, nombre, dato) => {
    const e = candidatos.find((x) => !alias.has(x.id));
    if (e) alias.set(e.id, { alias: nombre, dato: dato(e) });
  };
  const orden = (fn) => lista.slice().sort(fn);
  dar(orden((a, b) => a.pos - b.pos).filter((e) => e.pos === 1 && e.total > 0), "Número 1 de la Liga", (e) => `${fmt(e.total)} puntos de Liga`);
  dar(orden((a, b) => b.golpes - a.golpes).filter((e) => e.golpes > 0), "Pesadilla del Doctor Siesta", (e) => `${fmt(e.golpes)} golpes en la batalla final`);
  dar(orden((a, b) => a.mejorMs - b.mejorMs).filter((e) => e.mejorMs > 0), "Reflejos de rayo", (e) => `${fmt(e.mejorMs)} ms en un duelo`);
  dar(orden((a, b) => b.duelosG - a.duelosG).filter((e) => e.duelosG > 0), "Terror de los duelos", (e) => `Ganó ${plural(e.duelosG, "duelo", "duelos")}`);
  dar(orden((a, b) => b.ganadas - a.ganadas).filter((e) => e.ganadas > 0), "Leyenda de las misiones", (e) => `Ganó ${plural(e.ganadas, "misión", "misiones")}`);
  dar(orden((a, b) => b.bombas - a.bombas).filter((e) => e.bombas > 0), "Imán de bombas", (e) => e.bombas > 1 ? `Le explotó la bomba ${e.bombas} veces` : "Le explotó la bomba");
  dar(lista.filter((e) => e.pos === 2 && e.total > 0), "Plata de la Liga", (e) => `${fmt(e.total)} puntos de Liga`);
  dar(lista.filter((e) => e.pos === 3 && e.total > 0), "Bronce de la Liga", (e) => `${fmt(e.total)} puntos de Liga`);
  dar(orden((a, b) => a.unido - b.unido).filter((e) => e.unido > 0), "Agente fundador", () => "Llegó primero al cuartel");
  return orden((a, b) => a.unido - b.unido || a.nombre.localeCompare(b.nombre)).map((e) => Object.assign(e, alias.get(e.id) || {
    alias: OP_ALIAS_PODER[e.poder] || "Héroe de la Liga",
    dato: e.golpes > 0 ? `${fmt(e.golpes)} golpes al villano` : e.misiones > 0 ? `Jugó ${plural(e.misiones, "misión", "misiones")}` : "Estuvo en el origen de la leyenda",
  }));
}

function mensajeVillano(S, yo) {
  const e = estadisticasOperacion(S).find((x) => x.id === yo);
  const a = (S.agentes || {})[yo] || {};
  let dato = "";
  if (e) {
    if (e.mejorMs) dato = `Tus ${fmt(e.mejorMs)} milisegundos de reflejos no te van a salvar.`;
    else if (e.duelosG) dato = `Ganaste ${plural(e.duelosG, "duelo", "duelos")}. Conmigo no hay duelo que valga.`;
    else if (e.bombas) dato = "Ya te explotó una bomba hoy. Lo mío es peor: es sueño.";
    else if (e.ganadas) dato = `${plural(e.ganadas, "misión ganada", "misiones ganadas")}… qué miedo. (Bostezo).`;
    else if (e.misiones) dato = `Te vi jugar ${plural(e.misiones, "misión", "misiones")}. El cansancio ya te está ganando.`;
  }
  return [
    "Soy el Doctor Siesta.",
    `Te vi, ${a.nombre || "agente"}.`,
    dato,
    OP_BURLAS_PODER[a.poder] || "",
    "Esta fiesta se acaba ahora. En unos minutos, toda la Liga se quedará dormida.",
    "Solo tu poder puede detenerme… si te atreves.",
  ].filter(Boolean).join(" ");
}

function mensajesCreditos(S, semilla) {
  const lista = Object.entries(S.capsula || {})
    .filter(([id, c]) => c && c.publico && !c.oculto && String(c.texto || "").trim() && S.agentes && S.agentes[id])
    .map(([id, c]) => ({ id, nombre: nombreDe(S, id), texto: String(c.texto).trim(), t: Number(c.t) || 0 }))
    .sort((a, b) => a.t - b.t);
  if (lista.length <= 8) return lista;
  const rnd = azarSemilla(hash(String(semilla || 1)));
  return lista.map((m) => [rnd(), m]).sort((a, b) => a[0] - b[0]).slice(0, 8).map((x) => x[1]).sort((a, b) => a.t - b.t);
}
function duracionCreditos(S, semilla) {
  return clamp(16000 + agentesValidos(S.agentes).length * 1200 + mensajesCreditos(S, semilla).length * 4500, 30000, 150000);
}
function recordsOperacion(S) {
  const f = S.final || {};
  return [
    [fmt(agentesValidos(S.agentes).length), "héroes en la Liga"],
    [fmt(golpesTotales(f)), "golpes al Doctor Siesta"],
    [fmt(Object.keys(S.historial || {}).length), "misiones jugadas"],
    [fmt(Object.values(S.duelos || {}).filter((d) => d && d.estado === "resuelto").length), "duelos"],
    [fmt(Object.values(S.recuerdos || {}).filter((r) => r && r.estado === "aprobada").length), "fotos en el álbum"],
  ].filter(([n]) => n !== "0");
}

/* ---------- el villano ---------- */
function jefeSVG(clase) {
  return `<svg class="op-villano ${clase || ""}" viewBox="0 0 230 240" aria-hidden="true">` +
    `<defs><radialGradient id="opAura" cx="50%" cy="45%" r="50%"><stop offset="0" stop-color="#b46bff" stop-opacity=".6"/><stop offset="1" stop-color="#b46bff" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="opCapa" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3d2174"/><stop offset="1" stop-color="#10061f"/></linearGradient>` +
    `<radialGradient id="opPiel" cx="42%" cy="38%" r="65%"><stop offset="0" stop-color="#e9ddff"/><stop offset="1" stop-color="#8a72c9"/></radialGradient></defs>` +
    `<circle class="op-aura" cx="112" cy="122" r="110" fill="url(#opAura)"/>` +
    `<path d="M28 240 C38 172 62 140 112 132 C162 140 186 172 196 240 Z" fill="url(#opCapa)"/>` +
    `<path d="M54 152 L38 92 L88 132 Z M170 152 L186 92 L136 132 Z" fill="#4d2a8e" stroke="#170a30" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M76 240 C78 182 90 150 112 148 C134 150 146 182 148 240 Z" fill="#231244"/>` +
    `<circle cx="112" cy="192" r="18" fill="#120726" stroke="#d7ff3a" stroke-width="3"/>` +
    `<path d="M105 184 h14 l-14 16 h14" fill="none" stroke="#d7ff3a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="112" cy="98" r="44" fill="url(#opPiel)" stroke="#170a30" stroke-width="3"/>` +
    `<g class="op-gorro"><path d="M66 90 C62 42 112 22 152 38 C180 50 200 74 202 108 C190 94 172 82 156 78 L158 90 Z" fill="#6a2bd1" stroke="#170a30" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M84 60 C104 46 132 44 152 52" stroke="#efe4ff" stroke-width="8" fill="none" stroke-linecap="round" opacity=".9"/>` +
    `<path d="M164 56 C180 66 190 80 194 94" stroke="#efe4ff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"/>` +
    `<circle cx="202" cy="112" r="11" fill="#efe4ff" stroke="#170a30" stroke-width="3"/></g>` +
    `<path d="M64 86 C82 94 142 94 160 86 L160 99 C142 107 82 107 64 99 Z" fill="#efe4ff" stroke="#170a30" stroke-width="3" stroke-linejoin="round"/>` +
    `<g class="op-ojos"><path d="M80 116 Q93 104 106 113 Q93 124 80 116 Z" fill="#d7ff3a"/><path d="M118 113 Q131 104 144 116 Q131 124 118 113 Z" fill="#d7ff3a"/>` +
    `<path d="M93 109 v10 M131 109 v10" stroke="#170a30" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M76 106 L106 112 M148 106 L118 112" stroke="#170a30" stroke-width="5" stroke-linecap="round"/></g>` +
    `<g class="op-ojos-cerrados"><path d="M80 116 Q93 124 106 116 M118 116 Q131 124 144 116" stroke="#170a30" stroke-width="4" fill="none" stroke-linecap="round"/></g>` +
    `<g class="op-boca"><path d="M90 128 Q112 150 134 128 Q112 138 90 128 Z" fill="#170a30"/><path d="M98 131 l3 5 3-4 3 5 3-5 3 5 3-4 3 4" stroke="#fffdf4" stroke-width="2" fill="none"/></g>` +
    `<path class="op-boca-dormida" d="M102 132 Q112 138 122 132" stroke="#170a30" stroke-width="4" fill="none" stroke-linecap="round"/>` +
    `<g class="op-zzz" fill="#efe4ff" font-family="Bangers, Impact, sans-serif"><text x="14" y="58" font-size="26">Z</text><text x="30" y="36" font-size="19">z</text><text x="42" y="20" font-size="14">z</text></g>` +
    `</svg>`;
}

/* ---------- celular del invitado ---------- */
function crearOperacionJugador(opc) {
  const { T, S } = opc;
  const zona = opc.zona, raiz = opc.raiz;
  const yo = () => opc.yo();
  const st = {
    finalT: null, disparados: new Set(), afinadoFase: "",
    jefeT: null, local: 0, enviado: 0, ultimoEnvio: 0, enviando: false, totalVisto: 0, ultimoGolpeVisto: 0, eco: 1, burla: "",
    fichas: OP_GOLPES_POR_SEGUNDO, acumulado: 0, manteniendo: false, ultimoPunch: 0, ultimoVibrar: 0, jefeVisto: 0,
    sensores: false, movimientoVisto: false, ultimoSacudon: 0, gamma: null, inclinacion: 0,
    saltarCreditos: false, ultimoCuadro: 0, raf: 0,
  };
  const reducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  function unaVez(clave, fn) {
    if (st.disparados.has(clave)) return;
    st.disparados.add(clave);
    try { fn(); } catch (e) { console.error(e); }
  }
  function agente() { return (S.agentes || {})[yo()] || {}; }
  function poderOp() { return OP_PODERES[agente().poder] || OP_PODERES.rayo; }
  function listo(f) { return !!((f.listos || {})[yo()]); }

  /* ----- claves y html ----- */
  function clave(f) {
    const l = listo(f) ? 1 : 0;
    switch (f.fase) {
      case "hackeo": return `hackeo:${l}`;
      case "jefe": return `jefe:${f.jefeT}:${l}`;
      case "chispa": return `chispa:${f.chispaT}`;
      case "velas": return `velas:${f.velasT}`;
      case "creditos": return `creditos:${f.creditosT}:${S.capsula && S.capsula[yo()] ? 1 : 0}`;
      default: return f.fase;
    }
  }
  function html(f) {
    if (st.finalT !== f.t) { st.finalT = f.t; st.disparados.clear(); st.afinadoFase = ""; }
    switch (f.fase) {
      case "hackeo": return htmlHackeo(f);
      case "jefe": return htmlJefe(f);
      case "chispa": return htmlChispa();
      case "velas": return htmlVelas();
      case "creditos": return htmlCreditos(f);
      default: return "";
    }
  }
  function botonActivar() {
    const a = agente();
    return `<button class="op-boton" data-accion="op-activar">${icono(a.poder || "rayo")}<span>Activar mi poder</span><small>${esc(poderDe(a.poder).nombre)}</small></button>`;
  }
  function htmlHackeo(f) {
    const a = agente(), texto = mensajeVillano(S, yo());
    const p = poderOp();
    const accion = listo(f)
      ? `<div class="op-listo"><span class="op-kicker">PODER ACTIVADO</span><strong>${esc(poderDe(a.poder).nombre)}</strong><p>${esc(p.ayuda)}</p><p class="op-conteo"><b data-op-listos>0</b> <span data-op-listos-txt>héroes listos</span> para la batalla</p><span class="op-ayuda">Espera la señal del anfitrión.</span></div>`
      : `${botonActivar()}<span class="op-ayuda">Tu celular sentirá tus movimientos durante la batalla.</span>`;
    return `<section class="op-escena op-hackeo${listo(f) ? " op-ya-listo" : ""}" data-op="hackeo" data-etapa="estatica" role="region" aria-label="Transmisión del villano">` +
      `<div class="op-ruido" aria-hidden="true"></div><div class="op-scan" aria-hidden="true"></div>` +
      `<div class="op-alertas" aria-hidden="true"><b>SEÑAL INTERCEPTADA</b><span>ACCESO NO AUTORIZADO · LIGA-01</span><span>CELULAR DE ${esc(String(a.nombre || "AGENTE").toUpperCase())}: COMPROMETIDO</span><b>/// ALERTA ///</b></div>` +
      `<div class="op-villano-zona">${jefeSVG()}</div>` +
      `<div class="op-mensaje"><span class="op-kicker">TRANSMISIÓN DEL DOCTOR SIESTA</span><p class="op-maquina" aria-hidden="true" data-op-texto="${esc(texto)}"></p><p class="visualmente-oculto">${esc(texto)}</p></div>` +
      `<div class="op-accion">${accion}</div></section>`;
  }
  function htmlJefe(f) {
    const a = agente(), p = poderOp();
    const pad = listo(f)
      ? `<div class="op-pad-zona"><button class="op-pad op-modo-${p.modo}" data-op-pad data-modo="${p.modo}" type="button">${icono(a.poder || "rayo")}<strong>${esc(p.verbo)}</strong><small>${p.modo === "sacudir" ? "o toca aquí" : p.modo === "mantener" ? "sin soltar" : "¡más rápido!"}</small></button>` +
        `<p class="op-mis-golpes"><b data-op-mios>0</b> golpes tuyos<span class="op-ayuda-pad"> · ${esc(p.ayuda)}</span></p>` +
        `<button class="enlace op-sensor" data-accion="op-sensor" hidden>¿No detecta el movimiento? Toca aquí para activarlo</button></div>`
      : `<div class="op-pad-zona op-sin-activar"><p>¡La batalla empezó! Activa tu poder para pelear.</p>${botonActivar()}</div>`;
    return `<section class="op-escena op-jefe" data-op="jefe" role="region" aria-label="Batalla contra el Doctor Siesta">` +
      `<header class="op-vida"><div class="op-vida-nombre"><span>DOCTOR SIESTA</span><b data-op-pct>100%</b></div>` +
      `<div class="op-barra" role="progressbar" aria-label="Vida del Doctor Siesta" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><em data-op-eco></em><i data-op-barra></i></div></header>` +
      `<div class="op-villano-zona" data-op-villano>${jefeSVG()}<div class="op-danos" data-op-danos aria-hidden="true"></div></div>` +
      `<p class="op-burla" data-op-burla aria-live="polite">${esc(OP_BURLAS_BATALLA[0][1])}</p>${pad}</section>`;
  }
  function htmlChispa() {
    return `<section class="op-escena op-chispa" data-op="chispa" data-momento="preparar" role="region" aria-label="El golpe final">` +
      `<div class="op-destello" data-op-destello aria-hidden="true"><i></i><b></b></div><div class="op-blanco" aria-hidden="true"></div>` +
      `<div class="op-m op-m-preparar"><span class="op-kicker">EL GOLPE FINAL</span><h1>¡Levanten<br>sus celulares!</h1><p>Muestra tu pantalla a la sala. La energía de la Liga va a saltar de héroe en héroe.</p><b class="op-numero" data-op-espera></b></div>` +
      `<div class="op-m op-m-viaje"><span class="op-kicker">LA ENERGÍA VIAJA</span><h1>No bajes<br>tu celular</h1><p>Mira la sala: la energía salta de un celular a otro.</p><div class="op-medidor"><i data-op-medidor></i></div></div>` +
      `<div class="op-m op-m-cuenta"><b class="op-numero gigante" data-op-cuenta aria-live="assertive">3</b></div>` +
      `<div class="op-m op-m-derrota"><div class="op-villano-zona">${jefeSVG("dormido")}</div><h1 class="op-boom">¡DERROTADO!</h1><p>El Doctor Siesta se quedó dormido con su propio poder.</p></div>` +
      `<div class="op-m op-m-oscuro"><span class="op-kicker">PERO…</span><h1>La ciudad quedó<br>a oscuras.</h1><p class="op-tarde">Apaguen las luces. Es hora de la torta.</p></div></section>`;
  }
  function htmlVelas() {
    const src = imagenSalva("salvador");
    return `<section class="op-escena op-velas" data-op="velas" data-estado="encendida" role="region" aria-label="Las velas de la Liga">` +
      `<div class="op-velas-texto"><span class="op-kicker">CON LAS LUCES APAGADAS</span><h1>Levanta tu vela</h1><p>Canten juntos «Feliz cumpleaños». Cuando Salvador sople, todas las velas se apagarán.</p></div>` +
      `<div class="op-vela" aria-hidden="true"><div class="op-llama" data-op-llama><i class="op-halo"></i><i class="op-fuego"></i><i class="op-nucleo"></i></div><div class="op-humo"><i></i><i></i><i></i><i></i></div><div class="op-cera"><i></i></div></div>` +
      `<div class="op-feliz">${src ? `<img src="${esc(src)}" alt="">` : ""}<span class="op-kicker">${esc(CONFIG.fechaRecuerdo || "")}</span><h1>Feliz primer año,<br><em>Salvador.</em></h1><p>Tu Liga estuvo aquí.</p></div></section>`;
  }
  function htmlCreditos(f) {
    const reparto = repartoOperacion(S), mensajes = mensajesCreditos(S, f.creditosT), records = recordsOperacion(S);
    const mio = reparto.find((r) => r.id === yo()) || { nombre: nombreDe(S, yo()), alias: "Héroe de la Liga", dato: "" };
    const vencieron = listosOperacion(S, f).length || reparto.length;
    const fila = (f.tabla || []).find((x) => x.id === yo());
    const tiene = !!(S.capsula && S.capsula[yo()] && String(S.capsula[yo()].texto || "").trim());
    return `<section class="op-escena op-creditos" data-op="creditos" role="region" aria-label="Créditos finales">` +
      `<div class="op-rodillo" data-op-rodillo>` +
      `<p class="op-c-pre">LA LIGA DE SALVADOR PRESENTA</p><h1 class="op-c-titulo">OPERACIÓN<br><em>PRIMER VUELO</em></h1>` +
      `<div class="op-c-bloque"><span>Protagonista</span><b>SALVADOR</b><small>como él mismo</small></div>` +
      `<div class="op-c-bloque"><span>Villano</span><b>DOCTOR SIESTA</b><small>derrotado por ${plural(vencieron, "héroe", "héroes")}</small></div>` +
      `<h2>Reparto</h2><p class="op-c-nota">en orden de llegada a la Liga</p>` +
      `<ul class="op-c-reparto">${reparto.map((r) => `<li${r.id === yo() ? ` class="yo"` : ""}><b>${esc(r.nombre)}</b><span>como «${esc(r.alias)}»</span><small>${esc(r.dato)}</small>${r.id === yo() ? `<em>¡Eres tú!</em>` : ""}</li>`).join("")}</ul>` +
      (records.length ? `<h2>Récords de la noche</h2><ul class="op-c-records">${records.map(([n, t]) => `<li><b>${n}</b><span>${esc(t)}</span></li>`).join("")}</ul>` : "") +
      (mensajes.length ? `<h2>Mensajes para el Salvador de ${esc(CONFIG.capsulaAnio || "2043")}</h2>${mensajes.map((m) => `<blockquote class="op-c-mensaje"><p>«${esc(m.texto)}»</p><cite>${esc(m.nombre)}</cite></blockquote>`).join("")}` : "") +
      `<div class="op-c-bloque"><span>Una producción de</span><b>LA LIGA DE SALVADOR</b><small>${esc(CONFIG.fechaRecuerdo || "")}</small></div>` +
      `<p class="op-c-gracias">Gracias por estar en el origen de esta leyenda.</p></div>` +
      `<div class="op-fin" data-op-fin><div class="op-cumplida"><b>MISIÓN CUMPLIDA</b><span>OPERACIÓN PRIMER VUELO</span></div>` +
      `<div class="op-ficha">${poderHTML(agente().poder)}<strong>${esc(mio.nombre)}</strong><span>como «${esc(mio.alias)}»</span>${mio.dato ? `<small>${esc(mio.dato)}</small>` : ""}` +
      (fila ? `<p>${ordinal(fila.pos)} lugar · ${fmt(fila.total)} puntos de Liga</p>` : "") + `</div>` +
      `<button class="boton bloque" data-accion="op-ficha">Descargar mi ficha de héroe</button>` +
      `<button class="boton blanco bloque" data-accion="op-capsula">${tiene ? "Editar mi mensaje para 2043" : `Escribir mi mensaje para el Salvador de ${esc(CONFIG.capsulaAnio || "2043")}`}</button>` +
      `<button class="enlace" data-accion="estudio-liga">Ver álbum y crear mi portada</button></div>` +
      `<button class="enlace op-saltar" data-accion="op-saltar-creditos">Saltar créditos</button></section>`;
  }

  /* ----- sensores ----- */
  function alMovimiento(e) {
    const a = e.acceleration;
    let m;
    if (a && a.x !== null && a.x !== undefined) m = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    else {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x === null || g.x === undefined) return;
      m = Math.abs(Math.hypot(g.x || 0, g.y || 0, g.z || 0) - 9.81);
    }
    st.movimientoVisto = true;
    const ahora = performance.now();
    if (m > 11 && ahora - st.ultimoSacudon > 120) {
      st.ultimoSacudon = ahora;
      const f = S.final;
      if (f && f.fase === "jefe" && listo(f) && poderOp().modo === "sacudir") golpear();
    }
  }
  function alGirar(e) { if (typeof e.gamma === "number") st.gamma = e.gamma; }
  function escucharSensores() {
    if (st.sensores) return;
    st.sensores = true;
    window.addEventListener("devicemotion", alMovimiento);
    window.addEventListener("deviceorientation", alGirar);
  }
  // Android no pide permiso: si el invitado ya activó su poder antes de recargar, se escucha de nuevo.
  if (typeof DeviceMotionEvent === "undefined" || !DeviceMotionEvent.requestPermission) escucharSensores();

  /* ----- golpes ----- */
  function golpear() {
    const f = S.final;
    if (!f || f.fase !== "jefe" || !listo(f)) return;
    if (st.fichas < 1) return;
    st.fichas--;
    st.local++;
    const el = zona.querySelector(".op-jefe");
    if (!el) return;
    const ahora = performance.now();
    const pad = el.querySelector("[data-op-pad]");
    if (pad) { pad.classList.remove("golpe"); void pad.offsetWidth; pad.classList.add("golpe"); }
    const danos = el.querySelector("[data-op-danos]");
    if (danos && danos.childElementCount < 14) {
      const d = document.createElement("span");
      d.textContent = poderOp().modo === "mantener" ? "+1" : ["¡PUM!", "¡ZAS!", "+1", "¡POW!", "+1"][st.local % 5];
      d.style.left = `${azar(15, 85)}%`; d.style.top = `${azar(15, 70)}%`;
      danos.append(d);
      setTimeout(() => d.remove(), 700);
    }
    if (ahora - st.ultimoPunch > 70) { st.ultimoPunch = ahora; Sonido.tocar("puno"); }
    if (ahora - st.ultimoVibrar > 110) { st.ultimoVibrar = ahora; vibrar(8); }
  }
  function enviarGolpes(f, ahora) {
    if (st.enviando || st.local <= st.enviado || ahora - st.ultimoEnvio < 500) return;
    st.enviando = true; st.ultimoEnvio = ahora;
    const n = st.local, jefeT = f.jefeT;
    T.escribir(`final/golpes/${yo()}`, n).then(() => { if (st.jefeT === jefeT) st.enviado = Math.max(st.enviado, n); })
      .catch(() => { /* se reintenta en el próximo cuadro */ }).finally(() => { st.enviando = false; });
  }
  zona.addEventListener("pointerdown", (e) => {
    const pad = e.target.closest("[data-op-pad]");
    if (!pad) return;
    e.preventDefault();
    if (pad.dataset.modo === "mantener") {
      st.manteniendo = true; pad.classList.add("cargando");
      try { pad.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
    } else golpear();
  });
  const soltar = () => { if (!st.manteniendo) return; st.manteniendo = false; const pad = zona.querySelector("[data-op-pad]"); if (pad) pad.classList.remove("cargando"); };
  zona.addEventListener("pointerup", soltar);
  zona.addEventListener("pointercancel", soltar);
  zona.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-op-pad]")) e.preventDefault(); });

  /* ----- cada cuadro ----- */
  function cuadro(t) {
    st.raf = requestAnimationFrame(cuadro);
    const dt = Math.min(0.1, Math.max(0, (t - (st.ultimoCuadro || t)) / 1000));
    st.ultimoCuadro = t;
    const el = zona.querySelector(".op-escena"), f = S.final;
    if (!el || !esFaseOperacion(f)) return;
    const ahora = T.ahora();
    try {
      if (el.dataset.op === "hackeo") cuadroHackeo(el, f, ahora);
      else if (el.dataset.op === "jefe") cuadroJefe(el, f, ahora, dt);
      else if (el.dataset.op === "chispa") cuadroChispa(el, f, ahora);
      else if (el.dataset.op === "velas") cuadroVelas(el, f, ahora, t);
      else if (el.dataset.op === "creditos") cuadroCreditos(el, f, ahora);
    } catch (e) { console.error(e); }
  }
  st.raf = requestAnimationFrame(cuadro);

  function cuadroHackeo(el, f, ahora) {
    const e = ahora - f.t, texto = el.querySelector("[data-op-texto]");
    const completo = texto.dataset.opTexto;
    const tarde = e > 25000 || listo(f);
    const n = tarde ? completo.length : Math.max(0, Math.floor((e - 4600) / 1000 * 34));
    const etapa = tarde ? "boton" : e < 600 ? "estatica" : e < 3000 ? "glitch" : e < 4600 ? "villano" : n < completo.length ? "mensaje" : "boton";
    if (el.dataset.etapa !== etapa) {
      el.dataset.etapa = etapa;
      if (e < 20000) {
        if (etapa === "estatica") unaVez("hk:estatica", () => Sonido.tocar("estatica"));
        if (etapa === "glitch") unaVez("hk:glitch", () => { Sonido.tocar("glitch"); vibrar([90, 60, 90, 60, 260]); });
        if (etapa === "villano") unaVez("hk:villano", () => { Sonido.tocar("villano"); vibrar(300); });
        if (etapa === "boton") unaVez("hk:boton", () => Sonido.tocar("tic"));
      }
    }
    const visible = completo.slice(0, Math.min(completo.length, n));
    if (texto.textContent !== visible) {
      if (!tarde && visible.length % 3 === 0) Sonido.tocar("tecla");
      texto.textContent = visible;
      texto.scrollTop = texto.scrollHeight;
    }
    const c = el.querySelector("[data-op-listos]");
    if (c) {
      const k = listosOperacion(S, f).length;
      if (c.textContent !== String(k)) { c.textContent = String(k); el.querySelector("[data-op-listos-txt]").textContent = k === 1 ? "héroe listo" : "héroes listos"; }
    }
  }

  function cuadroJefe(el, f, ahora, dt) {
    const me = yo();
    if (st.jefeT !== f.jefeT) {
      st.jefeT = f.jefeT;
      st.local = st.enviado = Number((f.golpes || {})[me]) || 0;
      st.totalVisto = golpesTotales(f); st.eco = 1; st.burla = ""; st.jefeVisto = ahora;
    }
    st.fichas = Math.min(OP_GOLPES_POR_SEGUNDO, st.fichas + dt * OP_GOLPES_POR_SEGUNDO);
    if (st.manteniendo) {
      st.acumulado += dt * 5;
      while (st.acumulado >= 1) { st.acumulado--; golpear(); }
    }
    enviarGolpes(f, ahora);
    let total = 0;
    for (const [id, n] of Object.entries(f.golpes || {})) total += id === me ? 0 : Number(n) || 0;
    total += Math.max(st.local, Number((f.golpes || {})[me]) || 0);
    const vida = vidaJefe(f, total);
    st.eco = Math.max(vida, st.eco - dt * 0.35);
    el.querySelector("[data-op-barra]").style.width = `${(vida * 100).toFixed(1)}%`;
    el.querySelector("[data-op-eco]").style.width = `${(st.eco * 100).toFixed(1)}%`;
    const pct = `${Math.ceil(vida * 100)}%`;
    const pctEl = el.querySelector("[data-op-pct]");
    if (pctEl.textContent !== pct) { pctEl.textContent = pct; el.querySelector(".op-barra").setAttribute("aria-valuenow", String(Math.ceil(vida * 100))); }
    const mios = el.querySelector("[data-op-mios]");
    if (mios && mios.textContent !== fmt(st.local)) mios.textContent = fmt(st.local);
    el.classList.toggle("op-debil", vida <= 0);
    el.classList.toggle("op-herido", vida > 0 && vida < 0.5);
    const burla = vida <= 0 ? "¡ESTÁ DÉBIL! Levanten sus celulares: el golpe final viene en camino."
      : (OP_BURLAS_BATALLA.find(([desde]) => vida >= desde) || OP_BURLAS_BATALLA[OP_BURLAS_BATALLA.length - 1])[1];
    if (burla !== st.burla) {
      const previa = st.burla;
      st.burla = burla;
      el.querySelector("[data-op-burla]").textContent = burla;
      if (previa) unaVez(`jf:${f.jefeT}:${burla}`, () => { Sonido.tocar(vida <= 0 ? "derrota" : "herido"); vibrar(vida <= 0 ? [200, 80, 200] : 60); });
    }
    if (total > st.totalVisto) {
      st.totalVisto = total;
      if (ahora - st.ultimoGolpeVisto > 140 && !reducido()) {
        st.ultimoGolpeVisto = ahora;
        const v = el.querySelector("[data-op-villano]");
        v.classList.remove("golpeado"); void v.offsetWidth; v.classList.add("golpeado");
      }
    }
    const sensor = el.querySelector(".op-sensor");
    if (sensor) sensor.hidden = !(poderOp().modo === "sacudir" && !st.movimientoVisto && ahora - st.jefeVisto > 3000);
  }

  function destellar(el, paso) {
    const d = el.querySelector("[data-op-destello]");
    d.style.setProperty("--ang", `${paso.ang}deg`);
    d.classList.remove("brilla"); void d.offsetWidth; d.classList.add("brilla");
    clearTimeout(st.apagarDestello);
    st.apagarDestello = setTimeout(() => d.classList.remove("brilla"), paso.dur);
    Sonido.tocar("chispa", paso.i);
    vibrar(25);
  }
  function cuadroChispa(el, f, ahora) {
    const m = momentoChispa(f, ahora), k = f.chispaT;
    if (el.dataset.momento !== m.momento) el.dataset.momento = m.momento;
    if (m.momento === "preparar") {
      const s = String(Math.max(1, Math.ceil(-m.t / 1000)));
      const n = el.querySelector("[data-op-espera]");
      if (n.textContent !== s) n.textContent = s;
      unaVez(`ch:${k}:preparar`, () => { Sonido.tocar("alerta"); vibrar([60, 40, 60]); });
    } else if (m.momento === "viaje") {
      el.querySelector("[data-op-medidor]").style.width = `${Math.min(100, m.t / m.plan.fin * 100).toFixed(1)}%`;
      for (const p of m.plan.pasos) {
        if (p.quien !== yo() || m.t < p.t || m.t - p.t > 160) continue;
        unaVez(`ch:${k}:${p.i}`, () => destellar(el, p));
      }
    } else if (m.momento === "cuenta") {
      const n = 3 - Math.floor((m.t - m.plan.fin) / (OP_CUENTA / 3));
      const c = el.querySelector("[data-op-cuenta]");
      if (c.textContent !== String(n)) { c.textContent = String(n); c.classList.remove("late"); void c.offsetWidth; c.classList.add("late"); }
      if (m.t - m.plan.fin < OP_CUENTA + 500) unaVez(`ch:${k}:cuenta${n}`, () => { Sonido.tocar("cuenta", n); vibrar(40); });
    } else if (m.t - m.finCuenta < 12000) {
      unaVez(`ch:${k}:golpe`, () => { Sonido.tocar("golpeFinal"); vibrar([500]); });
      if (m.momento === "derrota") unaVez(`ch:${k}:derrota`, () => { Sonido.tocar("fanfarria"); confeti(raiz); });
    }
  }

  function cuadroVelas(el, f, ahora, t) {
    const s = Number(f.sopladoT) || 0;
    const estado = !s || ahora < s ? "encendida" : ahora < s + 1900 ? "soplada" : "feliz";
    if (el.dataset.estado !== estado) {
      el.dataset.estado = estado;
      if (estado === "soplada" && ahora - s < 8000) unaVez(`vl:${s}:soplo`, () => { Sonido.tocar("soplido"); vibrar(80); });
      if (estado === "feliz" && ahora - s < 12000) unaVez(`vl:${s}:feliz`, () => { Sonido.tocar("velaMagia"); confeti(raiz); vibrar([40, 60, 40, 60, 160]); });
    }
    const objetivo = st.gamma === null || reducido() ? Math.sin(t / 900) * 4 : clamp(-st.gamma * 0.8, -32, 32);
    st.inclinacion += (objetivo - st.inclinacion) * 0.08;
    el.querySelector("[data-op-llama]").style.setProperty("--incl", `${st.inclinacion.toFixed(2)}deg`);
  }

  function cuadroCreditos(el, f, ahora) {
    const dur = Number(f.creditosDur) || 60000, t = ahora - (Number(f.creditosT) || ahora);
    const rod = el.querySelector("[data-op-rodillo]");
    const H = el.clientHeight, C = rod.scrollHeight;
    const p = clamp(t / dur, 0, 1);
    rod.style.transform = `translate3d(0,${(H - (H + C) * p).toFixed(1)}px,0)`;
    const fin = p >= 1 || st.saltarCreditos;
    if (fin !== el.classList.contains("terminado")) {
      el.classList.toggle("terminado", fin);
      if (fin && t - dur < 10000) unaVez(`cr:${f.creditosT}`, () => { Sonido.tocar("firmaLiga"); vibrar([40, 40, 80]); });
    }
  }

  /* ----- lo que avisa el estado (cada refresco) ----- */
  function tic(f) {
    if (!esFaseOperacion(f)) return;
    // Afinamos el reloj al entrar a cada momento sincronizado; tarda menos de un segundo.
    if (T.afinarReloj && yo() && ["hackeo", "chispa", "velas"].includes(f.fase) && st.afinadoFase !== `${f.t}:${f.fase}`) {
      st.afinadoFase = `${f.t}:${f.fase}`;
      T.afinarReloj(`final/reloj/${yo()}`).catch(() => { /* seguimos con el reloj de Firebase */ });
    }
  }

  /* ----- acciones ----- */
  function accion(a, el) {
    const f = S.final;
    switch (a) {
      case "op-activar": {
        if (!esFaseOperacion(f) || listo(f)) return;
        const permiso = pedirSensoresOperacion(); // dentro del toque, antes de cualquier espera
        Sonido.despertar();
        el.disabled = true;
        permiso.then(() => escucharSensores());
        T.escribir(`final/listos/${yo()}`, T.ahora())
          .then(() => { Sonido.tocar("activar"); vibrar([30, 50, 120]); })
          .catch(() => { el.disabled = false; opc.aviso("No se pudo activar tu poder. Revisa tu conexión e intenta otra vez."); });
        return;
      }
      case "op-sensor":
        pedirSensoresOperacion().then((ok) => {
          escucharSensores();
          if (!ok) opc.aviso("Tu celular no permite usar el movimiento. Toca el botón para golpear.");
        });
        return;
      case "op-saltar-creditos": st.saltarCreditos = true; return;
      case "op-ficha": descargarFichaOperacion(S, yo()).catch(() => opc.aviso("No se pudo crear tu ficha. Intenta otra vez.")); return;
      case "op-capsula": abrirCapsulaOperacion(T, S, yo(), raiz, opc.aviso); return;
    }
  }

  return { clave, html, tic, accion, destruir() { cancelAnimationFrame(st.raf); window.removeEventListener("devicemotion", alMovimiento); window.removeEventListener("deviceorientation", alGirar); } };
}

/* ---------- ficha de héroe para descargar ---------- */
function fichaOperacion(S, yo) {
  const r = repartoOperacion(S).find((x) => x.id === yo);
  const f = S.final || {};
  const fila = (f.tabla || []).find((x) => x.id === yo);
  return Object.assign({ nombre: nombreDe(S, yo), alias: "Héroe de la Liga", dato: "", golpes: 0, duelosG: 0, mejorMs: 0 }, r || {},
    { poder: poderDe(poderDeAgente(S, yo)).nombre, pos: fila ? fila.pos : 0, total: fila ? fila.total : totalDe(S, yo) });
}
async function dibujarFichaOperacion(canvas, d) {
  await Promise.all([document.fonts.load('80px "Bangers"'), document.fonts.load('28px "Anton"')]).catch(() => {});
  canvas.width = 1080; canvas.height = 1440;
  const c = canvas.getContext("2d");
  const fondo = c.createLinearGradient(0, 0, 0, 1440);
  fondo.addColorStop(0, "#160a33"); fondo.addColorStop(.55, "#0b1630"); fondo.addColorStop(1, "#050c1e");
  c.fillStyle = fondo; c.fillRect(0, 0, 1080, 1440);
  const rnd = azarSemilla(hash(d.nombre));
  c.fillStyle = "#fff6dc";
  for (let i = 0; i < 90; i++) { c.globalAlpha = .2 + rnd() * .6; c.beginPath(); c.arc(rnd() * 1080, rnd() * 760, rnd() * 2 + .5, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = 1;
  const oro = c.createLinearGradient(0, 0, 1080, 1440);
  oro.addColorStop(0, "#fff0bc"); oro.addColorStop(.5, "#d4ac62"); oro.addColorStop(1, "#f8dc96");
  c.strokeStyle = oro; c.lineWidth = 2; c.strokeRect(30, 30, 1020, 1380);
  c.fillStyle = oro; c.font = '23px "Anton", sans-serif';
  c.textAlign = "left"; c.fillText("EXPEDIENTE DE HÉROE", 70, 86);
  c.textAlign = "right"; c.fillText("OPERACIÓN PRIMER VUELO", 1010, 86);
  const src = imagenSalva("salvador");
  if (src) {
    try {
      const img = new Image(); img.src = src; await img.decode();
      const h = 360, w = img.naturalWidth * h / img.naturalHeight;
      c.drawImage(img, 540 - w / 2, 110, w, h);
    } catch (e) { /* sin imagen */ }
  }
  c.save(); c.translate(540, 560); c.rotate(-0.04);
  c.fillStyle = "#d62b1f"; c.fillRect(-430, -70, 860, 120);
  c.strokeStyle = "#fff0bc"; c.lineWidth = 4; c.strokeRect(-430, -70, 860, 120);
  c.fillStyle = "#fffdf4"; c.textAlign = "center"; c.font = '104px "Bangers", sans-serif';
  c.fillText("MISIÓN CUMPLIDA", 0, 32, 820); c.restore();
  c.textAlign = "center"; c.fillStyle = "#fff8e8"; c.font = '92px "Bangers", sans-serif';
  c.fillText(d.nombre, 540, 735, 940);
  c.fillStyle = oro; c.font = '42px "Anton", sans-serif';
  c.fillText(`ALIAS: ${String(d.alias).toUpperCase()}`, 540, 800, 940);
  c.fillStyle = "#c9d5e8"; c.font = '27px "Anton", sans-serif';
  c.fillText(`PODER: ${String(d.poder).toUpperCase()}`, 540, 852, 940);
  const datos = [
    // Bangers no tiene «º»: el puesto va como número y la etiqueta lo explica.
    [d.pos ? String(d.pos) : "–", "LUGAR FINAL"], [fmt(d.total), "PUNTOS DE LIGA"],
    [fmt(d.golpes), "GOLPES AL VILLANO"], [d.mejorMs ? `${fmt(d.mejorMs)} ms` : fmt(d.duelosG), d.mejorMs ? "MEJOR REFLEJO" : "DUELOS GANADOS"],
  ];
  datos.forEach(([v, t], i) => {
    const x = 90 + (i % 2) * 460, y = 900 + Math.floor(i / 2) * 190;
    c.fillStyle = "#ffffff0d"; c.fillRect(x, y, 440, 165);
    c.strokeStyle = "#d4ac6266"; c.lineWidth = 2; c.strokeRect(x, y, 440, 165);
    c.fillStyle = "#fff8e8"; c.font = '70px "Bangers", sans-serif'; c.fillText(v, x + 220, y + 92, 400);
    c.fillStyle = oro; c.font = '22px "Anton", sans-serif'; c.fillText(t, x + 220, y + 135, 400);
  });
  if (d.dato && !/golpes/.test(d.dato)) { c.fillStyle = "#c9d5e8"; c.font = '28px "Anton", sans-serif'; c.fillText(String(d.dato).toUpperCase(), 540, 1305, 940); }
  c.fillStyle = oro; c.font = '22px "Anton", sans-serif';
  c.fillText(`LA LIGA DE SALVADOR · ${CONFIG.fechaRecuerdo || ""}`, 540, 1375, 940);
}
async function descargarFichaOperacion(S, yo) {
  const canvas = document.createElement("canvas");
  await dibujarFichaOperacion(canvas, fichaOperacion(S, yo));
  const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
  if (!blob) throw new Error("Sin imagen");
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = "mi-ficha-liga-salvador.png"; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ---------- cápsula del tiempo ---------- */
function capsulaHTML(S, yo, borrador) {
  const c = (S.capsula || {})[yo];
  const texto = borrador !== undefined ? borrador : (c && c.texto) || "";
  const anio = esc(CONFIG.capsulaAnio || "2043");
  return `<section class="capsula-acceso"><span class="eyebrow">CÁPSULA DEL TIEMPO · ABRIR EN ${anio}</span>` +
    `<h2>Un mensaje para el Salvador de 18 años.</h2><p>¿Qué quieres decirle cuando sea grande? Sus papás lo guardarán en un expediente secreto para entregárselo en ${anio}.</p>` +
    `<form data-form="capsula"><label class="visualmente-oculto" for="capsula-texto">Tu mensaje para Salvador</label>` +
    `<textarea id="capsula-texto" name="texto" maxlength="400" rows="4" placeholder="Querido Salvador: el día de tu primer cumpleaños…">${esc(texto)}</textarea>` +
    `<label class="permiso-album"><input type="checkbox" name="publico"${!c || c.publico ? " checked" : ""}>Que pueda leerse en los créditos del gran final</label>` +
    `<button class="boton bloque" type="submit">${c ? "Actualizar mi mensaje" : "Guardar mi mensaje"}</button></form>` +
    `<small data-vivo="capsula-estado">${c ? "Tu mensaje está guardado. Puedes cambiarlo cuando quieras." : "Solo tú y los papás de Salvador verán el expediente completo."}</small></section>`;
}
async function guardarCapsula(T, S, yo, form) {
  const texto = String(form.texto.value || "").trim().slice(0, 400);
  if (!texto) {
    if ((S.capsula || {})[yo]) await T.borrar(`capsula/${yo}`);
    return "vacio";
  }
  await T.actualizar(`capsula/${yo}`, { texto, nombre: nombreDe(S, yo), publico: !!form.publico.checked, t: T.ahora() });
  return "ok";
}
function abrirCapsulaOperacion(T, S, yo, raiz, aviso) {
  const capa = document.createElement("div");
  capa.className = "capa-modal";
  capa.innerHTML = `<div class="pagina capsula-modal" role="dialog" aria-modal="true" aria-label="Mensaje para Salvador">${capsulaHTML(S, yo)}<button class="enlace" data-cerrar>Cerrar</button></div>`;
  (raiz || document.body).appendChild(capa);
  const form = capa.querySelector("form");
  capa.querySelector("textarea").focus();
  capa.addEventListener("click", (e) => { if (e.target === capa || e.target.closest("[data-cerrar]")) capa.remove(); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const b = form.querySelector("button"); b.disabled = true;
    guardarCapsula(T, S, yo, form).then((r) => { capa.remove(); aviso(r === "ok" ? "Tu mensaje quedó guardado para 2043." : "Mensaje borrado."); })
      .catch(() => { b.disabled = false; aviso("No se pudo guardar. Revisa tu conexión."); });
  });
}

function mensajesCapsula(S) {
  return Object.entries(S.capsula || {}).filter(([, c]) => c && String(c.texto || "").trim())
    .map(([id, c]) => ({ id, nombre: (S.agentes && S.agentes[id] && S.agentes[id].nombre) || c.nombre || "Agente", texto: String(c.texto).trim(), publico: !!c.publico, oculto: !!c.oculto, t: Number(c.t) || 0 }))
    .sort((a, b) => a.t - b.t);
}
function capsulaHostHTML(S) {
  const lista = mensajesCapsula(S);
  return `<section class="pagina"><span class="cap">Cápsula del tiempo · ${esc(CONFIG.capsulaAnio || "2043")}</span>` +
    `<p>Los invitados escriben desde su cuartel un mensaje para Salvador a los 18 años. Los que lo permiten aparecen en los créditos del final. El expediente completo es para ustedes.</p>` +
    `<p><b data-vivo="capsula-n">${fmt(lista.length)}</b> mensajes guardados.</p>` +
    `<div class="fila"><button class="boton" data-accion="capsula-expediente">Abrir el expediente</button><button class="boton blanco" data-accion="capsula-descargar">Descargar copia</button></div>` +
    `<details><summary>Revisar los mensajes</summary><div data-vivo="capsula-lista"></div></details></section>`;
}
function capsulaHostListaHTML(S) {
  const lista = mensajesCapsula(S);
  if (!lista.length) return `<p class="suave">Todavía no hay mensajes.</p>`;
  return `<ul class="capsula-lista">${lista.map((m) => `<li><p>«${esc(m.texto)}»</p><small>${esc(m.nombre)} · ${m.publico ? (m.oculto ? "oculto en los créditos" : "aparece en los créditos") : "solo para el expediente"}</small>` +
    (m.publico ? `<button class="enlace" data-accion="capsula-ocultar" data-id="${esc(m.id)}">${m.oculto ? "Mostrar en los créditos" : "Ocultar de los créditos"}</button>` : "") + `</li>`).join("")}</ul>`;
}
function expedienteCapsulaHTML(S) {
  const lista = mensajesCapsula(S), anio = esc(CONFIG.capsulaAnio || "2043");
  return `<article class="expediente"><header><span class="expediente-sello">CONFIDENCIAL</span><p class="expediente-archivo">ARCHIVO DE LA LIGA · N.º 01</p>` +
    `<h1>Para Salvador</h1><p class="expediente-abrir">Abrir el ${esc(CONFIG.capsulaAbrir || `11 de octubre de ${anio}`)}, cuando cumplas 18 años.</p></header>` +
    `<p class="expediente-intro">El día de tu primer cumpleaños te esperaba tu Liga: la familia y los amigos que te vieron dar tus primeros pasos. Derrotamos juntos al Doctor Siesta, apagamos las luces y encendimos una vela por ti. Esto es lo que cada uno quiso decirte.</p>` +
    (lista.length ? lista.map((m) => `<section class="expediente-mensaje"><p>${esc(m.texto)}</p><footer>${esc(m.nombre)}</footer></section>`).join("") : `<p>Todavía no hay mensajes.</p>`) +
    `<footer class="expediente-pie">${plural(lista.length, "mensaje", "mensajes")} · ${esc(CONFIG.fechaRecuerdo || "")}</footer></article>`;
}
const ESTILO_EXPEDIENTE = `.expediente{max-width:720px;margin:0 auto;padding:48px 40px;background:#f6ecd6;color:#2a2116;font-family:Georgia,"Times New Roman",serif;border:1px solid #c9b48a;position:relative}
.expediente header{text-align:center;border-bottom:2px solid #2a2116;padding-bottom:24px;margin-bottom:24px}
.expediente-sello{position:absolute;top:28px;right:28px;transform:rotate(8deg);border:3px solid #a3261b;color:#a3261b;padding:4px 10px;font:700 15px/1 "Courier New",monospace;letter-spacing:3px}
.expediente-archivo{font:700 13px "Courier New",monospace;letter-spacing:3px;margin:0 0 12px}
.expediente h1{font-size:46px;margin:0 0 8px}
.expediente-abrir{font-style:italic;margin:0}
.expediente-intro{font-size:17px;line-height:1.6}
.expediente-mensaje{break-inside:avoid;border-left:3px solid #c9a24d;padding:4px 0 4px 18px;margin:26px 0}
.expediente-mensaje p{font-size:19px;line-height:1.55;margin:0 0 8px;white-space:pre-wrap}
.expediente-mensaje footer{font:700 14px "Courier New",monospace;letter-spacing:1px;text-transform:uppercase}
.expediente-pie{margin-top:36px;text-align:center;font:13px "Courier New",monospace;letter-spacing:2px}`;
function abrirExpedienteCapsula(S) {
  const capa = document.createElement("div");
  capa.className = "expediente-capa";
  capa.innerHTML = `<style>${ESTILO_EXPEDIENTE}</style><div class="expediente-barra"><button class="boton" data-exp="imprimir">Imprimir o guardar en PDF</button><button class="boton blanco" data-exp="cerrar">Cerrar</button></div>${expedienteCapsulaHTML(S)}`;
  document.body.appendChild(capa);
  document.body.classList.add("imprimiendo-expediente");
  const cerrar = () => { capa.remove(); document.body.classList.remove("imprimiendo-expediente"); };
  capa.addEventListener("click", (e) => {
    const b = e.target.closest("[data-exp]");
    if (!b) return;
    if (b.dataset.exp === "imprimir") window.print(); else cerrar();
  });
  capa.querySelector("[data-exp]").focus();
}
function descargarExpedienteCapsula(S) {
  const doc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Para Salvador · Abrir en ${esc(CONFIG.capsulaAnio || "2043")}</title><style>body{margin:0;padding:24px 12px;background:#e9dcc0}${ESTILO_EXPEDIENTE}</style></head><body>${expedienteCapsulaHTML(S)}</body></html>`;
  const url = URL.createObjectURL(new Blob([doc], { type: "text/html" })), a = document.createElement("a");
  a.href = url; a.download = `para-salvador-${CONFIG.capsulaAnio || "2043"}.html`; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ---------- centro de mando ---------- */
function participantesOperacion(S, f) {
  const conectados = agentesValidos(S.agentes).filter((a) => a.conectado !== false).map((a) => a.id);
  const listos = listosOperacion(S, f).filter((id) => conectados.includes(id));
  return listos.length ? listos : conectados;
}
function cambiosOperacion(accion, f, S, ahora) {
  if (!f) return null;
  switch (accion) {
    case "op-jefe": {
      if (f.fase !== "hackeo") return null;
      const n = listosOperacion(S, f).length || agentesValidos(S.agentes).filter((a) => a.conectado !== false).length || 1;
      return { fase: "jefe", jefeT: ahora, vida: Math.max(60, n * OP_GOLPES_POR_HEROE), golpes: null };
    }
    case "op-chispa":
      if (f.fase !== "jefe") return null;
      return { fase: "chispa", chispaT: ahora + OP_CHISPA_ESPERA, orden: barajar(participantesOperacion(S, f)) };
    case "op-velas":
      if (f.fase !== "chispa") return null;
      return { fase: "velas", velasT: ahora, sopladoT: null };
    case "op-soplar":
      if (f.fase !== "velas" || f.sopladoT) return null;
      return { sopladoT: ahora + OP_SOPLIDO_ESPERA };
    case "op-reencender":
      if (f.fase !== "velas") return null;
      return { sopladoT: null };
    case "op-pelicula":
      if (f.fase !== "velas") return null;
      return { fase: "historia", escenaT: ahora };
    case "op-creditos": {
      const completo = (f.podio || []).length > 0 && (Number(f.paso) || 0) >= f.podio.length;
      if (f.fase !== "podio" || !completo) return null;
      const t = ahora + 1500;
      return { fase: "creditos", creditosT: t, creditosDur: duracionCreditos(S, t) };
    }
    case "op-saltar": {
      const sig = { hackeo: "op-jefe", jefe: "op-chispa", chispa: "op-velas", velas: "op-pelicula" }[f.fase];
      return sig ? cambiosOperacion(sig, f, S, ahora) : null;
    }
  }
  return null;
}
const OP_PASOS_HOST = { hackeo: 1, jefe: 2, chispa: 3, velas: 4, creditos: 5 };
function claveOperacionHost(f) { return `${f.sopladoT ? 1 : 0}`; }
function operacionHostHTML(f) {
  const cab = (titulo, texto) => `<section class="pagina op-host"><span class="cap roja">Operación Primer Vuelo · ${OP_PASOS_HOST[f.fase]} de 5</span><h2 class="titulo chico">${titulo}</h2><p>${texto}</p>`;
  const saltar = f.fase !== "creditos" ? `<button class="enlace" data-accion="op-saltar">Saltar este momento</button>` : "";
  const pie = `${saltar}</section><button class="enlace centro" data-accion="final-cancelar">Volver a la fiesta</button>`;
  switch (f.fase) {
    case "hackeo":
      return cab("El villano tomó los celulares", "En cada celular aparece el Doctor Siesta y le habla a cada invitado por su nombre. Pide a todos que toquen «Activar mi poder»: así el celular podrá sentir sus movimientos.") +
        `<div class="final-host-energia"><b data-vivo="op-listos">0</b><span>héroes activaron su poder</span></div>` +
        `<button class="boton rojo grande bloque" data-accion="op-jefe">¡Que empiece la batalla!</button>` + pie;
    case "jefe":
      return cab("La batalla", "Cada invitado ataca con su poder: sacudir, tocar o mantener. Cuando la barra llegue a cero, pide que levanten sus celulares y toca «¡Golpe final!».") +
        `<div class="op-host-vida"><div class="op-barra"><i data-vivo="op-barra"></i></div><b data-vivo="op-vida">100%</b></div>` +
        `<ol class="tabla" data-vivo="op-top"></ol>` +
        `<button class="boton rojo grande bloque" data-accion="op-chispa" data-vivo="op-golpe">¡Golpe final!</button>` + pie;
    case "chispa":
      return cab("El golpe final", "La energía salta de celular en celular, luego viene la cuenta regresiva y el villano cae. Cuando termine, apaguen las luces y traigan la torta.") +
        `<div class="final-host-progreso"><strong data-vivo="op-momento">Levanten sus celulares</strong></div>` +
        `<button class="boton grande bloque" data-accion="op-velas" data-vivo="op-velas-boton" disabled>Luces apagadas: encender las velas</button>` + pie;
    case "velas":
      return f.sopladoT
        ? cab("¡Feliz primer año!", "Las velas se apagaron en todos los celulares. Cuando quieras, sigue con la película de la Liga.") +
          `<button class="boton rojo grande bloque" data-accion="op-pelicula">Ver la película de la Liga</button><button class="enlace" data-accion="op-reencender">Volver a encender las velas</button>` + pie
        : cab("Las velas de la Liga", "Con las luces apagadas, cada celular muestra una vela. Canten «Feliz cumpleaños». Toca el botón cuando Salvador sople: todas las velas se apagarán al mismo tiempo.") +
          `<button class="boton rojo grande bloque op-soplar" data-accion="op-soplar">Salvador sopló la vela</button>` + pie;
    case "creditos":
      return cab("Créditos finales", "Cada invitado ve su nombre en el reparto, los récords de la noche y los mensajes de la cápsula. Al final, puede descargar su ficha de héroe.") +
        `<div class="final-host-progreso"><strong data-vivo="op-creditos">Comienzan los créditos</strong><div class="cine-progreso"><i data-vivo="op-creditos-barra"></i></div></div>` + pie;
  }
  return "";
}
function actualizarOperacionHost(z, f, S, ahora) {
  const pon = (k, v) => { const el = z.querySelector(`[data-vivo="${k}"]`); if (el && el.textContent !== v) el.textContent = v; };
  if (f.fase === "hackeo") pon("op-listos", String(listosOperacion(S, f).length));
  if (f.fase === "jefe") {
    const vida = vidaJefe(f, golpesTotales(f));
    pon("op-vida", `${Math.ceil(vida * 100)}%`);
    const barra = z.querySelector('[data-vivo="op-barra"]');
    if (barra) barra.style.width = `${vida * 100}%`;
    pon("op-golpe", vida > 0 ? "¡Golpe final! (rematar ahora)" : "¡Golpe final!");
    const top = z.querySelector('[data-vivo="op-top"]');
    if (top) {
      const h = Object.entries(f.golpes || {}).filter(([id]) => S.agentes && S.agentes[id]).sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([id, n], i) => `<li><span class="pos">${i + 1}</span>${poderHTML(poderDeAgente(S, id))}<span class="nom">${esc(nombreDe(S, id))}</span><span class="val">${fmt(n)}</span></li>`).join("");
      if (top.dataset.h !== h) { top.dataset.h = h; top.innerHTML = h; }
    }
  }
  if (f.fase === "chispa") {
    const m = momentoChispa(f, ahora);
    pon("op-momento", { preparar: `Levanten sus celulares… ${Math.max(1, Math.ceil(-m.t / 1000))}`, viaje: "La energía viaja por la sala", cuenta: "Cuenta regresiva", golpe: "¡Golpe final!", derrota: "¡Derrotado!", oscuro: "La ciudad quedó a oscuras: apaguen las luces" }[m.momento]);
    const b = z.querySelector('[data-vivo="op-velas-boton"]');
    if (b) b.disabled = m.momento !== "derrota" && m.momento !== "oscuro";
  }
  if (f.fase === "creditos") {
    const dur = Number(f.creditosDur) || 60000, p = clamp((ahora - f.creditosT) / dur, 0, 1);
    pon("op-creditos", p >= 1 ? "Créditos terminados" : `Faltan ${Math.ceil((1 - p) * dur / 1000)} segundos`);
    const barra = z.querySelector('[data-vivo="op-creditos-barra"]');
    if (barra) barra.style.width = `${p * 100}%`;
  }
}

/* ---------- agentes de prueba: también pelean ---------- */
function pasoBotsOperacion(T, S, lista, ahora, toca, cuando) {
  const f = S.final;
  if (!esFaseOperacion(f)) return;
  for (const b of lista) {
    if (!(f.listos || {})[b.id] && toca(`op:listo:${f.t}:${b.id}`, ahora, () => (Math.random() < 0.9 ? f.t + azar(5000, 14000) : null))) T.escribir(`final/listos/${b.id}`, T.ahora());
    if (f.fase === "jefe" && (f.listos || {})[b.id]) {
      const ritmo = cuando(`op:ritmo:${f.jefeT}:${b.id}`, () => azar(1.5, 5.5) * (b.bot || 0.6));
      if (toca(`op:g:${f.jefeT}:${b.id}:${Math.floor((ahora - f.jefeT) / 800)}`, ahora, () => ahora + azar(0, 400))) {
        T.escribir(`final/golpes/${b.id}`, Math.round((Number((f.golpes || {})[b.id]) || 0) + ritmo * 0.8));
      }
    }
  }
}
