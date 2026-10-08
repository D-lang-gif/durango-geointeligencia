from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography, Geometry

from .db import Base


class Unidad(Base):
    __tablename__ = "unidades"
    id = Column(Integer, primary_key=True)
    codigo = Column(String(20), unique=True, nullable=False)
    tipo = Column(String(30), nullable=False, default="patrulla")
    ubicacion = Column(Geography("POINT", srid=4326, spatial_index=False), nullable=False)
    base = Column(Geography("POINT", srid=4326, spatial_index=False), nullable=False)
    ultima_actualizacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    estatus = Column(String(20), nullable=False, default="disponible")


class Incidente(Base):
    __tablename__ = "incidentes"
    id = Column(Integer, primary_key=True)
    folio = Column(String(30), unique=True, nullable=False)
    tipo = Column(String(60), nullable=False)
    prioridad = Column(String(10), nullable=False, default="media")
    ubicacion = Column(Geography("POINT", srid=4326, spatial_index=False), nullable=False)
    direccion = Column(Text)
    telefono_origen = Column(String(20))
    coordenadas_aml = Column(Boolean, nullable=False, default=False)
    unidad_asignada = Column(Integer, ForeignKey("unidades.id", ondelete="SET NULL"))
    tiempo_llamada = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    tiempo_llegada = Column(DateTime(timezone=True))
    estatus = Column(String(20), nullable=False, default="pendiente")
    distancia_metros = Column(Numeric(10, 1))
    eta_minutos = Column(Numeric(6, 1))
    ejido_referencia = Column(String(80))
    unidad = relationship("Unidad", lazy="joined")


class Ejido(Base):
    __tablename__ = "ejidos"
    id = Column(Integer, primary_key=True)
    nombre = Column(String(80), nullable=False)
    nombre_oficial = Column(String(120), nullable=False)
    cvegeo = Column(String(9), unique=True, nullable=False)
    ubicacion = Column(Geography("POINT", srid=4326, spatial_index=False), nullable=False)
    poblacion_2020 = Column(Integer)
    fuente = Column(Text, nullable=False)
    url_fuente = Column(Text, nullable=False)
    osm_id = Column(String(30))
    verificacion = Column(Text)
    notas = Column(Text)


class LimiteMunicipal(Base):
    __tablename__ = "limite_municipal"
    id = Column(Integer, primary_key=True)
    nombre = Column(String(80), nullable=False)
    fuente = Column(Text, nullable=False)
    geom = Column(Geometry("MULTIPOLYGON", srid=4326, spatial_index=False), nullable=False)
