/* «Un, dos, tres… ¡Zzz!»: luz roja, luz verde con el Doctor Siesta.
   Mientras el Doctor Siesta duerme, todos avanzan (moviendo el celular o manteniendo el botón).
   Cuando abre los ojos, hay que quedarse quieto: si te ve moverte, retrocedes.
   Las fases salen de una semilla y del reloj compartido: todos los celulares ven lo mismo a la vez.
   Cada celular escribe solo lo suyo: mj/{id}/p/{agente}, mj/{id}/vistos/{agente}, mj/{id}/llegada/{agente}, mj/{id}/fx/{agente}. */

const ZZZ_PREVIA = 4000;          // «¿Listos?» antes de la primera siesta
const ZZZ_CUENTA = 1500;          // «un… dos… tres…»: todavía se puede avanzar
const ZZZ_GRACIA = 450;           // al abrir los ojos, un instante para frenar
const ZZZ_VELOCIDAD = 100 / 22000; // 100 % en 22 s de siesta, sin que te atrapen
const ZZZ_CASTIGO = 25;           // lo que retrocedes si te ve moverte
const ZZZ_DURACION = 180000;
const ZZZ_GANADORES = 3;          // termina cuando llegan 3 (o todos)

// El plan de fases: duerme (3 a 6,5 s) → cuenta → mira (2,2 a 4 s) → duerme…
const cachePlanZzz = new Map();
function planZzz(semilla) {
  if (cachePlanZzz.has(semilla)) return cachePlanZzz.get(semilla);
  const azarZ = azarSemilla(semilla);
  const fases = [{ tipo: "previa", desde: 0, hasta: ZZZ_PREVIA }];
  let t = ZZZ_PREVIA;
  while (t < ZZZ_DURACION + 20000) {
    const duerme = 3000 + azarZ() * 3500, mira = 2200 + azarZ() * 1800;
    fases.push({ tipo: "duerme", desde: t, hasta: t + duerme }); t += duerme;
    fases.push({ tipo: "cuenta", desde: t, hasta: t + ZZZ_CUENTA }); t += ZZZ_CUENTA;
    fases.push({ tipo: "mira", desde: t, hasta: t + mira }); t += mira;
  }
  cachePlanZzz.set(semilla, fases);
  return fases;
}
function faseZzz(sub, ahora) {
  const t = ahora - sub.inicio;
  if (t < 0) return { tipo: "previa", desde: -1e9, hasta: 0, t };
  const f = planZzz(sub.semilla).find((x) => t >= x.desde && t < x.hasta) || { tipo: "mira", desde: t, hasta: t + 1 };
  return Object.assign({ t }, f);
}
function zzzJugadores(ctx) { return (ctx.m.sub.jugadores || []).filter((id) => ctx.S.agentes[id]); }
function zzzTabla(ctx) {
  const p = (ctx.mj && ctx.mj.p) || {}, ll = (ctx.mj && ctx.mj.llegada) || {}, vistos = (ctx.mj && ctx.mj.vistos) || {};
  return zzzJugadores(ctx).map((id) => ({ id, p: ll[id] ? 100 : Number(p[id]) || 0, llegada: Number(ll[id]) || 0, vistos: Number(vistos[id]) || 0 }))
    .sort((a, b) => (a.llegada && b.llegada ? a.llegada - b.llegada : a.llegada ? -1 : b.llegada ? 1 : b.p - a.p));
}
function zzzTextoFase(f) {
  if (f.tipo === "previa") return { titulo: "¿LISTOS?", sub: "Cuando el Doctor Siesta duerma, avancen" };
  if (f.tipo === "duerme") return { titulo: "¡AVANCEN!", sub: "El Doctor Siesta ronca…" };
  if (f.tipo === "cuenta") { const k = Math.min(2, Math.floor((f.t - f.desde) / (ZZZ_CUENTA / 3))); return { titulo: ["UN…", "UN, DOS…", "UN, DOS, TRES…"][k], sub: "¡Está por despertar!" }; }
  return { titulo: "¡QUIETOS!", sub: "Si te mueves, te ve" };
}

