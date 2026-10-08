# Durango GeoInteligencia

Prototipo de geointeligencia para **Seguridad Pública de Gómez Palacio, Durango**: mapa de patrullas, llamadas de emergencia simuladas, asignación de la patrulla más cercana **por tiempo de manejo sobre calles reales**, localidades del INEGI y mapa de calor.

**Sitio de demostración:** https://d-lang-gif.github.io/durango-geointeligencia/
(requiere usuario y contraseña; se entregan por separado y no están en este repositorio).

> ⚠️ **PROTOTIPO CON DATOS SIMULADOS.** Las patrullas, los incidentes, los folios y los teléfonos son **ficticios** (teléfonos con formato `871-SIM-####`).
> **No** provienen de C4/C5, del 911 ni del IFT. La información geográfica proviene de fuentes públicas (INEGI y OpenStreetMap) y la incidencia delictiva municipal de los **datos abiertos del SESNSP**. Las zonas y horarios de riesgo son un **modelo estimado (simulación), no datos oficiales por colonia u hora**.

## Qué hace

- **Acceso con usuario y contraseña** antes de mostrar el mapa.
- **Localidades del INEGI (494)** del municipio de Gómez Palacio (clave 10-007): nombre, clave INEGI, coordenadas y población del Censo 2020. Se dibujan como círculos pequeños; las de mayor población se resaltan (rojo ≥ 2,500 hab.; naranja 500–2,499; gris < 500). Capa activable.
- **13 ejidos verificados** (INEGI + OpenStreetMap) con etiqueta.
- **Perímetros Lavín y Sacramento:** se marcan **solo las localidades que los integran** según la tabla del SIDEAPAAR 2023 del Ayuntamiento. **No se dibuja ningún polígono**: no existe un límite oficial publicado en INEGI ni en OpenStreetMap (búsqueda del 2026-10-08). Cuatro localidades (Venecia, Los Ángeles, Eureka, Arturo Martínez Adame) se marcan como *probables* de Sacramento porque la tabla de la fuente es ambigua (anillo punteado).
- **22 patrullas simuladas** (16 urbanas en 5 sectores y 6 de cobertura rural: perímetros Lavín y Sacramento, y rural centro-norte). Cada marcador muestra su número de unidad (se oculta al alejar el mapa) y, al tocarlo, una **clave de oficial ficticia** con formato de radio (p. ej. GP-1445), marcada como “clave ficticia (simulación)”: no corresponde a ninguna persona ni placa real y cambia con el turno (A 07:00–15:00, B 15:00–23:00, C 23:00–07:00).
- **Estadística oficial (SESNSP):** pestaña con los delitos del fuero común de Gómez Palacio (clave 10007) tal como los publica el SESNSP: 2025 completo (metodología 2015–2025) y enero–agosto de 2026 (metodología 2026, no comparable directamente), con fuente, archivo, metodología y fecha de consulta. No se estima ni se completa ningún valor.
- **Modelo estimado de riesgo por zona y hora (simulación):** 26 zonas ancladas a lugares reales (plazas, parques y puntos de OpenStreetMap, y localidades INEGI). El peso de cada tipo de delito es su participación **real** en 2025 (SESNSP); el perfil por hora y por día son supuestos del modelo, coherentes con lo publicado para La Laguna por el Observatorio de La Laguna (CCI Laguna, 26/06/2025); el peso de cada zona sale de la población INEGI y de los comercios de OpenStreetMap. **No usa ningún dato delictivo por colonia.** Un control de hora (0–23, con “Ahora” y reproducción) actualiza el mapa de calor y resalta las 5 zonas de mayor riesgo estimado.
- **Despliegue por horario:** las patrullas en rondín se reparten en proporción al riesgo estimado de la hora (con al menos una por sector urbano; las rurales se quedan en su sector) y se mueven hacia su zona con movimiento local sencillo, sin consultar OSRM. Cada una muestra su zona y su estatus de rondín.
- **Simulación de llamadas 911:** crea un incidente en una zona y con un tipo de delito elegidos según el modelo de la hora (más probable donde y cuando el riesgo estimado es mayor), elige entre las 3 patrullas disponibles más cercanas en línea recta la de **menor tiempo de manejo** (OSRM `table`), traza la **ruta por calles** (OSRM `route`) y la patrulla avanza sobre esa ruta. También hay llamadas automáticas simuladas, más frecuentes en las horas de mayor riesgo estimado (se pueden apagar).
  - Si OSRM no responde en 6 s, se usa una **línea recta a 40 km/h** y se indica claramente en pantalla (“línea recta (OSRM no disponible)”).
  - Ciclo cada 3 s, tiempo acelerado ×15, 60 s en sitio y cierre del incidente, la patrulla queda libre y vuelve a su rondín, incidentes **en espera** cuando no hay unidades, asignación manual desde la lista y botón para reiniciar los datos de ejemplo.
