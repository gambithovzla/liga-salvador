# Álbum, portadas y final para celulares

No se necesita TV. El anfitrión controla todo desde **Marcador** en su celular.

1. Los invitados abren **Abrir álbum y crear mi portada** en el cuartel. Pueden elegir una foto de su teléfono, ajustar el encuadre y descargar una portada PNG de 1080 × 1440. Se genera localmente; elegir una foto no la sube.
2. Para compartirla en el álbum, marcan la casilla y pulsan **Enviar para aprobación**. Las misiones de fotos tienen una casilla equivalente, opcional; no marcarla no afecta los puntos.
3. El anfitrión entra en **Marcador → Revisar y aprobar fotos**. Solo los recuerdos aprobados se muestran en el álbum de los invitados y en el final. Puede retirarlos después. Cada invitado también puede eliminar sus recuerdos.
4. Desde el cuartel, cada invitado puede escribir un **mensaje para el Salvador de 18 años** (cápsula del tiempo). Si marca la casilla, puede aparecer en los créditos del final.
5. **Comenzar el gran final** inicia la *Operación Primer Vuelo*. El anfitrión avanza cada momento desde **Misión**:
   1. **Hackeo.** Todos los celulares se ponen rojos y vibran. El Doctor Siesta le habla a cada invitado por su nombre, con un dato real de su noche: su mejor reflejo, los duelos o las misiones que ganó, si le explotó la bomba, y una burla según su poder. Cada invitado toca **Activar mi poder**. Ese toque pide el permiso de movimiento en iPhone y habilita el sonido.
   2. **Batalla.** Hay una sola barra de vida para todos. Cada poder ataca de una forma: *Súper fuerza*, *Vuelo* y *Risa* sacuden el celular (o tocan, si el sensor no responde); *Rayo* y *Láser* tocan rápido; *Invisibilidad*, *Abrazos* y *Escudo* mantienen el dedo. El máximo es de 9 golpes por segundo por persona. La vida depende de cuántos activaron su poder. El anfitrión toca **¡Golpe final!** cuando quiera, aunque la barra no haya llegado a cero.
   3. **La chispa.** "¡Levanten sus celulares!" y, después de 4 segundos, la energía salta de un celular a otro en un orden al azar, cada vez más rápido. Solo suena y destella el celular al que le toca, así que el sonido recorre la sala. Ningún celular destella más de unas 3 veces por segundo. Siguen una cuenta regresiva, un destello blanco en todos a la vez, el villano derrotado y el mensaje "Apaguen las luces".
   4. **Velas.** Con la luz apagada, cada celular muestra una vela con forma de 1 que se inclina al girar el teléfono. Cuando Salvador sopla, el anfitrión toca **Salvador sopló la vela** y todas se apagan en el mismo instante (con 0,7 s de margen). Después aparece "Feliz primer año, Salvador". **Volver a encender las velas** sirve para repetir el momento.
   5. **Película** (la de 35 segundos), **podio** y luego **Pasar los créditos finales**. Los créditos muestran el reparto en orden de llegada, cada invitado con un alias según su récord, los récords de la noche y hasta 8 mensajes de la cápsula. Cada celular resalta el nombre de su dueño. Al final aparece *Misión cumplida*, con la ficha de héroe descargable (PNG de 1080 × 1440).
   Cada momento tiene **Saltar este momento**, y **Volver a la fiesta** quita el final de los celulares.
6. **Marcador → Cápsula del tiempo** permite revisar los mensajes, ocultar alguno de los créditos y abrir el expediente para **imprimir o guardar en PDF**. **Descargar copia** guarda un archivo HTML.

La fecha impresa se configura en `CONFIG.fechaRecuerdo`, y el año de la cápsula en `CONFIG.capsulaAnio` y `CONFIG.capsulaAbrir`, en `index.html`.

## Fotos y datos