function tipoZzz() {
  return {
    id: "zzz", nombre: "Un, dos, tres… ¡Zzz!", icono: "ojo", cat: "fiesta", usaSala: true,
    resumen: "Luz roja, luz verde con el Doctor Siesta: avanza mientras duerme y quédate quieto cuando abre los ojos.",
    ayuda: "Mientras el Doctor Siesta duerme, avanza moviendo el celular o manteniendo el botón. Cuando dice «un, dos, tres» y abre los ojos, quédate quieto: si te ve moverte, retrocedes. Gana quien llega primero hasta su almohada.",
    pasos: ["Mientras el Doctor Siesta duerme, camina con el celular en la mano o mantén presionado el botón: así avanzas.", "Cuando cuente «un, dos, tres…» y abra los ojos, ¡quieto! Suelta el botón y no muevas el celular.", "Si te ve moverte, retrocedes. Gana quien llega primero hasta su almohada."],
    practica: "zzz",
    campos: [],
    empezar(ctx) {
      const jugadores = listosDe(ctx);
      if (!jugadores.length) { avisar("Primero tiene que haber agentes listos."); return false; }
      const inicio = ctx.ahora() + 3000;
      ctx.T.actualizar("mision", { fase: "juego", sub: { inicio, limite: inicio + ZZZ_DURACION, jugadores, semilla: Math.floor(Math.random() * 1e9) } });
      return true;
    },
    cerrar(ctx) {
      const filas = zzzTabla(ctx).map((c) => ({ id: c.id, v: c.llegada ? c.llegada : 1e9 - c.p * 1000, llegada: c.llegada, p: c.p, vistos: c.vistos }));
      ctx.premiar(rankear(filas, true, 1).map((e) => ({ id: e.id, pos: e.pos, pts: e.pts,
        txt: e.llegada ? `llegó en ${(e.llegada / 1000).toFixed(1).replace(".", ",")} s` : `${Math.round(e.p)} % del camino${e.vistos ? ` · lo vio ${e.vistos === 1 ? "1 vez" : e.vistos + " veces"}` : ""}` })));
    },
    host: {
      clave(ctx) { return `zzz:${faseZzz(ctx.m.sub, ctx.ahora()).tipo}`; },
      html(ctx) {
        const f = faseZzz(ctx.m.sub, ctx.ahora()), txt = zzzTextoFase(f);
        return `<section class="zz-tv zz-${f.tipo}"><div class="zz-jefe">${jefeSVG(f.tipo === "mira" ? "" : "dormido")}</div>` +
          `<div class="zz-fase"><b data-vivo="zz-titulo">${txt.titulo}</b><small>${txt.sub}</small></div>` +
          `<ol class="zz-pista" data-vivo="zz-pista"></ol><div class="zz-relato" data-vivo="zz-relato" aria-live="polite"></div></section>` +
          `<section class="pagina"><span class="cap" data-vivo="zz-reloj">Un, dos, tres…</span><p class="suave">Lee en voz alta lo que dice la pantalla: «¡Avancen!» y «¡Quietos!».</p>` +
          `<button class="boton blanco" data-accion="cerrar-ya">Terminar y dar puntos</button></section>`;
      },
      actualizar(ctx, raiz) {
        const s = ctx.m.sub, ahora = ctx.ahora(), f = faseZzz(s, ahora), L = ctx.local;
        const tit = $('[data-vivo="zz-titulo"]', raiz);
        if (tit) { const t = zzzTextoFase(f).titulo; if (tit.textContent !== t) tit.textContent = t; }
        const r = $('[data-vivo="zz-reloj"]', raiz);
        if (r) r.textContent = ahora < s.inicio ? `Empieza en ${Math.ceil((s.inicio - ahora) / 1000)}` : `En juego · ${reloj(ahora - s.inicio)}`;
        const pista = $('[data-vivo="zz-pista"]', raiz);
        if (pista) {
          const h = zzzTabla(ctx).slice(0, 10).map((c) => `<li class="${c.llegada ? "llego" : ""}"><span>${esc(nombreDe(ctx.S, c.id))}</span><i style="--p:${c.p.toFixed(1)}%">${poderHTML(poderDeAgente(ctx.S, c.id))}</i></li>`).join("");
          if (pista.dataset.h !== h) { pista.dataset.h = h; pista.innerHTML = h; }
        }
        // Relato: a quién vio el Doctor Siesta y quién llegó.
        const fx = (ctx.mj && ctx.mj.fx) || {};
        L.fxVistos = L.fxVistos || {};
        for (const [id, x] of Object.entries(fx)) {
          if (!x || !x.t || L.fxVistos[id] === x.t || ahora - x.t > 4000) continue;
          L.fxVistos[id] = x.t;
          const rel = $('[data-vivo="zz-relato"]', raiz);
          if (rel) {
            const p = document.createElement("p");
            p.textContent = x.k === "llego" ? `¡${nombreDe(ctx.S, id)} llegó a la almohada!` : `¡Te vi, ${nombreDe(ctx.S, id)}!`;
            p.className = x.k === "llego" ? "bien" : "";
            rel.prepend(p);
            while (rel.children.length > 3) rel.lastChild.remove();
          }
          Sonido.tocar(x.k === "llego" ? "exito" : "teVi");
        }
        zzzSonidos(L, f);
      },
      click(accion, el, ctx) { if (accion === "cerrar-ya") ctx.cerrarMision(); },
      tic(ctx) {
        const s = ctx.m.sub, ahora = ctx.ahora(), t = zzzTabla(ctx);
        const llegados = t.filter((c) => c.llegada);
        const meta = Math.min(ZZZ_GANADORES, t.length);
        const ultimo = llegados.length ? Math.max(...llegados.map((c) => s.inicio + c.llegada)) : 0;
        if (ahora > s.limite || (t.length && llegados.length >= meta && ahora - ultimo > 4000)) ctx.cerrarMision();
      },
    },
    jugador: {
      clave(ctx) {
        const s = ctx.m.sub;
        if (!s.jugadores.includes(ctx.yo)) return "fuera";
        // La fase no cambia la clave: así el botón que mantienes presionado nunca se reemplaza.
        return `zzz:${ctx.local.llego ? 1 : 0}`;
      },
      html(ctx) {
        const s = ctx.m.sub;
        if (!s.jugadores.includes(ctx.yo)) return `<section class="pagina"><span class="cap">En curso</span><p>Este juego empezó sin ti. ¡Mira cómo se congelan todos!</p></section><button class="boton bloque" data-accion="cuartel">Volver al cuartel</button>`;
        const f = faseZzz(s, ctx.ahora()), txt = zzzTextoFase(f), L = ctx.local;
        if (L.llego) {
          return `<section class="zz-tv zz-llego"><div class="zz-almohada" aria-hidden="true"></div><div class="zz-fase"><b>¡LLEGASTE!</b><small>${(L.llego / 1000).toFixed(1).replace(".", ",")} s hasta la almohada del Doctor Siesta</small></div></section>` +
            `<button class="boton bloque" data-accion="cuartel">Volver al cuartel</button>`;
        }
        return `<section class="zz-tv zz-${f.tipo} zz-celular" data-zz><div class="zz-jefe">${jefeSVG(f.tipo === "mira" ? "" : "dormido")}</div>` +
          `<div class="zz-fase"><b data-zz-titulo>${txt.titulo}</b><small>${txt.sub}</small></div>` +
          `<div class="zz-barra" aria-label="Tu camino hasta la almohada"><i data-zz-barra></i><span class="zz-yo" data-zz-yo>${poderHTML(poderDeAgente(ctx.S, ctx.yo))}</span><span class="zz-meta" aria-hidden="true"></span></div>` +
          `<p class="zz-pct" data-zz-pct>0 %</p><div class="zz-visto" data-zz-visto hidden><b>¡TE VI!</b><small>Retrocedes</small></div></section>` +
          `<button class="zz-caminar" data-zz-caminar><span>MANTÉN PARA CAMINAR</span><small>o camina con el celular en la mano</small></button>` +
          (L.sensores ? "" : `<button class="enlace centro" data-zz-sensores>Usar el movimiento del celular</button>`);
      },
      entrar(ctx) { zzzEscucharMovimiento(ctx.local); },
      actualizar(ctx, raiz) { zzzActualizarJugador(ctx, raiz); },
      salir(ctx) { zzzDejarMovimiento(ctx.local); },
    },
  };
}