- Panel con tres pestañas (Operación / Horarios y zonas / Estadística oficial) y diseño para **teléfono** (panel inferior deslizable) y escritorio.

## Plan de escalamiento

**[Plan de escalamiento municipal, estatal y federal (2026-10-08)](documentos/Plan_Escalamiento_GeoInteligencia_2026-10-08.md)**: hoja de ruta para convertir este prototipo en un sistema real si las autoridades lo aceptan. Incluye qué es y qué no es el prototipo, pros, contras y riesgos, marco legal federal, estatal (Durango) y municipal, requisitos técnicos, equipo y capacitación, costos estimados por fase (rangos, no cotizaciones), fases 0 a 4, lista de verificación para reuniones, preguntas difíciles, próximos pasos y fuentes consultadas.

> Documento de trabajo de una iniciativa cívica, **sin respaldo oficial**. Es la versión en Markdown del documento original (el PDF/DOCX no están en este repositorio).

## Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| `sitio/` | Sitio estático publicado en GitHub Pages: `index.html`, `css/`, `js/acceso.js` (acceso), `js/modelo.js` (modelo estimado de riesgo), `js/estadistica.js` (pestaña SESNSP), `js/app.js` (mapa y simulación), `datos/paquete.js` (datos **cifrados**). |
| `servidor/` | Versión con servidor (**backend de producción a futuro**): FastAPI + PostgreSQL/PostGIS + WebSocket, con `docker-compose.yml`. |
| `datos/` | Datos fuente en CSV/GeoJSON/JSON: localidades INEGI, ejidos verificados, integrantes de perímetros, límite municipal simplificado, extractos SESNSP de Gómez Palacio, zonas del modelo y flota simulada. Ver `datos/FUENTES.md`. |
| `scripts/construir_paquete.py` | Genera `sitio/datos/paquete.js` a partir de `datos/` (gzip + AES-256-GCM). `scripts/resumir_sesnsp.py` resume los CSV del SESNSP y `scripts/preparar_zonas.py` arma las zonas del modelo. |
| `documentos/` | Documentos del proyecto en Markdown (plan de escalamiento). No se publican en GitHub Pages. |
| `.github/workflows/publicar.yml` | Publica `sitio/` en la rama `gh-pages`, agregando Leaflet 1.9.4 y Leaflet.heat 0.2.0 desde npm con verificación SHA-256. |

## Fuentes

- **INEGI**, Catálogo Único de Claves Geoestadísticas (servicio `gaia.inegi.org.mx/wscatgeo`): localidades, coordenadas y población 2020. La suma de población de las 494 localidades (372,736) cuadra con el total municipal del INEGI (372,750; 4 localidades sin dato).
- **OpenStreetMap** (© colaboradores de OSM, licencia ODbL): mapa base, verificación de ejidos y límite municipal (relación 5605840).
- **OSRM** (Open Source Routing Machine, servidor público de demostración `router.project-osrm.org`, perfil *driving*, datos de OSM): rutas y tiempos de manejo.
- **Ayuntamiento de Gómez Palacio**, SIDEAPAAR 2023, “Indicadores de resultados”: integrantes de los perímetros Lavín y Sacramento.
- **SESNSP**, datos abiertos de incidencia delictiva (fuero común, nivel municipal): https://www.gob.mx/sesnsp/acciones-y-programas/datos-abiertos-de-incidencia-delictiva — cifras de Gómez Palacio 2023–2025 y enero–agosto 2026. Ver `datos/FUENTES.md`.
- **Observatorio de La Laguna (CCI Laguna)**, 26/06/2025, “Reporte sobre incidencia delictiva en La Laguna, enero–mayo 2025”: https://observatoriodelalaguna.org.mx/publicacion/reporte-sobre-incidencia-delictiva-en-la-laguna-enero-mayo-2025/ — solo como referencia cualitativa de horarios para la Zona Metropolitana de La Laguna (no son cifras de Gómez Palacio por colonia).