- `recuerdos/{id}`: autor, nombre, reto, fecha, estado (`pendiente`, `aprobada`, `rechazada`) y referencias a la foto. No contiene imágenes.
- `fotos/recuerdos/{id}` y `fotosMini/recuerdos/{id}`: fotos enviadas desde el estudio. Las fotos de las misiones conservan sus rutas originales.
- `final/fase`: `hackeo`, `jefe`, `chispa`, `velas`, `historia`, `podio` o `creditos`. El anfitrión escribe los tiempos (`t`, `jefeT`, `chispaT`, `sopladoT`, `escenaT`, `creditosT`), `vida`, `orden` y `creditosDur`. Cada celular escribe solo `final/listos/{id}`, `final/golpes/{id}` (cada 0,5 s como máximo) y `final/reloj/{id}`.
- `final/reloj/{id}`: al entrar al hackeo, a la chispa y a las velas, cada celular mide su diferencia con el reloj del servidor descontando la latencia (cinco escrituras de `serverTimestamp`). Si la medición falla, usa `.info/serverTimeOffset`, como antes.
- Un `final` sin `t` (por ejemplo, un golpe que llegó tarde después de **Volver a la fiesta**) se ignora.
- `capsula/{id}/v/{versión}`: texto (hasta 400 caracteres), nombre, `publico` y fecha. `capsula/{id}/oculto` lo pone el anfitrión. **Vaciar la Liga** también borra la cápsula: descarga el expediente antes.
- La fase `energia` se conserva para finales antiguos; los nuevos ya no la usan.
- Las imágenes se convierten a JPEG, hasta 1600 px en su lado mayor, y se crean miniaturas. **Foto sin marco** descarga esa copia optimizada; no es el archivo original de la cámara. La conversión no conserva EXIF.
- El álbum carga miniaturas. Solo abre la foto grande al crear una portada. Retirar un recuerdo de una misión no elimina la evidencia de esa misión ni altera sus puntos.
- No se publican enlaces nuevos al álbum ni se cambia la autenticación existente. La aprobación es un flujo de la interfaz, no una nueva barrera de seguridad del servidor.

## Protección de datos

`database.rules.json` (en la raíz del repositorio) define quién puede escribir:

- **Solo el anfitrión, con sesión de Google**, puede borrar o reemplazar datos: quitar agentes, **Vaciar la Liga**, aprobar o retirar fotos del álbum, borrar fotos y ocultar mensajes de la cápsula. La sesión se inicia en **Marcador → Protección de datos** o en **Agentes**.
- **Los invitados**, y también el anfitrión sin sesión, pueden jugar y crear: registrarse, conectarse, jugar misiones, subir fotos, retar duelos, sumar puntos de duelo y escribir en la cápsula. No pueden borrar ni cambiar agentes, puntos, historial, duelos, códigos, fotos, álbum ni mensajes.
- **El control del juego en curso** (`mision`, `mj`, `final`, `alerta`, `ajustes`, `comando`, `enfriamiento`) sigue abierto. Así la fiesta funciona aunque el inicio de sesión falle ese día. Esos nodos no guardan datos que haya que conservar.
- **Las salas `ensayo…`** quedan abiertas, para que los ensayos se puedan vaciar.

Cambios en la app que vienen con las reglas:

- **Cápsula:** cada cambio es una versión nueva (`capsula/{id}/v/{versión}`). Vale la última, y un texto vacío equivale a "sin mensaje". Nadie puede borrar ni reemplazar una versión.
- **Álbum:** si un invitado elimina su foto, queda marcada como retirada (`recuerdos/{id}/retirada`): desaparece del álbum y del final. El anfitrión la ve como "Retirada por su autor" y puede borrarla del todo.
- **Vaciar la Liga y Quitar agente** son una sola escritura atómica: sin permiso no se borra nada a medias, y aparece un aviso.

El correo del anfitrión **no** está en el repositorio, que es público. La plantilla usa `CORREO_DEL_ANFITRION`, y se reemplaza al pegar las reglas en Firebase → Realtime Database → Reglas. El inicio de sesión usa `CONFIG.firebaseAuth` (`apiKey` y `appId` de la app web; no son secretos). Solo el centro de mando carga Firebase Authentication.

## Verificación local

Abrir `http://127.0.0.1:8765/juegos/?demo` después de iniciar `python -m http.server 8765 --bind 127.0.0.1` desde la raíz. La demo usa memoria y no escribe en Firebase.

Prueba automatizada: `node juegos/tests/recuerdos.cjs`, con Playwright disponible en Node. Acepta `PLAYWRIGHT_WS_ENDPOINT` para usar un Chrome de pruebas ya iniciado; sin él, abre Chrome headless. `LIGA_TEST_URL` permite cambiar la URL local. La prueba bloquea solicitudes externas.