/* ---------- sonidos del centro de mando: ronquidos, la cuenta y el despertar ---------- */
function zzzSonidos(L, f) {
  const clave = `${f.tipo}:${f.desde}`;
  if (L.sonidoFase === clave) return;
  L.sonidoFase = clave;
  if (f.tipo === "duerme") Sonido.tocar("ronquido");
  if (f.tipo === "cuenta") Sonido.tocar("cuentaZzz");
  if (f.tipo === "mira") Sonido.tocar("quietos");
}

/* ---------- el movimiento del celular ---------- */
function zzzEscucharMovimiento(L) {
  if (L.oyente) return;
  L.mov = 0;
  L.oyente = (e) => {
    const a = e.acceleration && typeof e.acceleration.x === "number" ? e.acceleration : null;
    const g = e.accelerationIncludingGravity && typeof e.accelerationIncludingGravity.x === "number" ? e.accelerationIncludingGravity : null;
    // Algunos navegadores mandan el evento vacío (sin sensor): eso no es movimiento.
    if (!a && !g) return;
    const m = a ? Math.hypot(a.x || 0, a.y || 0, a.z || 0) : Math.abs(Math.hypot(g.x || 0, g.y || 0, g.z || 0) - 9.81);
    // Suavizado: un empujón aislado no cuenta, caminar sí.
    L.mov = L.mov * 0.8 + m * 0.2;
    if (m > 0.3) L.sensores = true;
  };
  window.addEventListener("devicemotion", L.oyente);
}
function zzzDejarMovimiento(L) {
  if (L.oyente) window.removeEventListener("devicemotion", L.oyente);
  L.oyente = null;
}
function zzzMoviendo(L) { return !!L.apretado || (!!L.sensores && L.mov > 1.1); }

