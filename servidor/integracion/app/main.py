"""API de integración Durango GeoInteligencia v4.
Sirve en la RED MUNICIPAL (no en GitHub Pages). Guarda configuración cifrada en reposo,
prueba el C4, hace de intermediario (evita CORS), escanea SOLO redes autorizadas por el Director
y mantiene bitácora append-only + llaves públicas del Director para verificar credenciales.
"""
from __future__ import annotations
import hashlib, json, os, time
from pathlib import Path
from typing import Any, Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import crypto_local as C
from . import escaneo as E

DATOS = Path(os.environ.get("INTEGRACION_DATOS", Path(__file__).resolve().parent.parent / "datos"))
DATOS.mkdir(parents=True, exist_ok=True)
MASTER = C.cargar_o_crear_maestro(str(DATOS / ".master.key"), os.environ.get("INTEGRACION_MASTER_KEY") or None)
TOKEN_SECRET = (os.environ.get("INTEGRACION_TOKEN_SECRET") or "").encode() or MASTER
CORS = [x.strip() for x in (os.environ.get("INTEGRACION_CORS") or "*").split(",") if x.strip()]

app = FastAPI(title="Durango GeoInteligencia · Integración", version="4.1.0",
              description="Servidor opcional para la red de Seguridad Pública. No publica secretos.")
app.add_middleware(CORSMiddleware, allow_origins=CORS if CORS != ["*"] else ["*"], allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])

def _leer_json(nombre, default):
    p = DATOS / nombre
    if not p.exists(): return default
    return json.loads(p.read_text(encoding="utf-8"))

def _escribir_json(nombre, obj):
    p = DATOS / nombre
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    try: os.chmod(p, 0o600)
    except OSError: pass

def exigir(auth: Optional[str] = Header(None, alias="Authorization")) -> dict:
    if not auth or not auth.lower().startswith("bearer "):
        raise HTTPException(401, "Se requiere token de sesión (Authorization: Bearer …)")
    try:
        return C.leer_token(TOKEN_SECRET, auth.split(" ", 1)[1].strip())
    except ValueError:
        raise HTTPException(401, "Token inválido o expirado")

class SesionIn(BaseModel):
    usuario: str
    rol: str
    nombre: Optional[str] = None

class ConfigIn(BaseModel):
    config: dict
    api_key: Optional[str] = None

class ProbarIn(BaseModel):
    url: str
    usar_llave: bool = True

class EscaneoIn(BaseModel):
    redes: list[dict] = Field(default_factory=list)

class LlaveDirIn(BaseModel):
    usuario: str
    nombre: str
    cargo: Optional[str] = None
    alg: str
    pub: str

class CredIn(BaseModel):
    id: str
    token: str
    payload: dict

@app.get("/salud")
def salud():
    return {"estado": "ok", "servicio": "durango-geointeligencia-integracion", "version": "4.1.0",
            "nota": "Servidor pensado para la red municipal. GitHub Pages no puede escanear su LAN."}

@app.post("/api/sesion")
def sesion(body: SesionIn):
    # Nivel demostración: no hay IdP municipal aquí; el token solo identifica la sesión del panel.
    # En producción: sustituir por autenticación LDAP/AD/OAuth del municipio.
    if body.rol not in ("alfa", "director", "charlie"):
        raise HTTPException(403, "Solo Alfa / Director / Charlie pueden abrir sesión de integración en este servidor de demostración.")
    tk = C.token_sesion(TOKEN_SECRET, {"usuario": body.usuario, "rol": body.rol, "nombre": body.nombre or body.usuario})
    return {"token": tk, "expira_horas": 24}

