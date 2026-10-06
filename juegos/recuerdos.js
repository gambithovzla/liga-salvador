/* Mobile photo studio and finale. Images stay local until the guest submits them. */
function fotoLigaValida(src) {
  return typeof src === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src);
}

async function guardarRecuerdoLiga(T, datos, foto, mini) {
  if (!fotoLigaValida(foto) || !fotoLigaValida(mini)) throw new Error("Foto no válida");
  const cambios = {};
  cambios[`fotos/${datos.mid}/${datos.aid}`] = foto;
  cambios[`fotosMini/${datos.mid}/${datos.aid}`] = mini;
  cambios[`recuerdos/${datos.id}`] = {
    mid: datos.mid, aid: datos.aid, autor: datos.autor, nombre: datos.nombre,
    reto: datos.reto || "Un instante de la Liga", t: T.ahora(), estado: "pendiente",
  };
  await T.actualizar("", cambios);
}

function accesoRecuerdosHTML() {
  return `<section class="recuerdo-acceso"><span class="eyebrow">EDICIÓN FUNDADORES</span><h2>Esta historia también es tuya.</h2><p>Las fotos de hoy. Tu portada para siempre.</p><button class="boton bloque" data-accion="estudio-liga">Abrir álbum y crear mi portada ↗</button><span>Desde tu celular · Sin instalar nada</span></section>`;
}

