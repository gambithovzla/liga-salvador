/* Firebase rules against the local emulator (never production).
   Start it with: firebase emulators:start --only database,auth --project demo-liga
   using database.rules.json with the admin email. LIGA_ADMIN_EMAIL must match that email. */
const assert = require('node:assert/strict');

const DB = process.env.LIGA_DB_EMULADOR || 'http://127.0.0.1:9000';
const AUTH = process.env.LIGA_AUTH_EMULADOR || 'http://127.0.0.1:9099';
const NS = 'ns=liga-salvador-default-rtdb';
const ADMIN = process.env.LIGA_ADMIN_EMAIL;
assert(ADMIN, 'Set LIGA_ADMIN_EMAIL');
assert(/127\.0\.0\.1|localhost/.test(DB + AUTH), 'Emulator only');
const S = `salas/reglas${Date.now().toString(36)}`;

async function token(email) {
  const claims = JSON.stringify({ sub: `u-${email}`, email, email_verified: true });
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ postBody: `id_token=${encodeURIComponent(claims)}&providerId=google.com`, requestUri: 'http://localhost', returnSecureToken: true }),
  });
  const j = await r.json();
  assert(j.idToken, JSON.stringify(j));
  return j.idToken;
}
async function pedir(metodo, ruta, valor, idToken) {
  const url = `${DB}/${S}/${ruta}.json?${NS}${idToken ? `&auth=${idToken}` : ''}`;
  const r = await fetch(url, { method: metodo, body: valor === undefined ? undefined : JSON.stringify(valor) });
  return r.status;
}
const casos = [];
const si = (desc, m, ruta, v, quien) => casos.push({ desc, m, ruta, v, quien, ok: true });
const no = (desc, m, ruta, v, quien) => casos.push({ desc, m, ruta, v, quien, ok: false });
const img = 'data:image/jpeg;base64,AAAA';

// Guests: playing and creating
si('register an agent', 'PUT', 'agentes/a1', { nombre: 'Ana', poder: 'rayo', codigo: '123', unido: 1 });
si('presence: connected', 'PATCH', 'agentes/a1', { conectado: true, visto: 2 });
si('busy flag on and off', 'PUT', 'agentes/a1/ocupado', true);
si('busy flag removed', 'DELETE', 'agentes/a1/ocupado');
si('claim an agent code', 'PUT', 'codigos/123', 'a1');
si('mission moves', 'PUT', 'mj/m1/res/a1', { v: 300, t: 1 });
si('leave the waiting room', 'DELETE', 'mj/m1/listos/a1');
si('finale: activate power', 'PUT', 'final/listos/a1', 5);
si('finale: hits', 'PUT', 'final/golpes/a1', 12);
si('finale: clock sample', 'PUT', 'final/reloj/a1', { '.sv': 'timestamp' });
si('create a duel', 'PUT', 'duelos/d1', { de: 'a1', a: 'a2', estado: 'pendiente' });
si('duel reaction time', 'PUT', 'duelos/d1/r/a1', 280);
si('duel points (create)', 'PATCH', 'puntos', { 'a1/d_d1': { p: 50, m: 'Duelo', t: 1 } });
si('mission photo', 'PUT', 'fotos/m1/a1', img);
si('mission thumbnail', 'PUT', 'fotosMini/m1/a1', img);
si('same photo again (retry)', 'PUT', 'fotos/m1/a1', img);
si('album submission', 'PUT', 'recuerdos/r1', { mid: 'recuerdos', aid: 'r1', autor: 'a1', nombre: 'Ana', reto: 'x', t: 1, estado: 'pendiente' });
si('author withdraws a photo', 'PUT', 'recuerdos/r1/retirada', true);
si('capsule message', 'PUT', 'capsula/a1/v/v1', { texto: 'Hola Salvador', nombre: 'Ana', publico: true, t: 1 });
si('capsule edit is a new version', 'PUT', 'capsula/a1/v/v2', { texto: 'Hola otra vez', nombre: 'Ana', publico: true, t: 2 });
si('host controls without signing in', 'PUT', 'mision', { id: 'm2', tipo: 'reflejos', fase: 'juego' });
si('history (create)', 'PUT', 'historial/m1', { nombre: 'Reflejos', t: 1 });
si('mark a trivia question', 'PUT', 'trivia/usadas/q3', true);

