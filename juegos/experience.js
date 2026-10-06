/* Presentation only. Scoring, rounds and transport stay in index.html. */
const ARTE_JUEGOS = {
  supervelocidad: ["vuelo", "10 segundos", "Destreza"],
  estrellas: ["cosmos", "25 segundos", "Destreza"],
  reflejos: ["rayo", "3 intentos", "Reflejos"],
  villano: ["villano", "20 segundos", "Reflejos"],
  reloj: ["vela", "Un instante perfecto", "Precisión"],
  memoria: ["memoria", "Sigue la secuencia", "Memoria"],
  rescate: ["globos", "20 globos", "Velocidad"],
  capa: ["escudo", "3 intentos", "Precisión"],
  impostor: ["memoria", "5 niveles", "Observación"],
  trivia: ["trivia", "Piensa rápido", "En grupo"],
  relampago: ["rayo", "Una pregunta", "En grupo"],
  cuanto: ["trivia", "Haz tu apuesta", "En grupo"],
  ultimo: ["escudo", "Solo queda uno", "En grupo"],
  carrera: ["vuelo", "Hasta la meta", "En grupo"],
  foto: ["memoria", "Captura el momento", "En la fiesta"],
  charadas: ["trivia", "Sin decir una palabra", "En la fiesta"],
  agente: ["villano", "Misión confidencial", "En la fiesta"],
  duo: ["escudo", "Encuentra a tu aliado", "En la fiesta"],
  bingo: ["globos", "Completa tu cartón", "En la fiesta"],
  infiltrado: ["villano", "¿En quién confías?", "En la fiesta"],
  bomba: ["rayo", "Pásala a tiempo", "En la fiesta"],
};

function arteJuegoHTML(id, iconoNombre) {
  const [mundo] = ARTE_JUEGOS[id] || ["cosmos"];
  const personaje = mundo === "vuelo" || mundo === "cosmos" || mundo === "escudo";
  const src = imagenSalva("salvador");
  return `<span class="game-art art-${mundo}" aria-hidden="true">` +
    `<span class="art-orbita"></span><span class="art-destello"></span><span class="art-ciudad"></span>` +
    (personaje && src ? `<img class="art-personaje" src="${esc(src)}" alt="" loading="lazy" decoding="async">` :
      `<span class="art-emblema">${icono(iconoNombre || "estrella")}</span>`) +
    (mundo === "memoria" ? `<span class="art-naipes"><i></i><i></i><i></i></span>` : "") +
    (mundo === "globos" ? `<span class="art-balloon-group"><i>1</i><i>2</i><i>3</i></span>` : "") +
    `<span class="art-chispa uno">✦</span><span class="art-chispa dos">✦</span><span class="art-chispa tres">✧</span></span>`;
}

function portadaLigaHTML(registro) {
  const src = imagenSalva("salvador");
  return `<section class="hq-hero${registro ? " es-registro" : ""}" aria-label="La Liga de Salvador">` +
    `<div class="hq-orbita" aria-hidden="true"></div><div class="hq-ciudad" aria-hidden="true"></div>` +
    `<div class="hq-marca">${logoHTML()}<span>LA AVENTURA · N.º 01</span></div>` +
    `<div class="hq-copy"><span class="eyebrow">${registro ? "Se buscan pequeños y grandes héroes" : "Bienvenido al cuartel"}</span>` +
    `<h1>${registro ? "CADA HÉROE<br>TIENE SU <em>HISTORIA.</em>" : "HOY SOMOS<br><em>LEYENDAS.</em>"}</h1>` +
    `<p>${registro ? "La de hoy empieza contigo." : "Una ciudad. Una liga. Tu momento."}</p></div>` +
    (src ? `<img class="hq-personaje" src="${esc(src)}" alt="Salvador volando con su traje de superhéroe" fetchpriority="high">` : "") +
    `<span class="hq-coordenadas" aria-hidden="true">BARRANCO · BASE DE LA LIGA <b>✦</b></span></section>`;
}

function resultadoLigaHTML(pos, puntos, titulo) {
  return `<section class="recompensa${puntos < 0 ? " es-perdida" : ""}" aria-label="Tu resultado">` +
    `<div class="recompensa-orbita" aria-hidden="true"></div><span class="recompensa-icono" aria-hidden="true">${icono(pos === 1 ? "trofeo" : "estrella")}</span>` +
    `<span class="eyebrow">MISIÓN COMPLETADA</span><h2>${esc(titulo)}</h2>` +
    `<div class="recompensa-puntos"><b data-contador="${Number(puntos) || 0}">${ptsTexto(puntos)}</b><span>PUNTOS DE LIGA</span></div>` +
    `<span class="recompensa-nota">${pos === 1 ? "Un lugar en la historia de la Liga." : puntos > 0 ? "Cada misión cuenta. Sigue ascendiendo." : "La próxima misión te espera."}</span></section>`;
}

function animarExperiencia(raiz) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const el of raiz.querySelectorAll("[data-contador]")) {
    const fin = Number(el.dataset.contador) || 0;
    let inicio;
    function paso(t) {
      if (!el.isConnected) return;
      if (inicio === undefined) inicio = t;
      const p = Math.min(1, (t - inicio) / 850);
      el.textContent = ptsTexto(Math.round(fin * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  }
}