@app.put("/api/integracion")
def guardar_integracion(body: ConfigIn, ses=Depends(exigir)):
    if ses.get("rol") not in ("alfa", "director"):
        raise HTTPException(403, "Solo Director(a) o Alfa")
    cfg = dict(body.config or {})
    # Nunca persistir la llave API en claro
    cfg.pop("api_key", None)
    sobre = {"config": cfg, "actualizado": int(time.time()), "por": ses["usuario"]}
    if body.api_key:
        sobre["api_key_cifrada"] = C.sellar(MASTER, body.api_key)
    elif (DATOS / "integracion.sealed").exists():
        try:
            prev = C.abrir(MASTER, (DATOS / "integracion.sealed").read_text())
            if "api_key_cifrada" in prev:
                sobre["api_key_cifrada"] = prev["api_key_cifrada"]
        except Exception:
            pass
    (DATOS / "integracion.sealed").write_text(C.sellar(MASTER, sobre), encoding="ascii")
    try: os.chmod(DATOS / "integracion.sealed", 0o600)
    except OSError: pass
    _auditar(ses, "integracion_config", f"C4={cfg.get('base') or cfg.get('ep', {}).get('salud')}")
    return {"ok": True}

def _config_y_llave():
    p = DATOS / "integracion.sealed"
    if not p.exists():
        return {}, None
    sobre = C.abrir(MASTER, p.read_text())
    llave = C.abrir(MASTER, sobre["api_key_cifrada"]) if sobre.get("api_key_cifrada") else None
    return sobre.get("config") or {}, llave

@app.get("/api/integracion")
def leer_integracion(ses=Depends(exigir)):
    cfg, llave = _config_y_llave()
    return {"config": cfg, "tiene_llave_api": bool(llave)}

@app.post("/api/integracion/probar")
async def probar(body: ProbarIn, ses=Depends(exigir)):
    cfg, llave = _config_y_llave()
    headers = {"Accept": "application/json"}
    if body.usar_llave and llave:
        headers[cfg.get("encabezado") or "X-API-Key"] = llave
    t0 = time.time()
    try:
        async with httpx.AsyncClient(verify=True, follow_redirects=True, timeout=8.0) as client:
            r = await client.get(body.url, headers=headers)
        ms = int((time.time() - t0) * 1000)
        muestra = (r.text or "")[:160]
        ok = 200 <= r.status_code < 400
        _auditar(ses, "integracion_prueba", f"{body.url} · servidor · {'OK' if ok else 'falló'} · HTTP {r.status_code}")
        return {"ok": ok, "status": r.status_code, "ms": ms, "muestra": muestra,
                "msg": f"Respondió HTTP {r.status_code} en {ms} ms (vía servidor de integración)." if ok
                       else f"El servidor respondió HTTP {r.status_code}."}
    except httpx.TimeoutException:
        return {"ok": False, "msg": "Sin respuesta en 8 s desde el servidor de integración."}
    except Exception as e:
        return {"ok": False, "msg": f"Error desde el servidor de integración: {e}"}

@app.api_route("/api/c4/{recurso}", methods=["GET"])
async def proxy_c4(recurso: str, ses=Depends(exigir)):
    if recurso not in ("salud", "incidentes", "unidades", "camaras"):
        raise HTTPException(404, "Recurso desconocido")
    cfg, llave = _config_y_llave()
    url = (cfg.get("ep") or {}).get(recurso) or (cfg.get("base") if recurso == "salud" else None)
    if not url:
        raise HTTPException(400, f"Endpoint «{recurso}» no configurado")
    headers = {"Accept": "application/json"}
    if llave:
        headers[cfg.get("encabezado") or "X-API-Key"] = llave
    try:
        async with httpx.AsyncClient(verify=True, follow_redirects=True, timeout=10.0) as client:
            r = await client.get(url, headers=headers)
        if r.status_code >= 400:
            raise HTTPException(r.status_code, f"C4 respondió HTTP {r.status_code}")
        try:
            return r.json()
        except Exception:
            return {"datos": [], "crudo": r.text[:500]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"No se pudo consultar el C4: {e}")

@app.post("/api/escaneo")
async def api_escaneo(body: EscaneoIn, ses=Depends(exigir)):
    if ses.get("rol") not in ("alfa", "director"):
        raise HTTPException(403, "Solo Director(a) o Alfa")
    if not body.redes:
        raise HTTPException(400, "Debe indicar al menos una red autorizada por el Director")
    _auditar(ses, "escaneo_inicio", ", ".join(r.get("valor", "") for r in body.redes)[:300])
    hallazgos = await E.escanear(body.redes)
    for h in hallazgos:
        h["t"] = int(time.time() * 1000)
    _auditar(ses, "escaneo_fin", f"{len(hallazgos)} hallazgo(s)")
    return {"hallazgos": hallazgos, "hosts_evaluados_max": 512,
            "aviso": "Escaneo limitado a redes privadas /24–/30 y hosts listados por el Director. No se escanea internet."}

