#!/usr/bin/env python3
"""Construye sitio/datos/paquete.js: datos del mapa (localidades INEGI, ejidos verificados,
perímetros, límite municipal) comprimidos con gzip y cifrados con AES-256-GCM.

Clave: PBKDF2-HMAC-SHA256("usuario:contraseña", sal aleatoria, 600 000 iteraciones) -> 64 bytes.
  bytes 0..31  -> clave AES-256-GCM
  bytes 32..63 -> verificador (hash con sal) que se guarda en el paquete para validar el acceso.
La contraseña NO se guarda en ningún archivo: se pide por teclado (o variable DGI_CONTRASENA).

Uso:  python3 scripts/construir_paquete.py            (desde la raíz del repositorio)
Requiere: pip install cryptography
"""
import base64, csv, getpass, gzip, json, os, unicodedata
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

RAIZ = Path(__file__).resolve().parent.parent
ITER = 600_000
USUARIO = "seguridad"


def leer_csv(nombre):
    with open(RAIZ / "datos" / nombre, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def paquete():
    locs = [[r["cve_loc"], r["nombre"], round(float(r["lat"]), 6), round(float(r["lon"]), 6),
             (int(r["pob_2020"]) if r["pob_2020"] != "" else None), "U" if r["ambito"] == "URBANO" else "R"]
            for r in leer_csv("localidades_inegi_10007.csv")]
    ejidos = [{"nombre": r["nombre"], "oficial": r["nombre_oficial_inegi"], "cvegeo": r["cvegeo"],
               "lat": float(r["lat"]), "lon": float(r["lon"]),
               "pob": int(r["poblacion_2020"]) if r["poblacion_2020"] else None,
               "verif": r["verificacion"], "notas": r["notas"], "osm": r["osm_id"]}
              for r in leer_csv("ejidos_verificados.csv")]
    per = {}
    for r in leer_csv("perimetros_sideapaar_2023.csv"):
        per.setdefault(r["perimetro"], []).append({"cve": r["cve_loc"], "nombre_fuente": r["nombre_en_fuente"], "nota": r["nota"]})
    limite = json.loads((RAIZ / "datos" / "limite_gomez_palacio_osm_simplificado.geojson").read_text(encoding="utf-8"))
    # v3: zonas del modelo estimado (anclas reales OSM/INEGI), flota simulada y estadística oficial SESNSP
    zonas = [{"id": r["id"], "nombre": r["nombre"], "sector": r["sector"], "tipo": r["tipo"], "lat": float(r["lat"]), "lon": float(r["lon"]),
              "ancla": r["ancla"], "ref": r["referencia"], "pob": int(r["pob_est"]),
              "com": int(r["comercios_osm_700m"]) if r["comercios_osm_700m"] else None}
             for r in leer_csv("zonas_modelo.csv")]
    flota = [{"codigo": r["unidad"], "sector": r["sector"], "zona": r["zona_inicial"], "lat": float(r["lat_base"]), "lon": float(r["lon_base"]),
              "base": r["base"]} for r in leer_csv("flota_simulada.csv")]
    sesnsp = json.loads((RAIZ / "datos" / "sesnsp_gomez_palacio.json").read_text(encoding="utf-8"))
    return {"v": 3, "generado": "2026-10-08", "localidades": locs, "ejidos": ejidos, "perimetros": per, "limite": limite,
            "zonas": zonas, "flota": flota, "sesnsp": sesnsp}


def main():
    pw = os.environ.get("DGI_CONTRASENA") or getpass.getpass("Contraseña para el usuario 'seguridad': ")
    pw = pw.strip().lower()  # el sitio quita espacios y convierte a minúsculas lo que se escribe (teclados de teléfono)
    secreto = unicodedata.normalize("NFC", f"{USUARIO}:{pw}").encode("utf-8")
    sal, iv = os.urandom(16), os.urandom(12)
    bits = PBKDF2HMAC(algorithm=hashes.SHA256(), length=64, salt=sal, iterations=ITER).derive(secreto)
    claro = gzip.compress(json.dumps(paquete(), ensure_ascii=False, separators=(",", ":")).encode("utf-8"), 9, mtime=0)
    ct = AESGCM(bits[:32]).encrypt(iv, claro, None)
    b64 = lambda b: base64.b64encode(b).decode()
    datos = b64(ct)
    lineas = "\\\n".join(datos[i:i + 100] for i in range(0, len(datos), 100))
    js = ("/* Paquete de datos CIFRADO (AES-256-GCM, clave PBKDF2-SHA256). Generado por scripts/construir_paquete.py.\n"
          "   No contiene la contraseña; 'verificador' es un hash con sal (PBKDF2-HMAC-SHA256, 600 000 iteraciones). */\n"
          f'window.PAQUETE = {{"v":3,"kdf":"PBKDF2-SHA256","iter":{ITER},"sal":"{b64(sal)}","iv":"{b64(iv)}",\n'
          f'"verificador":"{bits[32:].hex()}",\n"datos":"{lineas}"}};\n')
    (RAIZ / "sitio" / "datos" / "paquete.js").write_text(js, encoding="utf-8")
    print(f"OK: {len(claro)} bytes gzip -> {len(datos)} caracteres base64")


if __name__ == "__main__":
    main()
