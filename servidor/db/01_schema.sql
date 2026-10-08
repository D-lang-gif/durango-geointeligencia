-- Durango GeoInteligencia · Esquema (PostgreSQL + PostGIS)
-- Todas las ubicaciones se guardan como GEOGRAPHY(POINT, 4326): longitud/latitud WGS84, distancias en metros.
CREATE EXTENSION IF NOT EXISTS postgis;

DROP TABLE IF EXISTS incidentes CASCADE;
DROP TABLE IF EXISTS unidades CASCADE;
DROP TABLE IF EXISTS ejidos CASCADE;
DROP TABLE IF EXISTS limite_municipal CASCADE;

-- Unidades (patrullas) — DATOS SIMULADOS
CREATE TABLE unidades (
    id                    SERIAL PRIMARY KEY,
    codigo                VARCHAR(20)  NOT NULL UNIQUE,
    tipo                  VARCHAR(30)  NOT NULL DEFAULT 'patrulla',
    ubicacion             GEOGRAPHY(POINT, 4326) NOT NULL,
    base                  GEOGRAPHY(POINT, 4326) NOT NULL,   -- punto de patrullaje de la unidad
    ultima_actualizacion  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    estatus               VARCHAR(20)  NOT NULL DEFAULT 'disponible'
                          CHECK (estatus IN ('disponible','asignada','en_sitio','fuera_servicio'))
);
CREATE INDEX idx_unidades_ubicacion ON unidades USING GIST (ubicacion);

-- Incidentes — DATOS SIMULADOS (no provienen de C4/C5/911)
CREATE TABLE incidentes (
    id                 SERIAL PRIMARY KEY,
    folio              VARCHAR(30)  NOT NULL UNIQUE,
    tipo               VARCHAR(60)  NOT NULL,
    prioridad          VARCHAR(10)  NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta','media','baja')),
    ubicacion          GEOGRAPHY(POINT, 4326) NOT NULL,
    direccion          TEXT,
    telefono_origen    VARCHAR(20),
    coordenadas_aml    BOOLEAN      NOT NULL DEFAULT FALSE,
    unidad_asignada    INTEGER REFERENCES unidades(id) ON DELETE SET NULL,
    tiempo_llamada     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    tiempo_llegada     TIMESTAMPTZ,
    estatus            VARCHAR(20)  NOT NULL DEFAULT 'pendiente'
                       CHECK (estatus IN ('pendiente','asignado','en_sitio','cerrado')),
    distancia_metros   NUMERIC(10,1),
    eta_minutos        NUMERIC(6,1),
    ejido_referencia   VARCHAR(80)
);
CREATE INDEX idx_incidentes_ubicacion ON incidentes USING GIST (ubicacion);
CREATE INDEX idx_incidentes_estatus   ON incidentes (estatus);

-- Ejidos / localidades verificadas (INEGI, verificación cruzada con OSM)
CREATE TABLE ejidos (
    id                SERIAL PRIMARY KEY,
    nombre            VARCHAR(80)  NOT NULL,
    nombre_oficial    VARCHAR(120) NOT NULL,
    cvegeo            VARCHAR(9)   NOT NULL UNIQUE,
    ubicacion         GEOGRAPHY(POINT, 4326) NOT NULL,
    poblacion_2020    INTEGER,
    fuente            TEXT NOT NULL,
    url_fuente        TEXT NOT NULL,
    osm_id            VARCHAR(30),
    verificacion      TEXT,
    notas             TEXT
);
CREATE INDEX idx_ejidos_ubicacion ON ejidos USING GIST (ubicacion);

-- Límite municipal de Gómez Palacio (OpenStreetMap, relación 5605840) para validar puntos
CREATE TABLE limite_municipal (
    id        SERIAL PRIMARY KEY,
    nombre    VARCHAR(80) NOT NULL,
    fuente    TEXT NOT NULL,
    geom      GEOMETRY(MULTIPOLYGON, 4326) NOT NULL
);
CREATE INDEX idx_limite_geom ON limite_municipal USING GIST (geom);
