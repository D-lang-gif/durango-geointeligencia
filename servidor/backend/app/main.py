"""Durango GeoInteligencia — API (FastAPI + SQLAlchemy + GeoAlchemy2 + PostGIS).
PROTOTIPO DE DEMOSTRACIÓN: patrullas, incidentes y teléfonos son DATOS SIMULADOS.
Ubicaciones de ejidos: INEGI (verificación cruzada con OpenStreetMap)."""
import asyncio
import json
import logging
import os
import pathlib
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.orm import Session, noload

from . import consultas as q
from . import simulacion
from .db import SessionLocal, get_db
from .models import Incidente, Unidad

log = logging.getLogger("geointeligencia")
TZ = ZoneInfo("America/Mexico_City")
DB_DIR = pathlib.Path(os.getenv("DB_DIR", pathlib.Path(__file__).resolve().parents[2] / "db"))
AVISO = "Prototipo de demostración. Patrullas, incidentes y teléfonos son datos simulados. Ubicaciones de ejidos: INEGI/OSM."


class Conexiones:
    def __init__(self):
        self.activas: set[WebSocket] = set()

    async def difundir(self, mensaje: dict):
        datos = json.dumps(mensaje, ensure_ascii=False, default=str)
        for ws in list(self.activas):
            try:
                await ws.send_text(datos)
            except Exception:
                self.activas.discard(ws)


conexiones = Conexiones()


def instantanea() -> dict:
    with SessionLocal() as db:
        return {"tipo": "actualizacion", "unidades": q.listar_unidades(db),
                "incidentes": q.listar_incidentes_activos(db), "resumen": q.resumen(db),
                "hora": datetime.now(TZ).isoformat(), "aviso": AVISO}


async def ciclo_simulacion():
    while True:
        try:
            await run_in_threadpool(simulacion.paso)
            if conexiones.activas:
                await conexiones.difundir(await run_in_threadpool(instantanea))
        except Exception:
            log.exception("Error en ciclo de simulación")
        await asyncio.sleep(simulacion.INTERVALO_S)


@asynccontextmanager
async def lifespan(app: FastAPI):
    tarea = asyncio.create_task(ciclo_simulacion())
    yield
    tarea.cancel()


