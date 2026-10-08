"""Simulación de GPS (DATOS SIMULADOS). Un solo ciclo global cada 3 s, compartido por todos los clientes
WebSocket (el original simulaba por conexión: con 2 navegadores abiertos las patrullas se movían al doble)."""
import os
from sqlalchemy import text

from .db import SessionLocal

INTERVALO_S = float(os.getenv("SIM_INTERVALO_S", "3"))
FACTOR = float(os.getenv("SIM_FACTOR_TIEMPO", "15"))        # simulación acelerada (x15) para la demo
VEL_MS = 40.0 * 1000 / 3600                                  # 40 km/h
PASO_M = VEL_MS * INTERVALO_S * FACTOR                       # metros por ciclo (~500 m con x15)
TIEMPO_EN_SITIO_S = float(os.getenv("SIM_TIEMPO_EN_SITIO_S", "60"))
RADIO_PATRULLAJE_M = 1200.0


def paso() -> None:
    with SessionLocal() as db, db.begin():
        # 1) Unidades asignadas avanzan hacia su incidente (sobre el elipsoide: ST_Project + ST_Azimuth en GEOGRAPHY)
        asignadas = db.execute(text("""
            SELECT u.id AS uid, i.id AS iid, ST_Distance(u.ubicacion, i.ubicacion) AS d
            FROM unidades u JOIN incidentes i ON i.unidad_asignada = u.id AND i.estatus = 'asignado'
            WHERE u.estatus = 'asignada'
        """)).all()
        for uid, iid, d in asignadas:
            if d <= PASO_M:
                db.execute(text("""UPDATE unidades SET ubicacion = (SELECT ubicacion FROM incidentes WHERE id=:iid),
                                   estatus='en_sitio', ultima_actualizacion=now() WHERE id=:uid"""), {"iid": iid, "uid": uid})
                db.execute(text("UPDATE incidentes SET estatus='en_sitio', tiempo_llegada=now() WHERE id=:iid"), {"iid": iid})
            else:
                db.execute(text("""UPDATE unidades u SET ubicacion = ST_Project(u.ubicacion, :paso, ST_Azimuth(u.ubicacion, i.ubicacion)),
                                   ultima_actualizacion = now() FROM incidentes i WHERE u.id=:uid AND i.id=:iid"""),
                           {"paso": PASO_M, "uid": uid, "iid": iid})
        # Unidades 'asignada' sin incidente vigente → disponibles
        db.execute(text("""UPDATE unidades u SET estatus='disponible' WHERE u.estatus IN ('asignada','en_sitio')
                           AND NOT EXISTS (SELECT 1 FROM incidentes i WHERE i.unidad_asignada=u.id AND i.estatus IN ('asignado','en_sitio'))"""))
        # 2) Tras un tiempo en sitio se cierra el incidente y la unidad queda disponible
        db.execute(text("""WITH c AS (UPDATE incidentes SET estatus='cerrado'
                              WHERE estatus='en_sitio' AND tiempo_llegada < now() - make_interval(secs => :t)
                              RETURNING unidad_asignada)
                           UPDATE unidades SET estatus='disponible' WHERE id IN (SELECT unidad_asignada FROM c)"""),
                   {"t": TIEMPO_EN_SITIO_S})
        # 3) Unidades disponibles: patrullaje aleatorio cerca de su base; si están lejos, regresan a la base
        db.execute(text("""
            UPDATE unidades SET ubicacion = CASE
                WHEN ST_Distance(ubicacion, base) > :radio
                    THEN ST_Project(ubicacion, LEAST(:paso, ST_Distance(ubicacion, base)), ST_Azimuth(ubicacion, base))
                ELSE ST_Project(ubicacion, 40 + random()*80, random()*2*pi())
            END, ultima_actualizacion = now()
            WHERE estatus = 'disponible'"""), {"radio": RADIO_PATRULLAJE_M, "paso": PASO_M})