async function imagenRecuerdo(src) {
  if (!fotoLigaValida(src)) throw new Error("Imagen no disponible");
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function dibujarPortadaLiga(canvas, img, datos, ajuste) {
  await Promise.all([document.fonts.load('80px "Bangers"'), document.fonts.load('28px "Anton"')]);
  canvas.width = 1080; canvas.height = 1440;
  const c = canvas.getContext("2d");
  c.fillStyle = "#0b1630"; c.fillRect(0, 0, 1080, 1440);
  const oro = c.createLinearGradient(0, 0, 1080, 1440);
  oro.addColorStop(0, "#fff0bc"); oro.addColorStop(.5, "#d4ac62"); oro.addColorStop(1, "#f8dc96");
  c.strokeStyle = oro; c.lineWidth = 2; c.strokeRect(30, 30, 1020, 1380);
  c.fillStyle = oro; c.font = '23px "Anton", sans-serif'; c.textAlign = "left";
  c.fillText("EDICIÓN FUNDADORES", 70, 86);
  c.textAlign = "right"; c.fillText("N.º 01 / SALVADOR", 1010, 86);
  c.textAlign = "center"; c.font = '100px "Bangers", sans-serif';
  c.fillText("LA LIGA DE SALVADOR", 540, 205, 945);
  c.fillStyle = "#c9d5e8"; c.font = '22px "Anton", sans-serif';
  c.fillText("TODA LEYENDA EMPIEZA CON SU GENTE", 540, 251);
  // Crop at export resolution. Sliders also control the on-screen preview.
  const x = 70, y = 290, w = 940, h = 820;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * ajuste.zoom;
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.drawImage(img, x - (dw - w) * ajuste.x, y - (dh - h) * ajuste.y, dw, dh);
  const sombra = c.createLinearGradient(0, y + h * .6, 0, y + h);
  sombra.addColorStop(0, "#0b163000"); sombra.addColorStop(1, "#0b1630ee");
  c.fillStyle = sombra; c.fillRect(x, y, w, h); c.restore();
  c.strokeStyle = "#d4ac6277"; c.strokeRect(x, y, w, h);
  c.textAlign = "left"; c.fillStyle = "#fff0bc"; c.font = '26px "Anton", sans-serif';
  c.fillText("MIEMBRO DE LA LIGA", 100, 1037);
  c.fillStyle = "#fff8e8"; c.font = '76px "Bangers", sans-serif';
  c.fillText(datos.nombre, 100, 1100, 870);
  c.textAlign = "center"; c.fillStyle = oro; c.font = '29px "Anton", sans-serif';
  c.fillText(String(datos.poder || "Héroe de la Liga").toUpperCase(), 540, 1191, 920);
  c.fillStyle = "#c9d5e8"; c.font = '23px "Anton", sans-serif';
  c.fillText(datos.pos ? `${ordinal(datos.pos)} LUGAR  ·  ${fmt(datos.total)} PUNTOS DE LIGA` : "YO ESTUVE EN EL ORIGEN DE LA LEYENDA", 540, 1240, 920);
  c.fillStyle = oro; c.font = '39px "Bangers", sans-serif';
  c.fillText("UN DÍA. UNA LIGA. PARA SIEMPRE.", 540, 1338);
  c.fillStyle = "#c9d5e8"; c.font = '20px "Anton", sans-serif';
  c.fillText(CONFIG.fechaRecuerdo || "EDICIÓN FUNDADORES", 540, 1380, 900);
}

function abrirEstudioLiga({ T, S, yo, raiz, host = false }) {
  const previo = document.activeElement;
  const modal = document.createElement("div");
  modal.className = "estudio-modal";
  modal.innerHTML = `<section class="estudio-panel" role="dialog" aria-modal="true" aria-labelledby="estudio-titulo"><header class="estudio-cabecera"><div><span class="eyebrow">ARCHIVO DE LA LIGA · N.º 01</span><h2 id="estudio-titulo">${host ? "Curar el álbum" : "Instantes legendarios"}</h2></div><button class="estudio-cerrar" aria-label="Cerrar álbum">×</button></header><div class="estudio-contenido"></div><p class="estudio-estado" role="status" aria-live="polite"></p></section>`;
  raiz.append(modal);
  const panel = modal.querySelector(".estudio-contenido"), estado = modal.querySelector(".estudio-estado");
  let cerrado = false, modo = "album", filtro = host ? "pendientes" : "todos", lista = {}, revision = 0;
  let srcElegida = null, imagen = null, blob = null, editRevision = 0, ocupado = false;
  let ajuste = { x: .5, y: .5, zoom: 1 };
  const cache = new Map();
  const agente = (S.agentes || {})[yo] || { nombre: "Héroe de la Liga" };
  const fila = S.final && (S.final.tabla || []).find(x => x.id === yo);
  const datos = { nombre: agente.nombre, poder: poderDe(agente.poder).nombre, pos: fila && fila.pos, total: fila && fila.total };
  const aviso = texto => { if (!cerrado) estado.textContent = texto; };
  function cerrar() {
    if (ocupado) { aviso("Espera a que termine el envío."); return; }
    cerrado = true; des(); document.removeEventListener("keydown", teclado); modal.remove(); previo?.focus();
  }
  function teclado(e) {
    if (modal.querySelector(".capa-modal")) return;
    if (e.key === "Escape") { e.preventDefault(); cerrar(); }
    if (e.key === "Tab") {
      const items = [...modal.querySelectorAll('button:not(:disabled),input:not([hidden]),a[href]')].filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (!modal.contains(document.activeElement)) { e.preventDefault(); first?.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }
  document.addEventListener("keydown", teclado);
  modal.querySelector(".estudio-cerrar").onclick = cerrar;
  modal.querySelector(".estudio-cerrar").focus();
  const des = T.escuchar("recuerdos", v => { lista = v || {}; if (modo === "album") pintarAlbum(); });
  T.leer("recuerdos").catch(() => aviso("No se pudo cargar el álbum. Revisa tu conexión y vuelve a abrirlo."));
  async function mini(r) {
    const clave = `${r.mid}/${r.aid}/${r.t}`;
    if (!cache.has(clave)) cache.set(clave, T.leer(`fotosMini/${r.mid}/${r.aid}`).then(v => fotoLigaValida(v) ? v : null).catch(() => { cache.delete(clave); return null; }));
    return cache.get(clave);
  }
  function pintarAlbum() {
    const rev = ++revision;
    const todos = Object.entries(lista).sort((a, b) => b[1].t - a[1].t);
    // Una foto retirada por su autor desaparece para los invitados; el anfitrión la ve y puede borrarla.
    const fotos = todos.filter(([, r]) => host ? (filtro === "pendientes" ? r.estado === "pendiente" && !r.retirada : true) : !r.retirada && (filtro === "mias" ? r.autor === yo : r.estado === "aprobada"));
    panel.innerHTML = `<p class="estudio-intro">${host ? "Elige las fotos que verán los invitados en sus celulares y en el gran final. Aprobar una foto no cambia los puntos del juego." : "La gente que convirtió una fiesta en una historia. Solo las fotos aprobadas aparecen en este álbum."}</p>` +
      (!host ? `<button class="boton bloque" data-estudio="elegir">${icono("camara")} Crear mi portada con una foto</button><p class="estudio-local">Puedes descargarla sin subir tu foto.</p>` : "") +
      `<div class="filtros-juegos"><button data-filtro="${host ? "pendientes" : "todos"}" aria-pressed="${filtro === (host ? "pendientes" : "todos")}">${host ? "Por aprobar" : "La Liga"}</button><button data-filtro="${host ? "todos" : "mias"}" aria-pressed="${filtro === (host ? "todos" : "mias")}">${host ? "Todas" : "Mis fotos"}</button></div>` +
      `<div class="archivo-fotos">${fotos.length ? fotos.map(([id, r], i) => `<article class="archivo-foto" data-foto="${esc(id)}"><div class="archivo-imagen"><img alt="${esc(r.reto)} · ${esc(r.nombre)}" loading="lazy"><span>ARCHIVO ${String(i + 1).padStart(2, "0")}</span></div><div class="archivo-pie"><h3>${esc(r.nombre)}</h3><p>${esc(r.reto)}</p>${host || r.autor === yo ? `<small>${r.retirada ? "Retirada por su autor" : r.estado === "aprobada" ? "En el álbum" : r.estado === "rechazada" ? "Fuera del álbum" : "Esperando aprobación"}</small>` : ""}<div class="archivo-acciones">${host ? `<button class="boton chico" data-estudio="aprobar" ${r.estado === "aprobada" ? "disabled" : ""}>Aprobar</button><button class="enlace" data-estudio="rechazar">Retirar del álbum</button>` : `<button class="boton chico blanco" data-estudio="portada">Crear portada</button>`}${host || r.autor === yo ? `<button class="enlace" data-estudio="eliminar">Eliminar foto</button>` : ""}</div></div></article>`).join("") : `<div class="archivo-vacio"><b>✦</b><h3>${filtro === "pendientes" ? "Todo al día" : "El primer recuerdo puede ser tuyo"}</h3><p>${host ? "Aquí llegarán las fotos que envíen los invitados." : filtro === "mias" ? "Las fotos que envíes aparecerán aquí con su estado." : "Crea tu portada o participa en una misión de fotos. El álbum se llena con las fotos aprobadas."}</p></div>`}</div>`;
    for (const [id, r] of fotos) mini(r).then(src => {
      if (cerrado || modo !== "album" || rev !== revision) return;
      const card = [...panel.querySelectorAll("[data-foto]")].find(el => el.dataset.foto === id);
      if (src && card) card.querySelector("img").src = src;
    });
  }
  function elegir() {
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      aviso("Preparando tu foto…");
      try { await abrirEditor(await comprimirFoto(file, 1600, .86)); }
      catch (e) { aviso("No se pudo abrir esa imagen. Prueba una foto JPG, PNG o WebP."); }
    };
    input.click();
  }
  async function abrirEditor(src) {
    imagen = await imagenRecuerdo(src); if (cerrado) return;
    srcElegida = src; blob = null; modo = "editor"; ajuste = { x: .5, y: .5, zoom: 1 };
    panel.innerHTML = `<button class="enlace" data-estudio="volver">← Volver al álbum</button><div class="portada-editor"><canvas class="portada-canvas" aria-label="Vista previa de tu portada personalizada"></canvas><div class="portada-controles"><span class="eyebrow">TU EDICIÓN EXCLUSIVA</span><h3>Un recuerdo para guardar.</h3><p>Ajusta el encuadre. Tu foto sin marco se conserva por separado.</p><label>Acercar<input type="range" data-ajuste="zoom" min="1" max="2.5" step=".05" value="1"></label><label>Mover de lado<input type="range" data-ajuste="x" min="0" max="1" step=".01" value=".5"></label><label>Subir o bajar<input type="range" data-ajuste="y" min="0" max="1" step=".01" value=".5"></label><button class="boton bloque" data-estudio="descargar" disabled>Descargar portada</button><button class="boton blanco bloque" data-estudio="compartir" hidden>Compartir portada</button><button class="enlace" data-estudio="sin-marco">Descargar foto sin marco</button><hr><label class="permiso-album"><input type="checkbox" id="permiso-album">Quiero compartir esta foto con los invitados en el álbum y el final de la Liga.</label><button class="boton azul bloque" data-estudio="enviar" disabled>Enviar para aprobación</button><small>El anfitrión la revisa antes de mostrarla. La portada se crea en tu celular.</small><button class="enlace" data-estudio="elegir">Elegir otra foto</button></div></div>`;
    aviso(""); await renderPortada();
  }
  async function renderPortada() {
    const rev = ++editRevision, canvas = panel.querySelector("canvas");
    const descargar = panel.querySelector('[data-estudio="descargar"]');
    if (!canvas) return;
    blob = null; descargar.disabled = true;
    // Render offscreen so rapid slider changes cannot export an outdated frame.
    const buffer = document.createElement("canvas");
    await dibujarPortadaLiga(buffer, imagen, datos, { ...ajuste });
    const resultado = await new Promise(ok => buffer.toBlob(ok, "image/png"));
    if (cerrado || modo !== "editor" || rev !== editRevision) return;
    canvas.width = buffer.width; canvas.height = buffer.height; canvas.getContext("2d").drawImage(buffer, 0, 0);
    blob = resultado; descargar.disabled = !blob;
    const compartir = panel.querySelector('[data-estudio="compartir"]');
    compartir.hidden = !(blob && navigator.canShare?.({ files: [new File([blob], "mi-portada-liga.png", { type: "image/png" })] }));
  }
  function descargarBlob(valor, nombre) {
    const url = URL.createObjectURL(valor), a = document.createElement("a");
    a.href = url; a.download = nombre; modal.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  panel.addEventListener("input", e => {
    if (e.target.dataset.ajuste) { ajuste[e.target.dataset.ajuste] = Number(e.target.value); renderPortada().catch(() => aviso("No se pudo generar la portada. Intenta otra foto.")); }
    if (e.target.id === "permiso-album") panel.querySelector('[data-estudio="enviar"]').disabled = !e.target.checked || ocupado;
  });
  panel.addEventListener("click", async e => {
    const button = e.target.closest("button"); if (!button || button.disabled || ocupado) return;
    if (button.dataset.filtro) { filtro = button.dataset.filtro; pintarAlbum(); return; }
    const accion = button.dataset.estudio, id = button.closest("[data-foto]")?.dataset.foto, r = lista[id];
    try {
      if (accion === "elegir") elegir();
      if (accion === "volver") { modo = "album"; editRevision++; aviso(""); pintarAlbum(); }
      if (accion === "portada" && r) {
        aviso("Abriendo la foto…");
        await abrirEditor(await T.leer(`fotos/${r.mid}/${r.aid}`));
      }
      if (accion === "descargar" && blob) { descargarBlob(blob, "mi-portada-liga-salvador.png"); aviso("Portada lista. Si tu navegador abre la imagen, mantenla presionada para guardarla."); }
      if (accion === "sin-marco" && srcElegida) descargarBlob(await (await fetch(srcElegida)).blob(), "foto-liga-salvador.jpg");
      if (accion === "compartir" && blob) await navigator.share({ files: [new File([blob], "mi-portada-liga.png", { type: "image/png" })], title: "Mi edición de La Liga de Salvador" });
      if (accion === "enviar" && panel.querySelector("#permiso-album")?.checked) {
        ocupado = true; button.disabled = true; aviso("Enviando tu recuerdo…");
        const key = nuevoId("foto"), small = await comprimirFoto(await (await fetch(srcElegida)).blob(), 320, .72);
        await guardarRecuerdoLiga(T, { id: key, mid: "recuerdos", aid: key, autor: yo, nombre: agente.nombre }, srcElegida, small);
        modo = "album"; filtro = "mias"; pintarAlbum(); aviso("Tu foto llegó. Aparecerá para todos cuando el anfitrión la apruebe.");
      }
      if ((accion === "aprobar" || accion === "rechazar") && host && r) {
        button.disabled = true;
        await T.escribir(`recuerdos/${id}/estado`, accion === "aprobar" ? "aprobada" : "rechazada");
        aviso(accion === "aprobar" ? "Foto incluida en el álbum y el final." : "Foto retirada del álbum y del final.");
      }
      if (accion === "eliminar" && r && (host || r.autor === yo)) {
        if (!await confirmar({ titulo: "¿Eliminar este recuerdo?", texto: "Dejará de aparecer en el álbum y en el final. Las descargas ya guardadas no se pueden retirar.", si: "Eliminar foto" }, modal)) return;
        if (!host) {
          // Solo el anfitrión puede borrar datos: el invitado la retira y desaparece del álbum y del final.
          await T.escribir(`recuerdos/${id}/retirada`, true); aviso("Foto retirada del álbum y del final.");
          return;
        }
        // Keep mission evidence intact; studio-only photos can be removed entirely.
        const cambios = { [`recuerdos/${id}`]: null };
        if (r.mid === "recuerdos") { cambios[`fotos/${r.mid}/${r.aid}`] = null; cambios[`fotosMini/${r.mid}/${r.aid}`] = null; }
        await T.actualizar("", cambios); aviso("Recuerdo eliminado.");
      }
    } catch (err) {
      if (err.name !== "AbortError") aviso(sinPermiso(err) ? TEXTO_SIN_PERMISO : "No se pudo completar. Revisa tu conexión e inténtalo otra vez.");
      if (button.isConnected) button.disabled = false;
    } finally { ocupado = false; }
  });
  pintarAlbum();
}

const DURACIONES_CINE_LIGA = [4500, 5500, 12000, 6500, 6500];
const TOTAL_CINE_LIGA = DURACIONES_CINE_LIGA.reduce((a, b) => a + b, 0);
const NOMBRES_CINE_LIGA = ["La señal", "La ciudad despierta", "Los que estuvieron ahí", "El ascenso", "Nuestra leyenda"];
const cacheFotosCineLiga = new Map();

function miniCineLiga(T, r) {
  const clave = `${r.mid}/${r.aid}/${r.t}`;
  if (!cacheFotosCineLiga.has(clave)) {
    cacheFotosCineLiga.set(clave, T.leer(`fotosMini/${r.mid}/${r.aid}`)
      .then(src => fotoLigaValida(src) ? src : null)
      .catch(() => { cacheFotosCineLiga.delete(clave); return null; }));
  }
  return cacheFotosCineLiga.get(clave);
}

// Every phone derives the same frame from server time. Reopening a tab joins the current scene.
function momentoFinalLiga(f, ahora) {
  if (f.fase !== "historia") return { escena: 0, lote: 0, transcurrido: 0, restante: TOTAL_CINE_LIGA, listo: false };
  const transcurrido = Math.max(0, ahora - (Number(f.escenaT) || ahora));
  let desde = 0;
  for (let escena = 0; escena < DURACIONES_CINE_LIGA.length; escena++) {
    const duracion = DURACIONES_CINE_LIGA[escena];
    if (transcurrido < desde + duracion) {
      return { escena, lote: escena === 2 ? Math.min(3, Math.floor((transcurrido - desde) / 3000)) : 0,
        transcurrido, restante: TOTAL_CINE_LIGA - transcurrido, listo: false };
    }
    desde += duracion;
  }
  return { escena: 4, lote: 0, transcurrido: TOTAL_CINE_LIGA, restante: 0, listo: true };
}
function escenaFinalLiga(f, ahora) { return momentoFinalLiga(f, ahora).escena; }

function ciudadCineLigaHTML() {
  const alturas = [48, 64, 37, 82, 54, 73, 42, 92, 59, 77, 43, 85, 55, 69, 40, 75, 51, 63];
  return `<div class="cine-ciudad-v2" aria-hidden="true"><div class="cine-edificios">${alturas.map((h, i) =>
    `<i style="--alto:${h}%;--demora:${(i % 7) * .12}s"></i>`).join("")}</div><div class="cine-calles"></div></div>`;
}

function finalCineLigaHTML(f, S, yo, ahora) {
  const energia = f.fase === "energia", momento = momentoFinalLiga(f, ahora), escena = momento.escena;
  const aporto = !!(f.energia || {})[yo];
  const aprobadas = Object.entries(S.recuerdos || {}).filter(([, r]) => r.estado === "aprobada" && !r.retirada)
    .sort((a, b) => a[1].t - b[1].t).slice(-8);
  const par = aprobadas.length ? [0, 1].map(i => aprobadas[(momento.lote * 2 + i) % aprobadas.length])
    .filter((r, i) => i === 0 || aprobadas.length > 1) : [];
  const retratos = par.map(([id, r], i) => `<figure class="cine-fotograma" style="--foto:${i}" data-cine-foto="${esc(id)}"><div class="cine-foto-contenedor"><img alt="Foto de ${esc(r.nombre)}"></div><figcaption>${esc(r.nombre)}</figcaption></figure>`).join("");
  const invitados = Object.values(S.agentes || {}).filter(a => a.nombre && !a.bot);
  const nombres = (invitados.length ? invitados : Object.values(S.agentes || {}).filter(a => a.nombre))
    .slice(momento.lote * 6, momento.lote * 6 + 6).map(a => `<span>${esc(a.nombre)}</span>`).join("");
  const salvador = esc(imagenSalva("salvador") || "");
  const miNombre = esc(nombreDe(S, yo));
  const contenido = energia
    ? `<div class="cine-bloque cine-energia"><span class="cine-kicker">TRANSMISIÓN DE EMERGENCIA</span><h1>La ciudad<br><em>nos necesita.</em></h1><p>Todos los héroes tienen una luz. Enciende la tuya.</p><button class="energia-boton cine-boton-energia" data-accion="final-energia" aria-pressed="${aporto}">${icono("escudo")}<span>${aporto ? "Energía enviada" : "Enviar mi energía"}</span></button><p class="energia-conteo" aria-live="polite"><b data-energia-conteo>0</b> héroes conectaron su energía</p><span class="cine-ayuda">Espera aquí. El anfitrión iniciará la película.</span></div>`
    : escena === 0
      ? `<div class="cine-bloque cine-transmision"><div class="cine-radio" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><span class="cine-kicker">SEÑAL RECIBIDA · CAPÍTULO FINAL</span><h1>Escuchen,<br><em>héroes.</em></h1><p>Esta ciudad tiene una historia que contar.</p></div>`
      : escena === 1
        ? `<div class="cine-bloque cine-encendido"><div class="cine-emblema" aria-hidden="true">${icono("escudo")}</div><span class="cine-kicker">LA LIGA RESPONDIÓ</span><h1>La ciudad<br><em>despierta.</em></h1><p>Una luz se convirtió en muchas.</p></div>`
        : escena === 2
          ? `<div class="cine-bloque cine-album"><span class="cine-kicker">ARCHIVO DE LA LIGA · ${String(momento.lote + 1).padStart(2, "0")}/04</span><h1>Los que<br><em>estuvieron ahí.</em></h1>${retratos ? `<div class="cine-fotogramas${par.length === 1 ? " uno" : ""}">${retratos}</div>` : `<div class="cine-nombres">${nombres || `<span>${miNombre}</span>`}</div>`}<p>Ellos hicieron posible la leyenda.</p></div>`
          : escena === 3
            ? `<div class="cine-bloque cine-ascenso"><div class="cine-rayo" aria-hidden="true"></div><img class="cine-heroe" src="${salvador}" alt="Salvador vuela sobre la ciudad"><span class="cine-kicker">EL ORIGEN DE UNA LEYENDA</span><h1>Y entonces<br><em>voló.</em></h1></div>`
            : `<div class="cine-bloque cine-coronacion"><span class="cine-kicker">CAPÍTULO 01 · EL ORIGEN</span><h1>Salvador.</h1><img class="cine-heroe" src="${salvador}" alt="Salvador, protagonista de esta historia"><p>Toda leyenda empieza con quienes estuvieron ahí.</p><strong>${miNombre}, tú eres parte de la Liga.</strong><span class="cine-fin">CONTINUARÁ…</span></div>`;
  const progreso = energia ? 0 : Math.min(100, Math.round(momento.transcurrido / TOTAL_CINE_LIGA * 100));
  return `<section class="final-cine cine-v2 cine-etapa-${energia ? "energia" : escena}" role="region" aria-label="Final cinematográfico de la Liga de Salvador" style="--potencia:${energia ? 0 : 1}">` +
    `<div class="cine-cielo-v2" aria-hidden="true"></div><div class="cine-luna-v2" aria-hidden="true"></div>${ciudadCineLigaHTML()}` +
    `<div class="cine-pelicula"><header class="cine-superior"><span>LA LIGA DE SALVADOR</span><span>EDICIÓN FUNDADORES · 01</span></header><div class="cine-escena" aria-live="polite">${contenido}</div>` +
    `<footer class="cine-inferior"><span>${energia ? "TODOS LOS HÉROES · UNA MISIÓN" : NOMBRES_CINE_LIGA[escena]}</span><span>${energia ? "EN VIVO" : momento.listo ? "FIN DE LA PELÍCULA" : `${Math.ceil(momento.restante / 1000)} S`}</span><div class="cine-progreso" role="progressbar" aria-label="Progreso del final" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progreso}"><i style="width:${progreso}%"></i></div></footer></div></section>` +
    `<div class="cine-pie"><button class="enlace" data-accion="estudio-liga">Ver álbum y crear mi portada</button><button class="enlace" data-accion="sonido">Sonido: ${Sonido.activo ? "sí" : "no"}</button></div>`;
}

function actualizarCineLiga(raiz, T, S, yo) {
  const f = S.final; if (!f) return;
  // Start fetching the next stills during the energy screen, before the film reaches them.
  Object.values(S.recuerdos || {}).filter(r => r.estado === "aprobada" && !r.retirada)
    .sort((a, b) => a.t - b.t).slice(-8).forEach(r => miniCineLiga(T, r));
  const contador = raiz.querySelector("[data-energia-conteo]");
  if (contador) {
    const n = Object.keys(f.energia || {}).filter(id => S.agentes[id]).length;
    contador.textContent = n;
    contador.nextSibling.textContent = n === 1 ? " héroe conectó su energía" : " héroes conectaron su energía";
    const total = Math.max(1, Object.keys(S.agentes || {}).filter(id => S.agentes[id]?.nombre && !S.agentes[id]?.bot).length);
    const cine = raiz.querySelector(".cine-v2");
    if (cine) cine.style.setProperty("--potencia", String(Math.min(1, n / total)));
    const edificios = [...raiz.querySelectorAll(".cine-etapa-energia .cine-edificios i")];
    const encendidos = Math.ceil(Math.min(1, n / total) * edificios.length);
    edificios.forEach((edificio, i) => edificio.classList.toggle("encendido", i < encendidos));
  }
  if (f.fase === "historia") {
    const m = momentoFinalLiga(f, T.ahora());
    const progreso = raiz.querySelector(".cine-progreso");
    if (progreso) {
      const valor = Math.min(100, Math.round(m.transcurrido / TOTAL_CINE_LIGA * 100));
      progreso.setAttribute("aria-valuenow", String(valor));
      progreso.querySelector("i").style.width = `${valor}%`;
    }
    const tiempo = raiz.querySelector(".cine-inferior span:last-of-type");
    if (tiempo) tiempo.textContent = m.listo ? "FIN DE LA PELÍCULA" : `${Math.ceil(m.restante / 1000)} S`;
  }
  const sonido = raiz.querySelector('.cine-pie [data-accion="sonido"]');
  if (sonido) sonido.textContent = `Sonido: ${Sonido.activo ? "sí" : "no"}`;
  const boton = raiz.querySelector('[data-accion="final-energia"]');
  if (boton && (f.energia || {})[yo]) { boton.disabled = true; boton.setAttribute("aria-pressed", "true"); boton.querySelector("span").textContent = "Energía enviada"; }
  for (const figura of raiz.querySelectorAll("[data-cine-foto]:not([data-cargando])")) {
    figura.dataset.cargando = "1";
    const id = figura.dataset.cineFoto, r = (S.recuerdos || {})[id];
    if (!r || r.estado !== "aprobada" || r.retirada) continue;
    miniCineLiga(T, r).then(src => {
      if (figura.isConnected && src && S.recuerdos[id]?.estado === "aprobada" && !S.recuerdos[id]?.retirada) figura.querySelector("img").src = src;
      else if (figura.isConnected) figura.hidden = true;
    });
  }
}

function actualizarControlCineLiga(raiz, f, ahora) {
  const m = momentoFinalLiga(f, ahora);
  const escena = raiz.querySelector("[data-cine-escena]");
  if (escena) escena.textContent = NOMBRES_CINE_LIGA[m.escena];
  const tiempo = raiz.querySelector("[data-cine-tiempo]");
  if (tiempo) tiempo.textContent = m.listo ? "Película terminada" : `Faltan ${Math.ceil(m.restante / 1000)} segundos`;
  const barra = raiz.querySelector("[data-cine-barra]");
  if (barra) barra.style.width = `${Math.min(100, Math.round(m.transcurrido / TOTAL_CINE_LIGA * 100))}%`;
  const boton = raiz.querySelector('[data-accion="final-podio"]');
  if (boton) boton.disabled = !m.listo;
}
