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
    const fotos = todos.filter(([, r]) => host ? (filtro === "pendientes" ? r.estado === "pendiente" : true) : (filtro === "mias" ? r.autor === yo : r.estado === "aprobada"));
    panel.innerHTML = `<p class="estudio-intro">${host ? "Elige las fotos que verán los invitados en sus celulares y en el gran final. Aprobar una foto no cambia los puntos del juego." : "La gente que convirtió una fiesta en una historia. Solo las fotos aprobadas aparecen en este álbum."}</p>` +
      (!host ? `<button class="boton bloque" data-estudio="elegir">${icono("camara")} Crear mi portada con una foto</button><p class="estudio-local">Puedes descargarla sin subir tu foto.</p>` : "") +
      `<div class="filtros-juegos"><button data-filtro="${host ? "pendientes" : "todos"}" aria-pressed="${filtro === (host ? "pendientes" : "todos")}">${host ? "Por aprobar" : "La Liga"}</button><button data-filtro="${host ? "todos" : "mias"}" aria-pressed="${filtro === (host ? "todos" : "mias")}">${host ? "Todas" : "Mis fotos"}</button></div>` +
      `<div class="archivo-fotos">${fotos.length ? fotos.map(([id, r], i) => `<article class="archivo-foto" data-foto="${esc(id)}"><div class="archivo-imagen"><img alt="${esc(r.reto)} · ${esc(r.nombre)}" loading="lazy"><span>ARCHIVO ${String(i + 1).padStart(2, "0")}</span></div><div class="archivo-pie"><h3>${esc(r.nombre)}</h3><p>${esc(r.reto)}</p>${host || r.autor === yo ? `<small>${r.estado === "aprobada" ? "En el álbum" : r.estado === "rechazada" ? "Fuera del álbum" : "Esperando aprobación"}</small>` : ""}<div class="archivo-acciones">${host ? `<button class="boton chico" data-estudio="aprobar" ${r.estado === "aprobada" ? "disabled" : ""}>Aprobar</button><button class="enlace" data-estudio="rechazar">Retirar del álbum</button>` : `<button class="boton chico blanco" data-estudio="portada">Crear portada</button>`}${host || r.autor === yo ? `<button class="enlace" data-estudio="eliminar">Eliminar foto</button>` : ""}</div></div></article>`).join("") : `<div class="archivo-vacio"><b>✦</b><h3>${filtro === "pendientes" ? "Todo al día" : "El primer recuerdo puede ser tuyo"}</h3><p>${host ? "Aquí llegarán las fotos que envíen los invitados." : filtro === "mias" ? "Las fotos que envíes aparecerán aquí con su estado." : "Crea tu portada o participa en una misión de fotos. El álbum se llena con las fotos aprobadas."}</p></div>`}</div>`;
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
        // Keep mission evidence intact; studio-only photos can be removed entirely.
        if (!await confirmar({ titulo: "¿Eliminar este recuerdo?", texto: "Dejará de aparecer en el álbum y en el final. Las descargas ya guardadas no se pueden retirar.", si: "Eliminar foto" }, modal)) return;
        const cambios = { [`recuerdos/${id}`]: null };
        if (r.mid === "recuerdos") { cambios[`fotos/${r.mid}/${r.aid}`] = null; cambios[`fotosMini/${r.mid}/${r.aid}`] = null; }
        await T.actualizar("", cambios); aviso("Recuerdo eliminado.");
      }
    } catch (err) {
      if (err.name !== "AbortError") aviso("No se pudo completar. Revisa tu conexión e inténtalo otra vez.");
      if (button.isConnected) button.disabled = false;
    } finally { ocupado = false; }
  });
  pintarAlbum();
}

function escenaFinalLiga(f, ahora) {
  return f.fase === "historia" ? Math.min(2, Math.max(0, Math.floor((ahora - f.escenaT) / 6000))) : 0;
}