app = FastAPI(title="Durango GeoInteligencia API", version="0.2.0", description=AVISO, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class IncidenteIn(BaseModel):
    tipo: str = Field(..., min_length=2, max_length=60)
    prioridad: Literal["alta", "media", "baja"] = "media"
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    direccion: Optional[str] = Field(None, max_length=300)
    telefono_origen: Optional[str] = Field(None, max_length=20)
    coordenadas_aml: bool = False
    ejido_referencia: Optional[str] = Field(None, max_length=80)


def _asignar(db: Session, inc: Incidente) -> dict:
    fila = q.unidad_disponible_mas_cercana(db, inc.ubicacion)
    if not fila:
        inc.estatus = "pendiente"
        return {"patrulla_asignada": None, "eta_minutos": None, "distancia_metros": None,
                "mensaje": "Sin unidades disponibles en este momento: el incidente queda PENDIENTE de asignación."}
    unidad, distancia = fila
    unidad.estatus = "asignada"
    inc.unidad_asignada = unidad.id
    inc.estatus = "asignado"
    inc.distancia_metros = round(distancia, 1)
    inc.eta_minutos = q.eta_minutos(distancia)
    return {"patrulla_asignada": unidad.codigo, "eta_minutos": float(inc.eta_minutos),
            "distancia_metros": float(inc.distancia_metros),
            "mensaje": f"Unidad {unidad.codigo} asignada (la más cercana disponible)."}


def _crear_incidente(datos: IncidenteIn) -> dict:
    with SessionLocal() as db, db.begin():
        ejido, dist_ejido = q.ejido_mas_cercano(db, datos.lat, datos.lon)
        dentro = q.dentro_municipio(db, datos.lat, datos.lon)
        # El punto se crea como expresión PostGIS (SRID 4326, GEOGRAPHY) directamente en el INSERT
        inc = Incidente(folio=f"TMP-{uuid.uuid4().hex[:12]}", tipo=datos.tipo, prioridad=datos.prioridad,
                        ubicacion=q.punto(datos.lat, datos.lon), direccion=datos.direccion,
                        telefono_origen=datos.telefono_origen, coordenadas_aml=datos.coordenadas_aml,
                        ejido_referencia=datos.ejido_referencia or ejido)
        db.add(inc)
        db.flush()
        inc.folio = f"GP-{datetime.now(TZ):%Y%m%d}-{inc.id:04d}"
        db.flush()
        db.refresh(inc, ["ubicacion"])  # para que ST_Distance use el valor ya guardado
        res = _asignar(db, inc)
        r = {"id": inc.id, "folio": inc.folio, "estatus": inc.estatus, **res,
             "velocidad_supuesta_kmh": q.VELOCIDAD_KMH, "calculo": "distancia geodésica en línea recta (ST_Distance sobre GEOGRAPHY)",
             "ejido_cercano": ejido, "distancia_ejido_m": round(dist_ejido, 0) if dist_ejido is not None else None,
             "dentro_municipio": dentro, "simulado": True, "aviso": AVISO}
        if dentro is False:
            r["mensaje"] += " ATENCIÓN: el punto está fuera del municipio de Gómez Palacio."
        return r


@app.get("/api/salud")
def salud(db: Session = Depends(get_db)):
    return {"ok": True, "postgis": db.scalar(text("SELECT postgis_lib_version()")), "aviso": AVISO}


@app.post("/api/incidente", status_code=201)
async def crear_incidente(datos: IncidenteIn):
    r = await run_in_threadpool(_crear_incidente, datos)
    await conexiones.difundir(await run_in_threadpool(instantanea))
    return r


@app.post("/api/incidente/{incidente_id}/asignar")
async def asignar_pendiente(incidente_id: int):
    def _f():
        with SessionLocal() as db, db.begin():
            inc = db.scalar(select(Incidente).options(noload(Incidente.unidad))
                            .where(Incidente.id == incidente_id).with_for_update(of=Incidente))
            if not inc:
                raise HTTPException(404, "Incidente no encontrado")
            if inc.estatus != "pendiente":
                raise HTTPException(409, f"El incidente ya está en estatus '{inc.estatus}'")
            return {"id": inc.id, "folio": inc.folio, **_asignar(db, inc), "estatus": inc.estatus, "simulado": True}
    r = await run_in_threadpool(_f)
    await conexiones.difundir(await run_in_threadpool(instantanea))
    return r


@app.get("/api/unidades")
def unidades(db: Session = Depends(get_db)):
    return q.listar_unidades(db)


@app.get("/api/incidentes/activos")
def incidentes_activos(db: Session = Depends(get_db)):
    return q.listar_incidentes_activos(db)


@app.get("/api/ejidos")
def ejidos(db: Session = Depends(get_db)):
    return q.listar_ejidos(db)


@app.get("/api/limite")
def limite(db: Session = Depends(get_db)):
    f = q.limite_geojson(db)
    if not f:
        raise HTTPException(404, "Sin límite municipal cargado")
    return f


@app.get("/api/resumen")
def resumen(db: Session = Depends(get_db)):
    return {**q.resumen(db), "aviso": AVISO}


@app.post("/api/demo/reiniciar")
async def reiniciar_demo():
    """Restablece patrullas e incidentes de ejemplo (útil antes de una presentación)."""
    def _f():
        sql = (DB_DIR / "04_seed.sql").read_text(encoding="utf-8")
        sql = "\n".join(l for l in sql.splitlines() if l.strip().upper() not in ("BEGIN;", "COMMIT;"))
        with SessionLocal() as db, db.begin():
            db.execute(text("TRUNCATE incidentes, unidades CASCADE"))
            db.connection().exec_driver_sql(sql)
    await run_in_threadpool(_f)
    await conexiones.difundir(await run_in_threadpool(instantanea))
    return {"ok": True, "mensaje": "Demo reiniciada con datos de ejemplo."}


@app.websocket("/ws/tiempo-real")
async def tiempo_real(ws: WebSocket):
    await ws.accept()
    conexiones.activas.add(ws)
    try:
        await ws.send_text(json.dumps(await run_in_threadpool(instantanea), ensure_ascii=False, default=str))
        while True:
            await ws.receive_text()  # mantener viva la conexión; los datos se envían desde el ciclo global
    except WebSocketDisconnect:
        pass
    finally:
        conexiones.activas.discard(ws)