// Guests: destroying data
no('delete an agent', 'DELETE', 'agentes/a1');
no('replace an agent', 'PUT', 'agentes/a1', { nombre: 'Hacker' });
no('rename an agent', 'PUT', 'agentes/a1/nombre', 'Hacker');
no('agent without a name', 'PUT', 'agentes/a9/conectado', true);
no('delete all agents', 'DELETE', 'agentes');
no('steal an agent code', 'PUT', 'codigos/123', 'a2');
no('delete points', 'DELETE', 'puntos/a1/d_d1');
no('change points', 'PUT', 'puntos/a1/d_d1', { p: 9999, m: 'x', t: 1 });
no('delete all points', 'DELETE', 'puntos');
no('delete history', 'DELETE', 'historial/m1');
no('delete a duel', 'DELETE', 'duelos/d1');
no('delete a photo', 'DELETE', 'fotos/m1/a1');
no('replace a photo', 'PUT', 'fotos/m1/a1', 'data:image/jpeg;base64,BBBB');
no('delete an album entry', 'DELETE', 'recuerdos/r1');
no('approve own photo', 'PUT', 'recuerdos/r1/estado', 'aprobada');
no('delete a capsule message', 'DELETE', 'capsula/a1');
no('overwrite a capsule version', 'PUT', 'capsula/a1/v/v1', { texto: '', nombre: 'x', publico: false, t: 3 });
no('hide a capsule message', 'PUT', 'capsula/a1/oculto', true);
no('capsule for a non-agent', 'PUT', 'capsula/zz/v/v1', { texto: 'x', nombre: 'x', publico: true, t: 1 });
no('wipe the room', 'DELETE', '');

// Admin, signed in
si('admin hides a message', 'PUT', 'capsula/a1/oculto', true, 'admin');
si('admin approves a photo', 'PUT', 'recuerdos/r1/estado', 'aprobada', 'admin');
si('admin deletes an agent', 'DELETE', 'agentes/a1', undefined, 'admin');
si('admin wipes the room', 'DELETE', '', undefined, 'admin');
// Another Google account is just a guest
no('other account wipes the room', 'DELETE', 'agentes', undefined, 'otro');

async function salaDeEnsayo() {
  // Rehearsal rooms ("ensayo…") stay open so rehearsals can clean up after themselves.
  const url = (r) => `${DB}/salas/ensayo-reglas/${r}.json?${NS}`;
  await fetch(url('agentes/a1'), { method: 'PUT', body: JSON.stringify({ nombre: 'Ana' }) });
  const status = (await fetch(url(''), { method: 'DELETE' })).status;
  console.log(`${status === 200 ? 'ok ' : 'FAIL'} allows guest: wipe a rehearsal room (${status})`);
  return status === 200 ? 0 : 1;
}

(async () => {
  const tokens = { admin: await token(ADMIN), otro: await token('otra.persona@example.com') };
  await pedir('PUT', 'agentes/a2', { nombre: 'Beto', poder: 'fuerza', codigo: '456', unido: 2 });
  await pedir('PUT', 'agentes/z1', { nombre: 'Zoe' });
  let fallos = 0;
  for (const c of casos) {
    const status = await pedir(c.m, c.ruta, c.v, c.quien && tokens[c.quien]);
    const paso = (status === 200) === c.ok;
    if (!paso) fallos++;
    console.log(`${paso ? 'ok ' : 'FAIL'} ${c.ok ? 'allows' : 'blocks'} ${c.quien || 'guest'}: ${c.desc} (${status})`);
  }
  await pedir('DELETE', '', undefined, tokens.admin);
  fallos += await salaDeEnsayo();
  assert.equal(fallos, 0, `${fallos} rule checks failed`);
  console.log(`PASS: ${casos.length + 1} rule checks`);
})().catch((e) => { console.error(e); process.exitCode = 1; });
