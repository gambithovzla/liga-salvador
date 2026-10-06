# Álbum, portadas y final para celulares

No se necesita TV. El anfitrión controla todo desde **Marcador** en su celular.

1. Los invitados abren **Abrir álbum y crear mi portada** en el cuartel. Pueden elegir una foto de su teléfono, ajustar el encuadre y descargar una portada PNG de 1080 × 1440. Se genera localmente; elegir una foto no la sube.
2. Para compartirla en el álbum, marcan la casilla y pulsan **Enviar para aprobación**. Las misiones de fotos tienen una casilla equivalente, opcional; no marcarla no afecta los puntos.
3. El anfitrión entra en **Marcador → Revisar y aprobar fotos**. Solo los recuerdos aprobados se muestran en el álbum de los invitados y en el final. Puede retirarlos después. Cada invitado también puede eliminar sus recuerdos.
4. **Comenzar el gran final** abre la misión de energía en todos los teléfonos. Cada invitado toca su escudo una vez. El anfitrión puede avanzar sin esperar a todos.
5. **Encender la ciudad** inicia una película de 35 segundos en cada celular: señal de apertura, ciudad iluminada, hasta ocho fotos aprobadas en cuatro tandas (o nombres si no hay fotos), ascenso de Salvador y título final. Usa el tiempo del servidor para que un teléfono que vuelve a abrirse alcance la escena actual. No requiere audio para entenderse; incluye efectos breves, vibración y control de sonido.
6. Al terminar se activa **Continuar al podio**. **Ir al podio ahora** permite saltar la película si hace falta. Tras revelar los puestos, el estudio genera portadas con puntos y posición final. **Volver a la fiesta** permite seguir jugando.

La fecha impresa se configura en `CONFIG.fechaRecuerdo`, en `index.html`.

## Fotos y datos

- `recuerdos/{id}`: autor, nombre, reto, fecha, estado (`pendiente`, `aprobada`, `rechazada`) y referencias a la foto. No contiene imágenes.
- `fotos/recuerdos/{id}` y `fotosMini/recuerdos/{id}`: fotos enviadas desde el estudio. Las fotos de las misiones conservan sus rutas originales.
- `final/fase`, `final/escenaT`, `final/energia`: etapas y participación en el cierre. Los finales antiguos sin `fase` conservan el podio anterior.
- Las imágenes se convierten a JPEG, hasta 1600 px en su lado mayor, y se crean miniaturas. **Foto sin marco** descarga esa copia optimizada; no es el archivo original de la cámara. La conversión no conserva EXIF.
- El álbum carga miniaturas. Solo abre la foto grande al crear una portada. Retirar un recuerdo de una misión no elimina la evidencia de esa misión ni altera sus puntos.
- No se publican enlaces nuevos al álbum ni se cambia la autenticación existente. La aprobación es un flujo de la interfaz, no una nueva barrera de seguridad del servidor.

## Verificación local

Abrir `http://127.0.0.1:8765/juegos/?demo` después de iniciar `python -m http.server 8765 --bind 127.0.0.1` desde la raíz. La demo usa memoria y no escribe en Firebase.

Prueba automatizada: `node juegos/tests/recuerdos.cjs`, con Playwright disponible en Node. Acepta `PLAYWRIGHT_WS_ENDPOINT` para usar un Chrome de pruebas ya iniciado; sin él, abre Chrome headless. `LIGA_TEST_URL` permite cambiar la URL local. La prueba bloquea solicitudes externas.

Antes de publicar, verificar en el entorno de Firebase que las reglas existentes permiten las rutas nuevas y conservan los permisos esperados. No hay un archivo de reglas de Firebase en este repositorio y las pruebas locales no verifican esas reglas ni Safari/iOS real. No se modificaron datos ni reglas de producción.