@app.post("/api/llaves-director")
def llaves_director(body: LlaveDirIn, ses=Depends(exigir)):
    L = _leer_json("llaves_director.json", [])
    L = [x for x in L if not (x.get("usuario") == body.usuario and x.get("pub") == body.pub)]
    L.append({"usuario": body.usuario, "nombre": body.nombre, "cargo": body.cargo, "alg": body.alg, "pub": body.pub,
              "kid": hashlib.sha256(__import__("base64").b64decode(body.pub + "==")).hexdigest()[:16].upper(),
              "t": int(time.time())})
    # kid recalculado abajo en hex con guiones no es crítico para el servidor; guardamos pub
    _escribir_json("llaves_director.json", L)
    _auditar(ses, "llave_director", f"{body.usuario} · {body.alg}")
    return {"ok": True}

@app.get("/api/llaves-director")
def listar_llaves():
    return {"llaves": _leer_json("llaves_director.json", [])}

@app.post("/api/credenciales")
def registrar_cred(body: CredIn, ses=Depends(exigir)):
    L = _leer_json("credenciales.json", [])
    L = [x for x in L if x.get("id") != body.id]
    L.append({"id": body.id, "token": body.token, "payload": body.payload, "estado": "vigente", "t": int(time.time()), "por": ses["usuario"]})
    _escribir_json("credenciales.json", L)
    _auditar(ses, "credencial_emitida", body.id)
    return {"ok": True}

@app.post("/api/credenciales/{cid}/revocar")
def revocar_cred(cid: str, ses=Depends(exigir)):
    L = _leer_json("credenciales.json", [])
    ok = False
    for c in L:
        if c.get("id") == cid:
            c["estado"] = "revocada"; c["revocada"] = int(time.time()); c["revocadaPor"] = ses["usuario"]; ok = True
    if not ok:
        raise HTTPException(404, "Credencial no encontrada")
    _escribir_json("credenciales.json", L)
    _auditar(ses, "credencial_revocada", cid)
    return {"ok": True}

@app.get("/api/credenciales/{cid}")
def ver_cred(cid: str):
    L = _leer_json("credenciales.json", [])
    for c in L:
        if c.get("id") == cid:
            return {"id": c["id"], "estado": c["estado"], "payload": c.get("payload")}
    raise HTTPException(404, "No encontrada")

@app.post("/api/auditoria")
def auditoria(body: dict, ses=Depends(exigir)):
    _auditar(ses, body.get("accion") or "evento", body.get("detalle") or "", externo=body)
    return {"ok": True}

@app.get("/api/auditoria")
def leer_auditoria(ses=Depends(exigir)):
    return {"registros": _leer_json("auditoria.json", [])}

@app.post("/api/mando/transferir")
def transferir(body: dict, ses=Depends(exigir)):
    _escribir_json("mando.json", body)
    _auditar(ses, "traspaso_mando", body.get("propietario", ""))
    return {"ok": True}

@app.post("/api/mando/reactivar-alfa")
def reactivar(body: dict, ses=Depends(exigir)):
    _escribir_json("mando.json", body)
    _auditar(ses, "alfa_reactivado", body.get("reactivadoPor", ""))
    return {"ok": True}

def _auditar(ses, accion, detalle, externo=None):
    L = _leer_json("auditoria.json", [])
    prev = L[-1]["hash"] if L else "0" * 64
    e = {"n": len(L) + 1, "t": int(time.time() * 1000), "usuario": ses.get("usuario"), "rol": ses.get("rol"),
         "accion": accion, "detalle": (detalle or "")[:400], "prev": prev}
    if externo and externo.get("hash"):
        e["hash_cliente"] = externo["hash"]
    base = json.dumps([e["n"], e["t"], e["usuario"], e["rol"], e["accion"], e["detalle"], e["prev"]], ensure_ascii=False, separators=(",", ":"))
    e["hash"] = hashlib.sha256(base.encode()).hexdigest()
    L.append(e)
    _escribir_json("auditoria.json", L)
