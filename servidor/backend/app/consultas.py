"""Consultas espaciales. Corrige los errores del código original:
- ST_X / ST_Y no aceptan GEOGRAPHY: se hace cast(..., Geometry) antes.
- En vez de un db.scalar(func.ST_Y(u.ubicacion)) por cada fila (N+1 consultas),
  lat/lon se obtienen en la MISMA consulta como columnas etiquetadas.
"""
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session
from geoalchemy2 import Geography, Geometry

from .models import Ejido, Incidente, LimiteMunicipal, Unidad

VELOCIDAD_KMH = 40.0
ESTATUS_ACTIVOS = ("pendiente", "asignado", "en_sitio")


def lat_of(col):
    return func.ST_Y(cast(col, Geometry))


def lon_of(col):
    return func.ST_X(cast(col, Geometry))


def punto(lat: float, lon: float):
    return cast(func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326), Geography)


def _iso(dt):
    return dt.isoformat() if dt else None


def listar_unidades(db: Session):
    folio_activo = (
        select(Incidente.folio)
        .where(Incidente.unidad_asignada == Unidad.id, Incidente.estatus.in_(("asignado", "en_sitio")))
        .order_by(Incidente.tiempo_llamada.desc())
        .limit(1)
        .scalar_subquery()
    )
    rows = db.execute(
        select(Unidad, lat_of(Unidad.ubicacion).label("lat"), lon_of(Unidad.ubicacion).label("lon"),
               folio_activo.label("folio"))
        .order_by(Unidad.codigo)
    ).all()
    return [
        {"id": u.id, "codigo": u.codigo, "tipo": u.tipo, "estatus": u.estatus,
         "lat": round(lat, 6), "lon": round(lon, 6),
         "ultima_actualizacion": _iso(u.ultima_actualizacion), "incidente_folio": folio,
         "simulado": True}
        for u, lat, lon, folio in rows
    ]


def listar_incidentes_activos(db: Session):
    rows = db.execute(
        select(Incidente, lat_of(Incidente.ubicacion).label("lat"), lon_of(Incidente.ubicacion).label("lon"))
        .where(Incidente.estatus.in_(ESTATUS_ACTIVOS))
        .order_by(Incidente.tiempo_llamada.desc())
    ).unique().all()
    return [
        {"id": i.id, "folio": i.folio, "tipo": i.tipo, "prioridad": i.prioridad, "estatus": i.estatus,
         "lat": round(lat, 6), "lon": round(lon, 6), "direccion": i.direccion,
         "telefono_origen": i.telefono_origen, "coordenadas_aml": i.coordenadas_aml,
         "patrulla_asignada": i.unidad.codigo if i.unidad else None,
         "tiempo_llamada": _iso(i.tiempo_llamada), "tiempo_llegada": _iso(i.tiempo_llegada),
         "distancia_metros": float(i.distancia_metros) if i.distancia_metros is not None else None,
         "eta_minutos": float(i.eta_minutos) if i.eta_minutos is not None else None,
         "ejido_referencia": i.ejido_referencia, "simulado": True}
        for i, lat, lon in rows
    ]


def listar_ejidos(db: Session):
    rows = db.execute(
        select(Ejido, lat_of(Ejido.ubicacion).label("lat"), lon_of(Ejido.ubicacion).label("lon")).order_by(Ejido.nombre)
    ).all()
    return [
        {"id": e.id, "nombre": e.nombre, "nombre_oficial": e.nombre_oficial, "cvegeo": e.cvegeo,
         "lat": lat, "lon": lon, "poblacion_2020": e.poblacion_2020, "fuente": e.fuente,
         "url_fuente": e.url_fuente, "osm_id": e.osm_id, "verificacion": e.verificacion, "notas": e.notas}
        for e, lat, lon in rows
    ]


def limite_geojson(db: Session):
    row = db.execute(select(LimiteMunicipal.nombre, LimiteMunicipal.fuente, func.ST_AsGeoJSON(LimiteMunicipal.geom, 6))).first()
    if not row:
        return None
    import json
    return {"type": "Feature", "properties": {"nombre": row[0], "fuente": row[1]}, "geometry": json.loads(row[2])}


def dentro_municipio(db: Session, lat: float, lon: float) -> bool | None:
    return db.scalar(
        select(func.ST_Contains(LimiteMunicipal.geom, func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326))).limit(1)
    )


def ejido_mas_cercano(db: Session, lat: float, lon: float):
    p = punto(lat, lon)
    row = db.execute(
        select(Ejido.nombre, func.ST_Distance(Ejido.ubicacion, p).label("d")).order_by("d").limit(1)
    ).first()
    return (row[0], float(row[1])) if row else (None, None)


def unidad_disponible_mas_cercana(db: Session, ubicacion_expr):
    """Unidad 'disponible' más cercana (distancia geodésica en metros, ST_Distance sobre GEOGRAPHY).
    FOR UPDATE SKIP LOCKED evita que dos llamadas simultáneas tomen la misma patrulla."""
    dist = func.ST_Distance(Unidad.ubicacion, ubicacion_expr).label("distancia")
    return db.execute(
        select(Unidad, dist)
        .where(Unidad.estatus == "disponible")
        .order_by(dist)
        .limit(1)
        .with_for_update(of=Unidad, skip_locked=True)
    ).first()


def eta_minutos(distancia_m: float) -> float:
    return round(distancia_m / 1000.0 / VELOCIDAD_KMH * 60.0, 1)


def resumen(db: Session):
    u = dict(db.execute(select(Unidad.estatus, func.count()).group_by(Unidad.estatus)).all())
    i = dict(db.execute(select(Incidente.estatus, func.count()).group_by(Incidente.estatus)).all())
    return {
        "unidades_total": sum(u.values()), "unidades_disponibles": u.get("disponible", 0),
        "unidades_ocupadas": u.get("asignada", 0) + u.get("en_sitio", 0),
        "incidentes_activos": sum(i.get(s, 0) for s in ESTATUS_ACTIVOS),
        "incidentes_pendientes": i.get("pendiente", 0), "incidentes_cerrados": i.get("cerrado", 0),
        "ejidos": db.scalar(select(func.count()).select_from(Ejido)),
    }