## Seguridad del acceso (léase)

- La contraseña **no** está en el repositorio. Se guarda solo un **verificador con sal** (PBKDF2-HMAC-SHA256, 600,000 iteraciones, sal aleatoria) y los datos del mapa van **cifrados** con AES-256-GCM usando una clave derivada de la misma contraseña.
- Es una protección **de nivel demostración**: al ser un sitio estático y público, cualquiera puede descargar el paquete cifrado e intentar adivinar la contraseña sin límite de intentos, y el código del sitio es visible. Además, los datos geográficos ya son públicos en este repositorio (`datos/`). **No use este esquema para información sensible real**; para producción se requiere autenticación en servidor (ver `servidor/`).
- Para cambiar la contraseña: `pip install cryptography` y luego `python3 scripts/construir_paquete.py` (la pide por teclado); suba el nuevo `sitio/datos/paquete.js`.

## Limitaciones

- OSRM se consulta desde el navegador al **servidor público de demostración**, que no garantiza disponibilidad y tiene política de uso limitado (no apto para producción). Los tiempos son de manejo normal, no de emergencia. Para producción conviene un servidor OSRM propio.
- Las zonas y horarios de riesgo son un **modelo estimado (simulación)**: el perfil por hora es un supuesto (no hay datos públicos por colonia u hora para Gómez Palacio) y el peso de cada zona depende de lo que esté mapeado en OpenStreetMap. Con 16 unidades urbanas y 16 zonas urbanas, el reparto proporcional deja una unidad en la mayoría de las zonas, dos en las de mayor riesgo de cada hora y ninguna fija en las 1 a 3 de menor riesgo (siempre con al menos una por sector).
- Cada persona que abre el sitio ve **su propia simulación** (corre en su navegador y se guarda en ese navegador).
- Requiere navegador actualizado (Chrome/Edge, Safari 16.4+ o Firefox 113+).

## Probar el sitio en una computadora

```bash
cd sitio
mkdir -p vendor/leaflet   # Leaflet no se guarda en el repositorio; el flujo de publicación lo agrega
curl -fsSL https://registry.npmjs.org/leaflet/-/leaflet-1.9.4.tgz | tar xz -C /tmp && cp -r /tmp/package/dist/{leaflet.js,leaflet.css,images} vendor/leaflet/
curl -fsSL https://registry.npmjs.org/leaflet.heat/-/leaflet.heat-0.2.0.tgz | tar xz -C /tmp && cp /tmp/package/dist/leaflet-heat.js vendor/
python3 -m http.server 8090   # abrir http://localhost:8090
```
(Si falta `vendor/`, el sitio carga Leaflet desde unpkg con verificación de integridad SRI.)

## Versión con servidor (backend a futuro)

Requiere Docker. Desde `servidor/`:

```bash
cp .env.ejemplo .env          # edite POSTGRES_PASSWORD (el archivo .env no se sube)
docker compose up -d --build
# Mapa: http://localhost:8080    API: http://localhost:8000/docs
```

Sin Docker: PostgreSQL 15+ con PostGIS 3, cargar `servidor/db/01_schema.sql` … `04_seed.sql` en una base `durango_geo`, y luego

```bash
cd servidor/backend
pip install -r requirements.txt
export DATABASE_URL="postgresql+psycopg2://geo:<su contraseña>@127.0.0.1:5432/durango_geo"
uvicorn app.main:app --port 8000
```

La versión con servidor calcula distancias en línea recta con PostGIS (todavía no usa OSRM) y comparte una sola simulación entre todos los usuarios por WebSocket.
