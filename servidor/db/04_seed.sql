-- DATOS DE EJEMPLO / SIMULADOS. Patrullas, incidentes y teléfonos son ficticios.
-- Ubicaciones de patrullas verificadas dentro de la mancha urbana de Gómez Palacio
-- (geocodificación inversa OSM/Nominatim y ST_Contains contra el límite municipal).
BEGIN;
INSERT INTO unidades (codigo, tipo, ubicacion, base, estatus) VALUES
 ('P-101','patrulla', ST_SetSRID(ST_MakePoint(-103.4990,25.5692),4326)::geography, ST_SetSRID(ST_MakePoint(-103.4990,25.5692),4326)::geography, 'disponible'), -- Centro
 ('P-102','patrulla', ST_SetSRID(ST_MakePoint(-103.4780,25.5640),4326)::geography, ST_SetSRID(ST_MakePoint(-103.4780,25.5640),4326)::geography, 'disponible'), -- oriente
 ('P-103','patrulla', ST_SetSRID(ST_MakePoint(-103.4900,25.5480),4326)::geography, ST_SetSRID(ST_MakePoint(-103.4900,25.5480),4326)::geography, 'disponible'), -- sur (original -103.5040,25.5380 caía en Lerdo)
 ('P-104','patrulla', ST_SetSRID(ST_MakePoint(-103.4800,25.5900),4326)::geography, ST_SetSRID(ST_MakePoint(-103.4800,25.5900),4326)::geography, 'disponible'), -- norte-oriente (original -103.4670,25.5250 caía en Torreón, Coah.)
 ('P-105','patrulla', ST_SetSRID(ST_MakePoint(-103.5070,25.5850),4326)::geography, ST_SetSRID(ST_MakePoint(-103.5070,25.5850),4326)::geography, 'disponible'); -- norponiente

-- 5 incidentes de prueba en ejidos verificados (desplazados unos cientos de metros del punto INEGI)
INSERT INTO incidentes (folio, tipo, prioridad, ubicacion, direccion, telefono_origen, coordenadas_aml, tiempo_llamada, estatus, ejido_referencia) VALUES
 ('GP-DEMO-0001','Robo a casa habitación','alta',  ST_SetSRID(ST_MakePoint(-103.3545,25.7801),4326)::geography,'Ejido Venecia (ejemplo)',     '871-SIM-0101', TRUE,  now() - interval '25 minutes','pendiente','Venecia'),
 ('GP-DEMO-0002','Accidente vial','alta',          ST_SetSRID(ST_MakePoint(-103.5680,25.7568),4326)::geography,'Ejido Brittingham (ejemplo)', '871-SIM-0102', TRUE,  now() - interval '18 minutes','pendiente','Brittingham'),
 ('GP-DEMO-0003','Riña en vía pública','media',    ST_SetSRID(ST_MakePoint(-103.4680,25.6795),4326)::geography,'La Popular (ejemplo)',        '871-SIM-0103', FALSE, now() - interval '12 minutes','pendiente','La Popular'),
 ('GP-DEMO-0004','Violencia familiar','alta',      ST_SetSRID(ST_MakePoint(-103.6590,25.7215),4326)::geography,'Ejido Dinamita (ejemplo)',    '871-SIM-0104', TRUE,  now() - interval '7 minutes', 'pendiente','Dinamita'),
 ('GP-DEMO-0005','Persona sospechosa','baja',      ST_SetSRID(ST_MakePoint(-103.4250,25.6838),4326)::geography,'Ejido Tajo Viejo (ejemplo)',  '871-SIM-0105', FALSE, now() - interval '3 minutes', 'pendiente','Tajo Viejo');
-- Dos incidentes ya despachados al iniciar la demo (para que se vea el movimiento hacia el incidente)
UPDATE incidentes i SET unidad_asignada = u.id, estatus = 'asignado',
       distancia_metros = round(ST_Distance(u.ubicacion, i.ubicacion)::numeric, 1),
       eta_minutos      = round((ST_Distance(u.ubicacion, i.ubicacion) / 1000 / 40 * 60)::numeric, 1)
  FROM unidades u
 WHERE (i.folio, u.codigo) IN (('GP-DEMO-0003','P-104'), ('GP-DEMO-0005','P-102'));
UPDATE unidades SET estatus = 'asignada' WHERE codigo IN ('P-104','P-102');
COMMIT;
