#!/usr/bin/env python3
"""Genera datos/zonas_modelo.csv (zonas del MODELO ESTIMADO de riesgo) y valida datos/flota_simulada.csv.

Las zonas se ubican en lugares REALES: rasgos de OpenStreetMap (plazas/parques que llevan el nombre de la colonia,
centro comercial, central de autobuses) para la ciudad, y localidades INEGI para la zona rural.
El "peso" de cada zona NO proviene de datos delictivos (no existen públicamente por colonia u hora):
  - zonas urbanas: población estimada = 301,742 hab. (INEGI 2020, localidad 0001) repartida según el número de calles
    residenciales de OSM a 700 m del ancla; actividad comercial = comercios + servicios (shop/amenity de OSM) a 700 m.
  - zonas rurales: suma de la población 2020 (INEGI) de las localidades a 2.5 km del ancla.
Uso: python3 scripts/preparar_zonas.py RUTA_OVERPASS_JSON   (consulta Overpass guardada; ver datos/FUENTES.md)
"""
import csv, json, math, sys
from pathlib import Path
RAIZ = Path(__file__).resolve().parent.parent
LIM = json.loads((RAIZ / "datos/limite_gomez_palacio_osm_simplificado.geojson").read_text(encoding="utf-8"))["geometry"]["coordinates"][0]