/* ---------- celular ---------- */
function zzzActualizarJugador(ctx, raiz) {
  const s = ctx.m.sub, L = ctx.local;
  if (!s.jugadores.includes(ctx.yo) || L.llego) return;
  const sec = $("[data-zz]", raiz);
  if (!sec) return;
  if (L.p === undefined) {
    L.p = Number((((ctx.mj && ctx.mj.p) || {})[ctx.yo])) || 0;
    L.vistos = Number((((ctx.mj && ctx.mj.vistos) || {})[ctx.yo])) || 0;
  }
  if (!L.enlazado || L.enlazado !== sec) {
    L.enlazado = sec;
    const boton = $("[data-zz-caminar]", raiz);
    if (boton) {
      const soltar = () => { L.apretado = false; boton.classList.remove("apretado"); };
      boton.addEventListener("pointerdown", (e) => { e.preventDefault(); L.apretado = true; boton.classList.add("apretado"); try { boton.setPointerCapture(e.pointerId); } catch (x) { /* nada */ } });
      boton.addEventListener("pointerup", soltar);
      boton.addEventListener("pointercancel", soltar);
      boton.addEventListener("lostpointercapture", soltar);
      boton.addEventListener("contextmenu", (e) => e.preventDefault());
      document.addEventListener("pointerup", soltar);
    }
    const sens = $("[data-zz-sensores]", raiz);
    if (sens) sens.addEventListener("click", () => { pedirSensoresOperacion().then(() => { zzzEscucharMovimiento(L); sens.textContent = "Movimiento activado: camina con el celular"; }); });
  }
  if (!L.motor) {
    // Un bucle propio, más fino que el refresco de la pantalla, para medir el avance y el movimiento.
    let ultimo = performance.now();
    const paso = () => {
      const f2 = ctx.fresco ? ctx.fresco() : ctx;
      if (!f2 || !f2.m || f2.m.tipo !== "zzz" || L.llego || !L.motor) { L.motor = 0; return; }
      const ahora = f2.ahora(), dt = Math.min(100, performance.now() - ultimo);
      ultimo = performance.now();
      zzzPaso(f2, L, ahora, dt);
      L.motor = requestAnimationFrame(paso);
    };
    L.motor = requestAnimationFrame(paso);
  }
}
// Cambia la escena según la fase sin repintar: título, ojos del Doctor Siesta, color y sonido.
function zzzPintarFase(sec, L, f) {
  const txt = zzzTextoFase(f);
  const tit = $("[data-zz-titulo]", sec), sub = $(".zz-fase small", sec);
  if (tit && tit.textContent !== txt.titulo) tit.textContent = txt.titulo;
  if (sub && sub.textContent !== txt.sub) sub.textContent = txt.sub;
  const clave = `${f.tipo}:${f.desde}`;
  if (L.faseVista === clave) return;
  const antes = L.faseVista;
  L.faseVista = clave;
  ["previa", "duerme", "cuenta", "mira"].forEach((t) => sec.classList.toggle("zz-" + t, t === f.tipo));
  const jefe = $(".op-villano", sec);
  if (jefe) jefe.classList.toggle("dormido", f.tipo !== "mira");
  if (!antes) return;
  if (f.tipo === "mira") { vibrar([80, 60, 80]); Sonido.tocar("quietos"); }
  if (f.tipo === "duerme") Sonido.tocar("ronquido");
  if (f.tipo === "cuenta") Sonido.tocar("cuentaZzz");
}
function zzzPaso(ctx, L, ahora, dt) {
  const s = ctx.m.sub, f = faseZzz(s, ahora);
  const sec = $("[data-zz]", ctx.raiz);
  const moviendo = zzzMoviendo(L);
  const castigado = (L.vistoHasta || 0) > performance.now();
  if (!castigado && (f.tipo === "duerme" || f.tipo === "cuenta") && moviendo) L.p = Math.min(100, L.p + ZZZ_VELOCIDAD * dt);
  // ¡Te vi! Pasado el instante de gracia, cualquier movimiento te hace retroceder.
  if (!castigado && f.tipo === "mira" && f.t - f.desde > ZZZ_GRACIA && moviendo && L.vistoEn !== f.desde) {
    L.vistoEn = f.desde;
    L.p = Math.max(0, L.p - ZZZ_CASTIGO);
    L.vistos = (L.vistos || 0) + 1;
    L.vistoHasta = performance.now() + 1400;
    L.apretado = false;
    ctx.T.escribir(`mj/${ctx.m.id}/vistos/${ctx.yo}`, L.vistos);
    ctx.T.escribir(`mj/${ctx.m.id}/fx/${ctx.yo}`, { k: "visto", t: ahora });
    ctx.T.escribir(`mj/${ctx.m.id}/p/${ctx.yo}`, Math.round(L.p));
    vibrar([300, 80, 300]);
    Sonido.tocar("teVi");
  }
  if (L.p >= 100 && !L.llego) {
    L.llego = Math.max(1, Math.round(ahora - s.inicio));
    ctx.T.escribir(`mj/${ctx.m.id}/llegada/${ctx.yo}`, L.llego);
    ctx.T.escribir(`mj/${ctx.m.id}/p/${ctx.yo}`, 100);
    ctx.T.escribir(`mj/${ctx.m.id}/fx/${ctx.yo}`, { k: "llego", t: ahora });
    Sonido.tocar("fanfarria");
    vibrar([60, 40, 60, 40, 200]);
    confeti(ctx.raiz);
    ctx.pintar();
    return;
  }
  if (!L.ultimoEnvio || performance.now() - L.ultimoEnvio > 300) {
    const v = Math.round(L.p);
    if (v !== L.enviado) { L.enviado = v; L.ultimoEnvio = performance.now(); ctx.T.escribir(`mj/${ctx.m.id}/p/${ctx.yo}`, v); }
  }
  if (!sec) return;
  zzzPintarFase(sec, L, f);
  const barra = $("[data-zz-barra]", sec), yo = $("[data-zz-yo]", sec), pct = $("[data-zz-pct]", sec), visto = $("[data-zz-visto]", sec);
  if (barra) barra.style.width = `${L.p.toFixed(1)}%`;
  if (yo) yo.style.left = `${L.p.toFixed(1)}%`;
  if (pct) { const t = `${Math.floor(L.p)} %`; if (pct.textContent !== t) pct.textContent = t; }
  if (visto) visto.hidden = !castigado;
  sec.classList.toggle("caminando", moviendo && !castigado && f.tipo !== "mira");
}

