# Fuentes de los datos (consultadas el 2026-10-08)

| Archivo | Fuente | Notas |
|---|---|---|
| `localidades_inegi_10007.csv` | INEGI, Catálogo Único de Claves Geoestadísticas, servicio web `https://gaia.inegi.org.mx/wscatgeo/v2/localidades/10/007` (y consulta por clave `/v2/localidades/{cvegeo}`) | 494 localidades vigentes del municipio 10-007. Columnas: cvegeo, cve_loc, nombre, ámbito, lat, lon, población 2020. Cuatro localidades (0804, 0875, 0887, 0888) aparecen con “-” (sin dato). Suma 372,736 vs. total municipal INEGI 372,750 (`/v2/mgem/10/007`). |
| `ejidos_verificados.csv` | INEGI (coordenadas oficiales) + OpenStreetMap/Nominatim (verificación) | 13 ejidos. Incluye diferencia INEGI–OSM en metros y notas. |
| `perimetros_sideapaar_2023.csv` | Ayuntamiento de Gómez Palacio, SIDEAPAAR 2023, “19 Indicadores de resultados”, tabla “Comunidades atendidas en drenaje y alcantarillado”: https://www.gomezpalacio.gob.mx/pdf/sideapaar-2023/19%20INDICADORES%20DE%20RESULTADOS.pdf | Relación de ejidos por perímetro, asociada a claves INEGI. **No hay polígonos**: ni INEGI ni OpenStreetMap publican un límite para “Perímetro Lavín” o “Perímetro Sacramento” (en OSM solo existen calles y el “Canal de Sacramento”). Venecia, Los Ángeles, Eureka y Arturo Martínez Adame quedan como *probables* de Sacramento por la forma de la tabla. |
| `limite_gomez_palacio_osm_simplificado.geojson` | OpenStreetMap, relación 5605840 (ODbL) | Simplificado con Douglas-Peucker (tolerancia 0.00025°, ≈ 25 m): de 815 a 238 vértices; el área no cambia de forma apreciable (≈ 844 km²). |

Rutas: OSRM (`router.project-osrm.org`, perfil *driving*), consultado en vivo desde el navegador.
Patrullas, incidentes y teléfonos: **datos simulados**.