def dentro(lat, lon):
    r = False
    for a in range(len(LIM)):
        xi, yi = LIM[a]; xj, yj = LIM[a - 1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi: r = not r
    return r

def dist(a, b):
    R = 6371008.8; r = math.pi / 180
    h = math.sin((b[0]-a[0])*r/2)**2 + math.cos(a[0]*r)*math.cos(b[0]*r)*math.sin((b[1]-a[1])*r/2)**2
    return 2 * R * math.asin(math.sqrt(h))

# id, nombre, sector, tipo, ancla (descripción de la fuente), referencia, lat, lon
URBANAS = [
    ("U01", "Centro", "Centro", "comercial", "OSM: Centro Gómez Palacio (landuse=commercial)", "relation/9273338", 25.56856, -103.49910),
    ("U02", "Bellavista / Hospital General", "Centro", "habitacional", "OSM: parque Bellavista", "way/664753849", 25.56389, -103.50518),
    ("U03", "5 de Mayo", "Centro", "habitacional", "OSM: parque 5 de Mayo", "way/477746293", 25.57568, -103.48790),
    ("U04", "Central de Autobuses", "Oriente", "comercial", "OSM: Central de autobuses de Gómez Palacio", "node/1613177087", 25.56391, -103.47647),
    ("U05", "Tierra y Libertad", "Oriente", "habitacional", "OSM: Parque Tierra y Libertad", "way/1145535342", 25.57171, -103.48046),
    ("U06", "Santa Teresa", "Oriente", "habitacional", "OSM: Plaza Santa Teresa Islas Mujeres", "way/1199802812", 25.58735, -103.46254),
    ("U07", "Las Huertas", "Oriente", "habitacional", "OSM: Plaza Las Huertas", "way/1311186086", 25.58660, -103.44590),
    ("U08", "Valle del Nazas", "Sur", "habitacional", "OSM: parque Valle del Nazas", "way/468886251", 25.55117, -103.48094),
    ("U09", "Filadelfia", "Norte", "habitacional", "OSM: parque Nuevo Filadelfia", "way/483621252", 25.58139, -103.49773),
    ("U10", "Carlos Herrera", "Norte", "habitacional", "OSM: Parque Carlos Herrera", "way/659560130", 25.58565, -103.50365),
    ("U11", "Hamburgo", "Norte", "habitacional", "OSM: Plaza Hamburgo", "way/483612657", 25.59498, -103.49706),
    ("U12", "Santander", "Norte", "habitacional", "OSM: Santander Residencial (landuse=residential)", "way/1454585162", 25.60039, -103.47794),
    ("U13", "Las Misiones", "Norte", "habitacional", "OSM: Las Misiones (landuse=residential)", "way/1359523666", 25.61443, -103.49863),
    ("U14", "Fidel Velázquez", "Poniente", "habitacional", "OSM: parque Fidel Velázquez", "way/1137946394", 25.56998, -103.52080),
    ("U15", "El Dorado", "Poniente", "habitacional", "OSM: Plaza El Dorado", "way/462696692", 25.58079, -103.51582),
    ("U16", "Avenida Chapala", "Poniente", "habitacional", "OSM: Avenida Chapala", "way/152541747", 25.57851, -103.52421),
]
# id, nombre, sector, cve_loc INEGI del ancla
RURALES = [
    ("R01", "El Vergel", "Perímetro Lavín", "0160"), ("R02", "Transporte · San Ramón", "Perímetro Lavín", "0154"),
    ("R03", "Berlín · Providencia", "Perímetro Lavín", "0039"),
    ("R04", "San Felipe · El Compás", "Perímetro Sacramento", "0135"), ("R05", "Santa Cruz Luján", "Perímetro Sacramento", "0147"),
    ("R06", "Villa Gregorio García", "Perímetro Sacramento", "0077"),
    ("R07", "La Popular", "Rural centro-norte", "0120"), ("R08", "Pastor Rouaix", "Rural centro-norte", "0115"),
    ("R09", "Esmeralda", "Rural centro-norte", "0064"), ("R10", "Brittingham", "Rural centro-norte", "0040"),
]
RADIO_URB, RADIO_RUR = 700, 2500

def main():
    osm = json.load(open(sys.argv[1], encoding="utf-8"))
    com, res = [], []
    for e in osm["elements"]:
        c = e.get("center", e); p = (c["lat"], c["lon"])
        if not dentro(*p): continue
        (res if e["tags"].get("highway") == "residential" else com).append(p)
    locs = list(csv.DictReader(open(RAIZ / "datos/localidades_inegi_10007.csv", encoding="utf-8")))
    porcve = {l["cve_loc"]: l for l in locs}
    pob_urbana = int(porcve["0001"]["pob_2020"])
    filas = []
    for zid, nom, sec, tipo, ancla, ref, lat, lon in URBANAS:
        assert dentro(lat, lon), zid
        filas.append(dict(id=zid, nombre=nom, sector=sec, tipo=tipo, lat=lat, lon=lon, ancla=ancla, referencia=ref,
                          calles_res_700m=sum(dist((lat, lon), p) <= RADIO_URB for p in res),
                          comercios_osm_700m=sum(dist((lat, lon), p) <= RADIO_URB for p in com)))
    tot = sum(f["calles_res_700m"] for f in filas)
    for f in filas: f["pob_est"] = round(pob_urbana * f["calles_res_700m"] / tot)
    for zid, nom, sec, cve in RURALES:
        l = porcve[cve]; lat, lon = float(l["lat"]), float(l["lon"])
        assert dentro(lat, lon), zid
        cerca = [x for x in locs if x["cve_loc"] != "0001" and dist((lat, lon), (float(x["lat"]), float(x["lon"]))) <= RADIO_RUR]
        filas.append(dict(id=zid, nombre=nom, sector=sec, tipo="rural", lat=lat, lon=lon,
                          ancla=f"INEGI: localidad {l['nombre']} (10007{cve})", referencia=f"10007{cve}",
                          calles_res_700m="", comercios_osm_700m="", pob_est=sum(int(x["pob_2020"] or 0) for x in cerca)))
    campos = ["id", "nombre", "sector", "tipo", "lat", "lon", "ancla", "referencia", "pob_est", "calles_res_700m", "comercios_osm_700m"]
    with open(RAIZ / "datos/zonas_modelo.csv", "w", newline="", encoding="utf-8") as g:
        w = csv.DictWriter(g, campos, lineterminator="\n"); w.writeheader(); w.writerows(filas)
    for f in filas: print(f["id"], f["nombre"], f["sector"], f["pob_est"], f["calles_res_700m"], f["comercios_osm_700m"])
    # Flota simulada: todas las bases dentro del límite municipal
    flota = list(csv.DictReader(open(RAIZ / "datos/flota_simulada.csv", encoding="utf-8")))
    zonas = {f["id"]: f for f in filas}
    for u in flota:
        lat, lon = float(u["lat_base"]), float(u["lon_base"])
        assert dentro(lat, lon), u["unidad"]
        assert u["sector"] == zonas[u["zona_inicial"]]["sector"], u["unidad"]
    print(f"Flota: {len(flota)} unidades, todas las bases dentro del límite municipal (OSM simplificado).")

if __name__ == "__main__":
    main()
