# Durango GeoInteligencia

Prototipo de geointeligencia para **Seguridad Pública de Gómez Palacio, Durango**: mapa de patrullas, llamadas de emergencia simuladas, asignación de la patrulla más cercana **por tiempo de manejo sobre calles reales**, localidades del INEGI y mapa de calor.

**Sitio de demostración:** https://d-lang-gif.github.io/durango-geointeligencia/
(requiere usuario y contraseña; se entregan por separado y no están en este repositorio).

> ⚠️ **PROTOTIPO CON DATOS SIMULADOS.** Las patrullas, los incidentes, los folios y los teléfonos son **ficticios** (teléfonos con formato `871-SIM-####`).
> **No** provienen de C4/C5, del 911 ni del IFT. Solo la información geográfica (localidades, ejidos, límite municipal) proviene de fuentes públicas (INEGI y OpenStreetMap).

## Qué hace

- **Acceso con usuario y contraseña** antes de mostrar el mapa.
- **Localidades del INEGI (494)** del municipio de Gómez Palacio (clave 10-007): nombre, clave INEGI, coordenadas y población del Censo 2020. Se dibujan como círculos pequeños; las de mayor población se resaltan (rojo ≥ 2,500 hab.; naranja 500–2,499; gris < 500). Capa activable.
- **13 ejidos verificados** (INEGI + OpenStreetMap) con etiqueta.
- **Perímetros Lavín y Sacramento:** se marcan **solo las localidades que los integran** según la tabla del SIDEAPAAR 2023 del Ayuntamiento. **No se dibuja ningún polígono**: no existe un límite oficial publicado en INEGI ni en OpenStreetMap (búsqueda del 2026-10-08). Cuatro localidades (Venecia, Los Ángeles, Eureka, Arturo Martínez Adame) se marcan como *probables* de Sacramento porque la tabla de la fuente es ambigua (anillo punteado).
- **Simulación de llamadas 911:** crea un incidente cerca de un ejido, elige entre las 3 patrullas disponibles más cercanas en línea recta la de **menor tiempo de manejo** (OSRM `table`), traza la **ruta por calles** (OSRM `route`) y la patrulla avanza sobre esa ruta.
  - Si OSRM no responde en 6 s, se usa una **línea recta a 40 km/h** y se indica claramente en pantalla (“línea recta (OSRM no disponible)”).
  - Igual que la versión con servidor: ciclo cada 3 s, tiempo acelerado ×15, 60 s en sitio y cierre del incidente, la patrulla queda libre y regresa a su base, incidentes **en espera** cuando no hay unidades, asignación manual desde la lista, mapa de calor y botón para reiniciar los datos de ejemplo.
- Diseño para **teléfono** (panel inferior deslizable) y escritorio.

## Estructura del repositorio

| Carpeta | Contenido |
|---|---|
| `sitio/` | Sitio estático publicado en GitHub Pages: `index.html`, `css/`, `js/acceso.js` (acceso), `js/app.js` (mapa y simulación en el navegador), `datos/paquete.js` (datos geográficos **cifrados**). |
| `servidor/` | Versión con servidor (**backend de producción a futuro**): FastAPI + PostgreSQL/PostGIS + WebSocket, con `docker-compose.yml`. |
| `datos/` | Datos fuente en CSV/GeoJSON: localidades INEGI, ejidos verificados, integrantes de perímetros, límite municipal simplificado. Ver `datos/FUENTES.md`. |
| `scripts/construir_paquete.py` | Genera `sitio/datos/paquete.js` a partir de `datos/` (gzip + AES-256-GCM). |
| `.github/workflows/publicar.yml` | Publica `sitio/` en la rama `gh-pages`, agregando Leaflet 1.9.4 y Leaflet.heat 0.2.0 desde npm con verificación SHA-256. |

## Fuentes

- **INEGI**, Catálogo Único de Claves Geoestadísticas (servicio `gaia.inegi.org.mx/wscatgeo`): localidades, coordenadas y población 2020. La suma de población de las 494 localidades (372,736) cuadra con el total municipal del INEGI (372,750; 4 localidades sin dato).
- **OpenStreetMap** (© colaboradores de OSM, licencia ODbL): mapa base, verificación de ejidos y límite municipal (relación 5605840).
- **OSRM** (Open Source Routing Machine, servidor público de demostración `router.project-osrm.org`, perfil *driving*, datos de OSM): rutas y tiempos de manejo.
- **Ayuntamiento de Gómez Palacio**, SIDEAPAAR 2023, “Indicadores de resultados”: integrantes de los perímetros Lavín y Sacramento.

## Seguridad del acceso (léase)

- La contraseña **no** está en el repositorio. Se guarda solo un **verificador con sal** (PBKDF2-HMAC-SHA256, 600,000 iteraciones, sal aleatoria) y los datos del mapa van **cifrados** con AES-256-GCM usando una clave derivada de la misma contraseña.
- Es una protección **de nivel demostración**: al ser un sitio estático y público, cualquiera puede descargar el paquete cifrado e intentar adivinar la contraseña sin límite de intentos, y el código del sitio es visible. Además, los datos geográficos ya son públicos en este repositorio (`datos/`). **No use este esquema para información sensible real**; para producción se requiere autenticación en servidor (ver `servidor/`).
- Para cambiar la contraseña: `pip install cryptography` y luego `python3 scripts/construir_paquete.py` (la pide por teclado); suba el nuevo `sitio/datos/paquete.js`.

## Limitaciones

- OSRM se consulta desde el navegador al **servidor público de demostración**, que no garantiza disponibilidad y tiene política de uso limitado (no apto para producción). Los tiempos son de manejo normal, no de emergencia. Para producción conviene un servidor OSRM propio.
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