Reglas en el emulador de Firebase (nunca producción): con `firebase emulators:start --only database,auth --project demo-liga` y `database.rules.json` con el correo real, para la instancia `liga-salvador-default-rtdb`:

- `LIGA_ADMIN_EMAIL=… node juegos/tests/reglas.cjs`: 49 comprobaciones de lo que un invitado puede y no puede escribir, y de lo que puede el anfitrión.
- `LIGA_ADMIN_EMAIL=… node juegos/tests/reglas-app.cjs`: la app completa contra el emulador. Prueba la cápsula con versiones, la foto retirada, el final y una misión jugados sin sesión (sin ningún permiso denegado), y que sin sesión no se puede vaciar la Liga. Después inicia sesión con Google en el emulador y verifica que sí se puede aprobar, ocultar y vaciar.

Ensayo con Firebase real: `LIGA_FIREBASE_ENSAYO=1 node juegos/tests/firebase-ensayo.cjs`, con un servidor estático simple en el puerto 8790 (`python -m http.server 8790 --bind 127.0.0.1`). Abre un centro de mando y dos celulares en una sala desechable (`ensayo-…`), recorre todo el final con tiempos reales y borra la sala al terminar. Nunca usa la sala `fiesta`. Sin la variable no escribe nada.

### Lo que se verificó el 6 de octubre de 2026

- Las reglas de Firebase permiten las rutas nuevas (`capsula/{id}`, `final/listos`, `final/golpes` y `final/reloj`) y resuelven `serverTimestamp`. La raíz `salas` no se puede listar sin permiso.
- En el ensayo real, el reloj de Firebase sin ajustar se desviaba unos 120 ms. Con `afinarReloj`, los celulares quedaron a menos de 10 ms del servidor: los destellos llegaron unos 10 ms después de lo previsto, el golpe final entre 6 y 19 ms y la vela entre 2 y 9 ms.
- Falta probar en celulares reales: el sensor de movimiento, el permiso de iPhone, la vibración en Android y el volumen.

## Ensayo de 10 minutos con celulares reales

Usar 3 o 4 celulares (al menos un iPhone y un Android) más el del anfitrión. Usar una sala de ensayo para no mezclar con la fiesta: el enlace normal con `?sala=ensayo` (los invitados) y `?sala=ensayo#comando` (el anfitrión).

1. **Entrar (1 min).** Cada celular crea su tarjeta con poderes distintos: uno *Súper fuerza* (sacudir), uno *Velocidad del rayo* (tocar) y uno *Escudo* (mantener). Escribir un mensaje en la cápsula desde uno.
2. **Una misión rápida (2 min).** Lanzar *Reflejos de héroe* o un duelo, para que el villano tenga datos que decir.
3. **Hackeo (1 min).** **Comenzar el gran final.** Revisar que todos se pongan rojos casi al mismo tiempo y que suene; el sonido necesita que antes hayan tocado la pantalla una vez. Cada uno toca **Activar mi poder**. En iPhone debe aparecer el permiso de movimiento: hay que tocar **Permitir**.
4. **Batalla (1 min).** Sacudir el de *Súper fuerza*. Si no cuenta golpes, tocar el enlace "¿No detecta el movimiento?". Verificar que la barra baje igual en todos.
5. **Chispa (30 s).** Poner los celulares en una mesa, separados. El destello y el sonido deben saltar de uno a otro, y el destello blanco final debe verse a la vez en todos.
6. **Velas (1 min).** Apagar la luz y tocar **Salvador sopló la vela**: todas deben apagarse juntas. Probar **Volver a encender las velas**.
7. **Película, podio y créditos (2 min).** Usar **Ir al podio ahora** si hay prisa. En los créditos, cada celular resalta su nombre y aparece el mensaje de la cápsula. Descargar una ficha.
8. **Cerrar.** **Volver a la fiesta**. En **Marcador → Cápsula del tiempo**, abrir el expediente. Para borrar el ensayo, usar **Vaciar la Liga** *en la sala de ensayo*.

Antes de la fiesta, revisar la sala `fiesta`: tiene agentes de pruebas anteriores. **Vaciar la Liga** en esa sala también borra la cápsula, así que hay que hacerlo antes de que los invitados escriban.

Las pruebas locales no verifican Safari/iOS real. No se modificaron datos ni reglas de la sala `fiesta`.