function finalCineLigaHTML(f, S, yo, ahora) {
  const energia = f.fase === "energia", escena = escenaFinalLiga(f, ahora);
  const aporto = !!(f.energia || {})[yo];
  const fotos = Object.entries(S.recuerdos || {}).filter(([, r]) => r.estado === "aprobada").sort((a, b) => a[1].t - b[1].t).slice(-4);
  const retratos = fotos.map(([id, r], i) => `<figure class="cine-recuerdo" style="--i:${i}" data-cine-foto="${esc(id)}"><img alt="${esc(r.nombre)}"><figcaption>${esc(r.nombre)}</figcaption></figure>`).join("");
  return `<section class="final-cine escena-${energia ? "energia" : escena}"><div class="cine-aura"></div><div class="cine-ciudad" aria-hidden="true"></div><span class="eyebrow">LA LIGA DE SALVADOR · GRAN FINAL</span>` +
    (energia ? `<div class="cine-texto"><span class="cine-numero">ÚLTIMA MISIÓN</span><h1>La ciudad<br>nos necesita.</h1><p>Cada héroe enciende una parte de esta historia. Envía tu energía desde aquí.</p></div><button class="energia-boton" data-accion="final-energia" aria-pressed="${aporto}">${icono("escudo")}<span>${aporto ? "Energía enviada" : "Enviar mi energía"}</span></button><p class="energia-conteo" aria-live="polite"><b data-energia-conteo>0</b> héroes conectaron su energía</p><p class="cine-espera">El anfitrión encenderá la ciudad. Puedes quedarte en esta pantalla.</p>` :
      escena === 0 ? `<div class="cine-texto"><span class="cine-numero">CAPÍTULO FINAL</span><h1>Toda leyenda<br>empieza con<br><em>su gente.</em></h1><p>Hoy, esa gente eres tú.</p></div><div class="cine-linea"></div>` :
      escena === 1 ? `<div class="cine-texto"><span class="cine-numero">LOS QUE ESTUVIERON AHÍ</span><h1>Nuestra liga.<br>Para siempre.</h1></div>${fotos.length ? `<div class="cine-mosaico${fotos.length === 1 ? " unica" : ""}">${retratos}</div>` : `<div class="cine-nombres">${Object.values(S.agentes || {}).filter(a => a.nombre).slice(0, 30).map(a => `<span>${esc(a.nombre)}</span>`).join("")}</div>`}` :
      `<img class="cine-salvador" src="${esc(imagenSalva("salvador"))}" alt="Salvador, el héroe de esta historia"><div class="cine-texto cine-revelacion"><span class="cine-numero">EL ORIGEN DE UNA LEYENDA</span><h1>Salvador.</h1><p>Gracias por ser parte de su historia.</p></div><p class="cine-espera">A continuación: los héroes de la Liga.</p>`) +
    `</section><div class="cine-pie"><button class="enlace" data-accion="estudio-liga">Ver álbum y crear mi portada</button><button class="enlace" data-accion="sonido">Sonido: ${Sonido.activo ? "sí" : "no"}</button></div>`;
}

function actualizarCineLiga(raiz, T, S, yo) {
  const f = S.final; if (!f) return;
  const contador = raiz.querySelector("[data-energia-conteo]");
  if (contador) {
    const n = Object.keys(f.energia || {}).filter(id => S.agentes[id]).length;
    contador.textContent = n;
    contador.nextSibling.textContent = n === 1 ? " héroe conectó su energía" : " héroes conectaron su energía";
  }
  const sonido = raiz.querySelector('.cine-pie [data-accion="sonido"]');
  if (sonido) sonido.textContent = `Sonido: ${Sonido.activo ? "sí" : "no"}`;
  const boton = raiz.querySelector('[data-accion="final-energia"]');
  if (boton && (f.energia || {})[yo]) { boton.disabled = true; boton.setAttribute("aria-pressed", "true"); boton.querySelector("span").textContent = "Energía enviada"; }
  for (const figura of raiz.querySelectorAll("[data-cine-foto]:not([data-cargando])")) {
    figura.dataset.cargando = "1";
    const id = figura.dataset.cineFoto, r = (S.recuerdos || {})[id];
    if (!r || r.estado !== "aprobada") continue;
    T.leer(`fotosMini/${r.mid}/${r.aid}`).then(src => { if (figura.isConnected && fotoLigaValida(src) && S.recuerdos[id]?.estado === "aprobada") figura.querySelector("img").src = src; }).catch(() => { figura.hidden = true; });
  }
}