/* ---------- práctica: un ciclo de siesta que no cuenta ---------- */
function practicaZzz(el) {
  el.innerHTML = `<div class="zz-practica"><div class="zz-p-estado" data-p-estado>Duerme…</div><div class="zz-barra"><i data-p-barra></i></div>` +
    `<button class="zz-caminar" data-p-caminar><span>MANTÉN PARA CAMINAR</span><small>Suelta cuando abra los ojos</small></button><p class="suave" data-p-nota>Avanza mientras duerme.</p></div>`;
  const estado = $("[data-p-estado]", el), barra = $("[data-p-barra]", el), boton = $("[data-p-caminar]", el), nota = $("[data-p-nota]", el);
  let p = 0, apretado = false, raf = 0, t0 = performance.now(), ultimo = t0, visto = 0;
  boton.addEventListener("pointerdown", (e) => { e.preventDefault(); apretado = true; boton.classList.add("apretado"); });
  const soltar = () => { apretado = false; boton.classList.remove("apretado"); };
  boton.addEventListener("pointerup", soltar);
  boton.addEventListener("pointerleave", soltar);
  function paso(t) {
    const dt = Math.min(100, t - ultimo); ultimo = t;
    const ciclo = (t - t0) % 6000, mira = ciclo > 4000;
    estado.textContent = mira ? "¡QUIETO! Abrió los ojos" : ciclo > 3000 ? "Un, dos, tres…" : "Duerme… ¡avanza!";
    estado.className = "zz-p-estado" + (mira ? " mira" : "");
    if (!mira && apretado) p = Math.min(100, p + dt * 0.012);
    if (mira && ciclo > 4000 + ZZZ_GRACIA && apretado && visto !== Math.floor((t - t0) / 6000)) {
      visto = Math.floor((t - t0) / 6000);
      p = Math.max(0, p - ZZZ_CASTIGO);
      nota.textContent = "¡Te vio! Suelta el botón cuando abra los ojos.";
      Sonido.tocar("teVi");
      vibrar(200);
    }
    if (p >= 100) { nota.textContent = "¡Así se juega! En el juego, gana quien llega primero."; p = 0; Sonido.tocar("exito"); }
    barra.style.width = p + "%";
    raf = requestAnimationFrame(paso);
  }
  raf = requestAnimationFrame(paso);
  return () => cancelAnimationFrame(raf);
}
