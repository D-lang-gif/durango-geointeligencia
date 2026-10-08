#!/usr/bin/env python3
"""Resume la incidencia delictiva OFICIAL (SESNSP, fuero común, nivel municipal) de Gómez Palacio (10007)
en datos/sesnsp_gomez_palacio.json. Las cifras salen tal cual de los extractos en datos/sesnsp/ (filas del municipio
10007 copiadas sin modificar de los archivos oficiales, omitiendo solo las que tienen cero en todos los meses; ver
datos/FUENTES.md). No se estima ni se completa nada."""
import csv, json
from collections import defaultdict
from pathlib import Path
RAIZ = Path(__file__).resolve().parent.parent
D = RAIZ / "datos/sesnsp"
M = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
PAGINA = "https://www.gob.mx/sesnsp/acciones-y-programas/datos-abiertos-de-incidencia-delictiva"

def leer(nombre, anio):
    return [r for r in csv.DictReader(open(D / nombre, encoding="utf-8")) if r["Año"] == anio and r["Cve. Municipio"] == "10007"]

def suma(rs, n_meses):
    return sum(int(r[m] or 0) for r in rs for m in M[:n_meses])

def resumen(rs, n_meses):
    porMes = [sum(int(r[m] or 0) for r in rs) for m in M[:n_meses]]
    tipos = defaultdict(int); sub = defaultdict(int); mod = defaultdict(int)
    for r in rs:
        s = sum(int(r[m] or 0) for m in M[:n_meses])
        tipos[r["Tipo de delito"]] += s; sub[(r["Tipo de delito"], r["Subtipo de delito"])] += s
        mod[(r["Subtipo de delito"], r["Modalidad"])] += s
    def f(pred): return sum(v for (t, s), v in sub.items() if pred(t, s))
    destacados = [
        ("Violencia familiar", f(lambda t, s: t == "Violencia familiar")),
        ("Lesiones dolosas", f(lambda t, s: s == "Lesiones dolosas")),
        ("Lesiones culposas", f(lambda t, s: s == "Lesiones culposas")),
        ("Narcomenudeo", f(lambda t, s: t == "Narcomenudeo")),
        ("Amenazas", f(lambda t, s: t == "Amenazas")),
        ("Daño a la propiedad", f(lambda t, s: t == "Daño a la propiedad")),
        ("Robo a negocio", f(lambda t, s: s == "Robo a negocio")),
        ("Robo a casa habitación", f(lambda t, s: s == "Robo a casa habitación")),
        ("Robo de vehículo automotor (coche y moto)", f(lambda t, s: s.startswith("Robo de vehículo automotor"))),
        ("Robo a transeúnte", f(lambda t, s: s.startswith("Robo a transeúnte"))),
        ("Otros robos", f(lambda t, s: s == "Otros robos")),
        ("Homicidio doloso", f(lambda t, s: s == "Homicidio doloso")),
        ("Homicidio culposo", f(lambda t, s: s == "Homicidio culposo")),
        ("Feminicidio", f(lambda t, s: t == "Feminicidio")),
        ("Abuso sexual", f(lambda t, s: t == "Abuso sexual")),
        ("Fraude", f(lambda t, s: t == "Fraude")),
        ("Extorsión", f(lambda t, s: t == "Extorsión")),
    ]
    robo_violencia = sum(v for (s, m), v in mod.items() if "Con violencia" in m and s.lower().startswith(("robo", "otros robos")))
    return {"total": suma(rs, n_meses), "por_mes": porMes, "meses": M[:n_meses],
            "por_tipo": sorted([[k, v] for k, v in tipos.items() if v], key=lambda x: -x[1]),
            "destacados": destacados, "robos_con_violencia": robo_violencia,
            "accidentes_transito": {"lesiones_culposas": mod.get(("Lesiones culposas", "En accidente de tránsito"), 0),
                                    "homicidio_culposo": mod.get(("Homicidio culposo", "En accidente de tránsito"), 0)}}

def main():
    viejo = "sesnsp_municipal_delitos_10007_2023-2025_metodologia2015.csv"
    nuevo = "sesnsp_municipal_delitos_10007_2026_ene-ago_metodologia2026.csv"
    r25 = resumen(leer(viejo, "2025"), 12); r26 = resumen(leer(nuevo, "2026"), 8)
    out = {
        "municipio": "Gómez Palacio, Durango", "clave": "10007",
        "fuente": "Secretariado Ejecutivo del Sistema Nacional de Seguridad Pública (SESNSP), Datos abiertos de incidencia delictiva, fuero común, nivel municipal (delitos)",
        "pagina": PAGINA, "consultado": "2026-10-08",
        "nota": "Carpetas de investigación iniciadas (presunta ocurrencia de delitos) reportadas por la Fiscalía del Estado de Durango. No publica colonia ni hora.",
        "periodos": [
            {"id": "2025", "titulo": "2025 (enero–diciembre)", "metodologia": "Metodología 2015–2025",
             "archivo": "Municipal-Delitos-2015-2025_ago2026.zip (CSV Municipal-Delitos-2015-2025_ago2026.csv)", **r25},
            {"id": "2026", "titulo": "2026 (enero–agosto)", "metodologia": "Metodología 2026 (nuevo catálogo; no es directamente comparable con 2025)",
             "archivo": "RNID-Delitos_Municipal-2026-ago2026.zip (CSV RNID-Delitos_Municipal-2026-ago2026.csv)", **r26},
        ],
        "totales_anuales": {a: suma(leer(viejo, a), 12) for a in ("2023", "2024", "2025")},
    }
    (RAIZ / "datos/sesnsp_gomez_palacio.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"2025": r25["total"], "2026": r26["total"], "anuales": out["totales_anuales"],
                      "destacados2025": r25["destacados"], "rv25": r25["robos_con_violencia"], "rv26": r26["robos_con_violencia"],
                      "destacados2026": r26["destacados"]}, ensure_ascii=False, indent=0))

if __name__ == "__main__":
    main()
