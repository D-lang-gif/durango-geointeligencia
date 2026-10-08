# Durango GeoInteligencia · Plan de escalamiento municipal, estatal y federal

*Hoja de ruta honesta para convertir el prototipo de demostración en un sistema operativo de geointeligencia para seguridad pública, con posibilidad de réplica nacional — sin exagerar capacidades ni inventar respaldos.*

| | |
|---|---|
| **Proponente** | Raúl Muñoz Villa · Gómez Palacio, Durango |
| **Fecha** | 8 de octubre de 2026 |
| **Destinatarios sugeridos** | Dirección / Secretaría de Seguridad Pública del Municipio de Gómez Palacio; en su caso, Secretaría de Seguridad Pública del Estado de Durango; Secretariado Ejecutivo del Sistema Nacional de Seguridad Pública (SESNSP); y autoridades federales competentes. |

*Documento de trabajo · Prototipo cívico · Sin respaldo oficial.*

> **Nota de esta versión:** texto convertido a Markdown desde el documento original `Plan_Escalamiento_GeoInteligencia_2026-10-08.docx` (19 páginas en PDF) para poder leerlo en GitHub. Se conservó todo el contenido; solo se adaptó el formato (títulos, tablas, enlaces). El PDF y el DOCX originales no están en este repositorio.

> [!WARNING]
> **ADVERTENCIA IMPORTANTE**
>
> Este documento describe un prototipo de demostración cívica. No es un sistema oficial, no está conectado al C4/C5 ni al 9-1-1, y no cuenta con respaldo, convenio ni certificación de ninguna autoridad. Patrullas, incidentes, folios y teléfonos son datos simulados. Su propósito es que, si las autoridades aceptan evaluarlo, el proponente tenga una ruta clara, realista y verificable de lo que se requiere para no fallar en la implementación.

**Demo en línea** (nivel demostración, con contraseña): <https://d-lang-gif.github.io/durango-geointeligencia/>  
**Código:** <https://github.com/D-lang-gif/durango-geointeligencia>

## Contenido

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Qué es hoy el prototipo y qué NO es](#2-qué-es-hoy-el-prototipo-y-qué-no-es)
3. [Pros, contras y riesgos](#3-pros-contras-y-riesgos)
4. [Marco legal y normativo relevante](#4-marco-legal-y-normativo-relevante)
5. [Requisitos técnicos para producción](#5-requisitos-técnicos-para-producción)
6. [Equipo humano y capacitación](#6-equipo-humano-y-capacitación)
7. [Costos aproximados por fase y posibles fuentes de financiamiento](#7-costos-aproximados-por-fase-y-posibles-fuentes-de-financiamiento)
8. [Hoja de ruta por fases (0 a 4)](#8-hoja-de-ruta-por-fases)
9. [Lista de verificación «para no fallar» antes de cada reunión](#9-lista-de-verificación-para-no-fallar-antes-de-cada-reunión)
10. [Preguntas difíciles y respuestas honestas](#10-preguntas-difíciles-y-cómo-responder-con-honestidad)
11. [Próximos pasos inmediatos](#11-próximos-pasos-inmediatos)
12. [Fuentes consultadas](#12-fuentes-consultadas)

- [Anexo A. Glosario (términos en lenguaje sencillo)](#anexo-a-glosario-términos-en-lenguaje-sencillo)

## 1. Resumen ejecutivo

Durango GeoInteligencia es un prototipo web de geointeligencia para seguridad pública, enfocado en el municipio de Gómez Palacio, Durango. Muestra en un mapa las localidades del municipio, ejidos verificados, llamadas simuladas al 9-1-1, asignación de la patrulla más cercana por tiempo de manejo en calles y un mapa de calor. Existe una demo pública en GitHub Pages y una versión con servidor (FastAPI + PostgreSQL/PostGIS) lista como base técnica futura.

Este plan responde a una necesidad concreta del proponente, Raúl Muñoz Villa: si Seguridad Pública municipal (y más adelante autoridades estatales o federales) aceptan el prototipo, debe existir una hoja de ruta completa, honesta y accionable para convertirlo en un sistema real y, eventualmente, replicarlo. El documento no promete milagros; describe limitaciones, riesgos, marco legal, requisitos técnicos, equipo, costos estimados y fases.

### Lo esencial en cinco puntos

- Hoy es una demostración. No opera con datos reales de C4/C5/9-1-1; no despacha patrullas reales; no sustituye Plataforma México ni los Centros de Comando y Control.
- Su valor potencial está en la integración geoespacial abierta (INEGI + OpenStreetMap), el enrutamiento por calles, la transparencia del código (código abierto) y la replicabilidad a bajo costo de licencias.
- Para pasar a producción se requieren: convenio institucional, datos reales bajo protección de datos personales, hosting propio, servidor de rutas propio, autenticación fuerte, ciberseguridad, interoperabilidad con 9-1-1/CAD y con el Sistema Nacional de Información, y personal capacitado.
- El marco legal vigente (2025–2026) incluye la nueva Ley General del Sistema Nacional de Seguridad Pública (DOF 16/07/2025), la Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados (DOF 20/03/2025), lineamientos de telecomunicaciones para geolocalización al 9-1-1 (antes IFT; hoy CRT/ATDT), y la Ley del Sistema Estatal de Seguridad Pública de Durango (P.O. 07/06/2026).
- Financiamiento: FASP y FORTAMUN siguen vigentes; FORTASEG se eliminó del PEF 2021. Cualquier cifra de costo en este documento es un rango estimado con supuestos explícitos, no una cotización.

Recomendación del proponente: presentar primero la demo municipal a Seguridad Pública de Gómez Palacio; si hay interés, firmar un convenio de piloto con datos reales acotados; solo después escalar a La Laguna, al estado y a un modelo federal replicable. En cada paso, medir tiempos de respuesta y calidad del dato, no solo «tener un mapa bonito».

## 2. Qué es hoy el prototipo y qué NO es

### 2.1 Qué SÍ es

- Un prototipo público de demostración (nivel demo) para Gómez Palacio, Durango.
- Sitio estático en GitHub Pages: <https://d-lang-gif.github.io/durango-geointeligencia/> (acceso con contraseña de nivel demostración).
- Mapa con Leaflet + mosaicos de OpenStreetMap.
- 494 localidades del municipio según el Catálogo Único de Claves Geoestadísticas de INEGI (municipio 10-007).
- 13 ejidos/localidades verificados con coordenadas INEGI y contraste OpenStreetMap.
- Perímetros Lavín y Sacramento mostrados solo por las localidades que los integran (SIDEAPAAR 2023); no existe polígono oficial dibujable en INEGI ni OSM.
- Llamadas simuladas al 9-1-1; asignación de patrulla por tiempo de manejo vía servidor público OSRM (con respaldo en línea recta si falla).
- Simulación de movimiento de patrullas, tiempo en sitio y cierre de incidente; mapa de calor.
- Código en GitHub (público): <https://github.com/D-lang-gif/durango-geointeligencia>
- Versión con servidor (FastAPI + PostgreSQL/PostGIS + docker-compose) como base técnica futura.
- Una v3 en progreso contempla ~20 patrullas simuladas con claves ficticias de oficiales, un modelo horario de riesgo estimado (no oficial) y estadísticas mensuales municipales del SESNSP.

### 2.2 Qué NO es (límites honestos)

- NO es un sistema oficial de seguridad pública ni tiene convenio con el Ayuntamiento, el Estado o la Federación.
- NO está conectado al C4, C5, Centro de Comando estatal, CAD del 9-1-1 ni a ninguna red policial.
- NO despacha patrullas reales; todas las patrullas, incidentes, folios y teléfonos (formato 871-SIM-####) son simulados.
- NO sustituye ni compite formalmente con Plataforma México / Plataforma Central de Inteligencia, ni con los sistemas CAD estatales.
- NO garantiza disponibilidad 24/7: depende de GitHub Pages, de un servidor OSRM público de demostración y de mosaicos OSM públicos.
- NO cumple aún requisitos de producción: autenticación institucional, HTTPS propio, bitácoras de auditoría, respaldos, SLA, 2FA, etc.
- NO trata datos personales reales de víctimas, denunciantes u oficiales.
- La contraseña de la demo es protección de nivel demostración (el código y los datos geográficos públicos están en el repositorio).
- El modelo de riesgo de la v3 (si se publica) será estimado, no un producto oficial de inteligencia.

> **Nota:** Decir «es solo un prototipo» no es debilidad: es la condición para que las autoridades confíen en la honestidad del proponente y puedan evaluar con claridad.

## 3. Pros, contras y riesgos

### 3.1 Beneficios potenciales (si se implementa bien)

| Beneficio | Por qué importa | Condición para lograrlo |
|---|---|---|
| Menor tiempo de respuesta | Asignar la unidad más cercana por calles, no «a ojo». | GPS/AVL real en patrullas + rutas propias + CAD. |
| Código abierto / sin licencias caras | Leaflet, OSM, PostGIS, OSRM, FastAPI son libres. | Equipo técnico propio o contratado que los mantenga. |
| Integración de datos | INEGI + OSM + (futuro) SESNSP / CAD / C5. | Convenios y estándares de intercambio. |
| Replicabilidad | Otro municipio puede adaptar el mismo modelo. | Documentación, empaquetado y capacitación. |
| Transparencia técnica | El código se puede auditar. | Gobernanza clara de quién publica y cambia código. |
| Visibilidad territorial | Localidades y ejidos en un solo mapa operativo. | Actualización periódica de capas INEGI/OSM. |
| Base para análisis | Mapas de calor y (futuro) riesgo horario. | Datos reales de calidad, no solo simulación. |

### 3.2 Contras, riesgos y fricciones

| Riesgo | Qué puede pasar | Mitigación sugerida |
|---|---|---|
| Privacidad / datos personales | Tratar ubicaciones, teléfonos o identidades sin base legal. | Convenio + aviso de privacidad + minimización de datos + LGPDPPSO. |
| Ciberseguridad | Ataque, filtración o secuestro del sistema. | Hosting endurecido, 2FA, bitácoras, alineación ISO 27001 / guías gov. |
| Dependencia de OSRM público | El demo server no es para producción; puede caer o limitar uso. | Servidor OSRM/pgRouting propio con mapa OSM México. |
| Dependencia de mosaicos OSM | Uso intensivo del tile server público no es aceptable. | Servidor de mosaicos propio o contrato. |
| Traslape con C5/C4 / Plataforma México | Duplicar esfuerzo o generar rechazo institucional. | Posicionarlo como capa municipal complementaria, interoperable, no sustituto. |
| Resistencia institucional | «Ya tenemos sistema» / temor a cambiar procesos. | Piloto acotado, indicadores claros, no imponer. |
| Cambios de administración | Cada trienio/sexenio puede archivar el proyecto. | Convenios, documentación, código en repositorio institucional. |
| Mal uso / vigilancia | Uso del mapa para fines ajenos a la emergencia. | Roles, auditoría, propósito limitado, supervisión ciudadana. |
| Calidad del dato | GPS malo, catálogo desactualizado, falsos positivos. | Validación operativa y métricas de calidad. |
| Costo de operación | Subestimar personal, energía, enlaces, mantenimiento. | Presupuesto plurianual + fase piloto medible. |
| Capacitación | Operadores no usan la herramienta o la usan mal. | Programa de formación continuo (ver §6). |
| Responsabilidad legal | Falla del sistema asociada a un daño. | No operar sin convenio; cláusulas de responsabilidad; respaldo humano siempre. |
| Expectativas infladas | Prometer «IA que predice el crimen». | Lenguaje honesto: apoyo a la decisión, no oráculo. |

*En síntesis: el prototipo aporta valor si se implementa con honestidad, convenio, datos de calidad y ciberseguridad. Sin eso, el mapa solo genera expectativas y riesgos.*

## 4. Marco legal y normativo relevante

Esta sección resume normas verificadas a la fecha del documento (8 de octubre de 2026). No sustituye asesoría jurídica del Ayuntamiento ni del Estado. Ante cualquier duda, consultar a la Dirección Jurídica municipal y a la Consejería Jurídica estatal.

### 4.1 Nivel federal

**a) Ley General del Sistema Nacional de Seguridad Pública (LGSNSP).** Nueva ley publicada en el Diario Oficial de la Federación el 16 de julio de 2025; abroga la LGSNSP de 2009. Regula el Sistema Nacional, la distribución de competencias entre Federación, estados y municipios, el Secretariado Ejecutivo, el Sistema Nacional de Información, los Centros de Comando y Control, y los Fondos de Ayuda Federal. Artículos útiles para este proyecto: art. 10 fr. V (obligación de proporcionar bases de datos al Sistema Nacional de Información), art. 12 (competencias municipales), art. 40 (mesas de paz, incluidas regionales de municipios), art. 44 fr. III (coordinación entre municipios de diferentes estados, clave para La Laguna) y art. 47 frs. XVI, XIX y XX (el Secretariado Ejecutivo emite modelos de Centros de Comando, homologación tecnológica y normas de intercambio de información). Texto: <https://www.diputados.gob.mx/LeyesBiblio/pdf/LGSNSP.pdf>

**b) Ley del Sistema Nacional de Investigación e Inteligencia en Materia de Seguridad Pública.** También publicada en el DOF el 16 de julio de 2025. Establece la Plataforma Central de Inteligencia, administrada por el Centro Nacional de Inteligencia (CNI), a la que se interconectan instituciones de seguridad, fiscalías y Centros de Comando y Control. «Plataforma México» es el nombre con el que históricamente se conoció la red nacional de información de seguridad; antes de usar uno u otro nombre en una reunión conviene preguntar al SESNSP o al Centro de Comando estatal cuál es la denominación operativa vigente. En cualquier caso, un sistema municipal solo puede interoperar mediante los lineamientos y accesos que otorguen el Secretariado Ejecutivo / CNI; nunca «conectándose por su cuenta». Texto: <https://www.diputados.gob.mx/LeyesBiblio/pdf/LSNIIMSP.pdf>

**c) Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados (LGPDPPSO).** Nueva ley publicada el 20 de marzo de 2025 (entrada en vigor 21 de marzo de 2025). Sustituye a la ley de 2017; el INAI quedó extinto y, en el ámbito federal, sus funciones pasaron a la Secretaría Anticorrupción y Buen Gobierno (órgano «Transparencia para el Pueblo»). En los estados actúan «autoridades garantes» locales; para Durango debe confirmarse cuál es la autoridad garante vigente tras la armonización local. Aplicable a municipios y cuerpos de seguridad cuando traten datos personales (teléfonos, ubicaciones, identidades). Texto: <https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf>

**d) Ley General de Transparencia y Acceso a la Información Pública.** También expedida el 20 de marzo de 2025. Rige publicidad de información y límites (seguridad nacional / seguridad pública). Un sistema de geointeligencia genera tanto información pública (estadísticas agregadas) como reservada/confidencial.

**e) Número único 9-1-1, Catálogo Nacional de Incidentes de Emergencia (CNIE) y estandarización.** El Consejo Nacional de Seguridad Pública aprobó el CNIE como obligatorio (acuerdo 12/XXXVIII/15) y la Norma Técnica para la Estandarización de los Servicios de Atención de Llamadas de Emergencia (acuerdo 06/XXXIX/15). La versión vigente del catálogo es el CNIE 3.0 (SESNSP, junio de 2024). Además existe el PROY-NOM-227-SE-2020 (DOF 05/01/2021), que es un proyecto de norma publicado para consulta, no una NOM definitiva confirmada en esta revisión; ese proyecto pide que el CAD use la nomenclatura del CNIE. CNIE 3.0: <https://www.gob.mx/cms/uploads/attachment/file/927338/CNIE_V_3.0_Oficial_junio_24.pdf>

**f) Geolocalización de llamadas al 9-1-1 (telecomunicaciones).** Los «Lineamientos de Colaboración en Materia de Seguridad y Justicia» fueron expedidos por el IFT (2015) y modificados (DOF 7 de febrero de 2025), incorporando técnicas como AML, NILR o SIP PIDF-LO. Con la Ley en Materia de Telecomunicaciones y Radiodifusión (DOF 16/07/2025), el IFT se extinguió y sus funciones pasaron a la Comisión Reguladora de Telecomunicaciones (CRT), órgano desconcentrado de la Agencia de Transformación Digital y Telecomunicaciones (ATDT). Los actos y lineamientos del IFT siguen vigentes en lo que no se opongan a la nueva ley, hasta que la CRT emita nueva regulación. Implicación: la geolocalización de llamadas reales la entregan los concesionarios a los centros de atención 9-1-1 conforme a esos lineamientos; un prototipo municipal no puede «pedir AML» por su cuenta.

### 4.2 Nivel estatal (Durango)

**Ley del Sistema Estatal de Seguridad Pública de Durango.** Publicada en el Periódico Oficial No. 46 Bis del 7 de junio de 2026 (Decreto 398, LXX Legislatura). Abroga la Ley de Seguridad Pública para el Estado de Durango de 2014. Regula el Sistema Estatal, el Sistema Estatal de Información, el Centro de Coordinación, Control, Comando, Comunicaciones y Cómputo («Centro de Comando»), la coordinación Estado–municipios (incluidos convenios y mando único/coordinado) y los Fondos de Ayuda Federal. PDF: <https://congresodurango.gob.mx/Archivos/legislacion/LEY%20DEL%20SISTEMA%20ESTATAL%20DE%20SEGURIDAD%20P%C3%9ABLICA%20(NUEVA).pdf>

Artículos especialmente relevantes para este proyecto: Art. 36 (convenios Estado–municipio); Arts. 129–135 (Sistema Estatal de Información e interconexión); Arts. 136–141 (Centro de Comando, recepción de emergencias, videovigilancia y datos personales); Arts. 142–144 (Fondos de Ayuda Federal).

### 4.3 Nivel municipal (Gómez Palacio)

Aplican el Bando de Policía y Gobierno del Municipio de Gómez Palacio y el Reglamento Interno de la Secretaría de Protección y Vialidad (organización de la policía preventiva municipal). Cualquier uso operativo del prototipo dentro del Ayuntamiento requiere acuerdo o convenio con la persona titular de Seguridad Pública / Protección y Vialidad y, según el alcance, con la Presidencia Municipal y Cabildo. No se encontró un «Reglamento de Geointeligencia» específico; el encuadre es el de seguridad pública municipal y protección de datos.

### 4.4 Qué aplica ya vs. qué requiere convenio

| Tema | ¿Aplica al prototipo demo? | ¿Qué se necesita para datos reales? |
|---|---|---|
| Mostrar capas INEGI/OSM públicas | Sí (con atribución) | Seguir citando fuentes |
| Simular llamadas/patrullas | Sí (sin datos personales reales) | — |
| Recibir incidentes reales del 9-1-1/CAD | No | Convenio con Centro de Comando / municipio + estándares CNIE |
| GPS de patrullas reales | No | Convenio + AVL + política de uso |
| Interoperar con Sistema Nacional / estatal de información | No | Alta institucional + lineamientos SESNSP / ley estatal |
| Tratar teléfonos o identidades | No (hoy son ficticios) | Base legal + aviso de privacidad LGPDPPSO |
| Publicar estadísticas agregadas | Con cuidado | Anonimización + transparencia |

## 5. Requisitos técnicos para producción

Pasar de «demo en GitHub Pages» a «sistema que puede usarse en un C4/C5 municipal» implica una lista mínima. Nada de esto está resuelto hoy; es la agenda técnica.

### 5.1 Infraestructura

- Hosting propio: nube gubernamental, centro de datos estatal/municipal u on-premise bajo control institucional. No depender de GitHub Pages para operación real.
- Servidor de rutas propio: OSRM o pgRouting con extracto OSM de México (o La Laguna), actualizado periódicamente. El servidor público router.project-osrm.org es solo demo (política de uso: no producción, límites de tasa).
- Servidor de mosaicos de mapa propio o contratado (no abusar del tile server público de OSM).
- Base de datos espacial: PostgreSQL + PostGIS, con respaldos diarios y réplica.
- HTTPS con certificados válidos; separación de ambientes (desarrollo / pruebas / producción).
- Disponibilidad objetivo sugerido para piloto: ≥ 99 % en horario operativo; para producción 24/7: diseñar alta disponibilidad.

### 5.2 Identidad, acceso y auditoría

- Autenticación real (no contraseña compartida de demo): usuarios individuales, roles (operador, despachador, mando, administrador, auditoría).
- Segundo factor (2FA) para cuentas privilegiadas.
- Bitácoras de auditoría: quién vio qué, quién asignó qué unidad, cambios de configuración.
- Gestión de secretos (no contraseñas en código).

### 5.3 Integraciones

- CAD / 9-1-1: ingesta de incidentes con claves del CNIE; estados del folio; cierre.
- GPS/AVL en unidades: posición periódica confiable (con política de privacidad del personal).
- Radiocomunicación / estatus de unidad (disponible, en camino, en sitio, fuera de servicio).
- Interoperabilidad con Centro de Comando estatal (Durango) y, en su caso, con sistemas de Coahuila para La Laguna.
- Intercambio con Sistema Nacional de Información / lineamientos SESNSP; no «hackear» Plataforma Central de Inteligencia.
- Estadística SESNSP (incidencia delictiva municipal) como capa de contexto, citando fuente.

### 5.4 Datos y estándares

- Marco geoestadístico INEGI actualizado; claves CVEGEO.
- CNIE vigente para tipología de incidentes.
- Formatos de intercambio documentados (GeoJSON/API REST o los que indique SESNSP).
- Calendario de actualización OSM / INEGI / catálogos municipales.

### 5.5 Ciberseguridad

- Sistema de gestión de seguridad de la información alineado a ISO/IEC 27001:2022 y a las disposiciones de ciberseguridad que emitan la ATDT y el gobierno estatal (confirmar el documento vigente con el área de TI).
- Pruebas de vulnerabilidad periódicas; gestión de parches; inventario de activos.
- Cifrado en tránsito (TLS) y en reposo para datos sensibles.
- Plan de respuesta a incidentes de seguridad informática.
- Segregación: la red del sistema de despacho no debe mezclarse a la ligera con internet abierto.

## 6. Equipo humano y capacitación

La tecnología sin personas capacitadas no mejora el tiempo de respuesta. Perfiles mínimos sugeridos (pueden combinarse en municipios pequeños):

| Perfil | Rol principal | Dedicación sugerida (piloto) |
|---|---|---|
| Patrocinador institucional | Titular de Seguridad Pública / Presidencia | Decisiones y convenio |
| Coordinador del piloto | Enlace operativo diario | Medio tiempo – tiempo completo |
| Despachador(es) 9-1-1 / CAD | Uso del mapa en la asignación | Turnos existentes + 20 h capacitación |
| Analista geoespacial | Capas, calidad de dato, reportes | Medio tiempo |
| Administrador de sistemas | Servidores, respaldos, cuentas | Medio tiempo |
| Oficial de datos personales | Aviso de privacidad, ARCO | Apoyo jurídico transversal |
| Desarrollo (interno o contrato) | API, mapa, integraciones | Según fase (ver costos) |
| Capacitación policial | Uso en campo + disciplina de estatus | Jornadas iniciales + refuerzo |

### Temas mínimos de capacitación

- Uso del mapa, capas, asignación y cierre de incidentes.
- Qué es y qué no es el sistema (evitar sobreconfianza).
- Protección de datos personales y no difusión de pantallas.
- Procedimiento si el sistema falla (regreso a protocolo manual).
- Calidad del dato: reportar GPS erróneo, inconsistencias CNIE, etc.

## 7. Costos aproximados por fase y posibles fuentes de financiamiento

**Todas las cifras siguientes son rangos estimados en pesos mexicanos (MXN), a precios aproximados de 2026, para orientación de planeación. No son cotizaciones ni comprometen al proponente ni a ninguna autoridad. Los supuestos se indican en cada bloque.**

### 7.1 Rangos estimados por fase

| Fase | Alcance | Rango estimado (MXN) | Supuestos principales |
|---|---|---|---|
| 0 · Demo / presentación | Lo ya construido + materiales | 0 – 50 mil | Trabajo voluntario/cívico; hosting demo gratis (GitHub Pages); sin datos reales. |
| 1 · Piloto Gómez Palacio | Hosting propio, OSRM propio, auth, convenio, 3–6 meses | 0.8 – 2.5 millones | 1–2 servidores; 1–2 personas técnicas medio tiempo; capacitación; sin red AVL completa (subconjunto de unidades). |
| 2 · La Laguna | 3 municipios, coordinación Dgo–Coah. | 3 – 8 millones | Integraciones adicionales; gobernanza interestatal; más unidades GPS; operación 12 meses. |
| 3 · Estatal Durango | Homologación con Centro de Comando | 8 – 25 millones | Escalamiento de infraestructura, personal, alta disponibilidad, interoperabilidad plena. |
| 4 · Modelo federal replicable | Empaquetado, docs, formación, soporte a otros estados | 15 – 40 millones (programa) | No es «un solo sistema nacional sustituto»; es un kit replicable + gobernanza SESNSP. |

> **Nota:** El rango de Fase 1 puede bajar si el municipio ya tiene servidores, enlaces y personal TI; puede subir si se exige alta disponibilidad desde el día uno o si se compra AVL para todo el parque vehicular. Hardware AVL por unidad típico de mercado (referencia amplia): del orden de miles a decenas de miles de pesos por unidad instalada, según proveedor — verificar cotizaciones locales; no se afirma un precio único.

### 7.2 Costos recurrentes anuales (orden de magnitud, piloto municipal)

- Hosting / energía / enlaces: ~80 mil – 400 mil MXN/año.
- Mantenimiento de software (contratos o personal): ~300 mil – 1.2 millones MXN/año.
- Actualización de mapas OSM / extractos OSRM: incluido en personal TI o ~50–150 mil.
- Capacitación continua: ~50–200 mil.
- Auditoría / pruebas de seguridad: ~80–300 mil (según alcance).

### 7.3 Fuentes de financiamiento (verificar vigencia al momento de solicitar)

**FASP (Fondo de Aportaciones para la Seguridad Pública de los Estados y del Distrito Federal).** Fondo de aportaciones del Ramo 33, vigente. Se coordina vía SESNSP / convenios con entidades federativas. En Durango, el presupuesto estatal 2026 contempla recursos FASP (orden de ~261 millones MXN a nivel estado según anexos de la Ley de Egresos 2026 de Durango — cifra estatal, no municipal). Uso sujeto a lineamientos del Consejo Nacional / SESNSP.

**FORTAMUN (Fondo de Aportaciones para el Fortalecimiento de los Municipios…).** También Ramo 33, vigente. El PEF 2026 (art. 6, fracción IX) establece que se promoverá que al menos el 20 % del FORTAMUN se destine a necesidades vinculadas con la seguridad pública. Para Gómez Palacio, el Anexo XV de la Ley de Egresos de Durango 2026 estima un FORTAMUN de \$403,701,794 MXN (estimación, no monto ejercido); el 20 % equivaldría a unos \$80.7 millones, que ya tienen compromisos (nómina policial, equipamiento, etc.). Un piloto tendría que competir por una fracción de ese recurso dentro de las reglas.

**FORTASEG.** Subsidio federal a municipios para seguridad. Fue eliminado del Presupuesto de Egresos de la Federación 2021; no debe presentarse como fuente disponible. Confirmar en PEF vigente que no ha sido recreado bajo otro nombre antes de mencionarlo en una solicitud.

**Presupuesto municipal / estatal ordinario.** Partidas de Seguridad Pública, Tecnologías de la Información o modernización administrativa.

**Convenios de colaboración / aportaciones concurrentes.** Estado + municipio; o coordinación La Laguna (Durango–Coahuila) con reglas claras de quién paga qué.

Referencias SESNSP sobre FORTAMUN: <https://www.gob.mx/sesnsp/acciones-y-programas/fondo-de-aportaciones-para-el-fortalecimiento-de-los-municipios-y-de-las-demarcaciones-territoriales-del-distrito-federal-fortamun>

## 8. Hoja de ruta por fases

### Fase 0 · Demo y presentación (ahora)

| Elemento | Detalle |
|---|---|
| Objetivo | Que Seguridad Pública de Gómez Palacio conozca el prototipo con honestidad y decida si vale un piloto. |
| Entregables | Demo en línea; este plan; guion de 15–20 min; FAQ; capturas; repositorio. |
| Quién aprueba | Titular de Seguridad Pública municipal; en su caso Presidencia Municipal. |
| Indicadores | Reunión realizada; lista de dudas documentada; decisión go / no-go a Fase 1. |
| Duración | 2–6 semanas desde el primer contacto formal. |

### Fase 1 · Piloto municipal Gómez Palacio

| Elemento | Detalle |
|---|---|
| Objetivo | Operar con un subconjunto de datos reales bajo convenio, midiendo tiempo de asignación y calidad. |
| Entregables | Convenio; hosting propio; OSRM propio; autenticación/roles; integración básica CAD o carga asistida; capacitación; informe de resultados. |
| Quién firma / aprueba | Presidencia Municipal + Seguridad Pública; Jurídico; TI; en su caso Cabildo. Enlace con Centro de Comando estatal si hay intercambio de incidentes. |
| Indicadores | Tiempo medio de asignación; % incidentes con georreferencia válida; disponibilidad del sistema; satisfacción de despachadores; incidentes de seguridad informática = 0 graves. |
| Duración estimada | 4–8 meses (incluido convenio y puesta en marcha). |

### Fase 2 · Zona metropolitana La Laguna

Municipios: Gómez Palacio y Lerdo (Durango) y Torreón (Coahuila). Implica coordinación interestatal: no basta un acuerdo municipal.

| Elemento | Detalle |
|---|---|
| Objetivo | Despacho y capa geo compartida en la zona conurbada, respetando competencias de cada estado. |
| Entregables | Convenio Durango–Coahuila–municipios; homologación CNIE; mapa metropolitano; protocolos de paso de frontera municipal/estatal. |
| Quién firma | Ejecutivos estatales (seguridad) de Durango y Coahuila; municipios; instancia de coordinación entre municipios de diferentes entidades (LGSNSP art. 44, fr. III) y, en su caso, mesa de paz regional (art. 40). |
| Indicadores | Tiempo de respuesta intermunicipal; % de incidentes «huérfanos» en límites; acuerdos operativos firmados. |
| Duración estimada | 8–14 meses después de un piloto municipal estable. |

### Fase 3 · Estatal Durango

| Elemento | Detalle |
|---|---|
| Objetivo | Homologar con el Centro de Comando y el Sistema Estatal de Información (ley 2026). |
| Entregables | Interoperabilidad certificada según lineamientos estatales/SESNSP; despliegue en más municipios; operación continua. |
| Quién firma | Secretaría de Seguridad Pública del Estado; Secretariado Ejecutivo estatal; municipios adheridos. |
| Indicadores | Cobertura municipal; cumplimiento de intercambio diario de bases (art. 139 ley estatal); auditoría de datos personales. |
| Duración estimada | 12–24 meses. |

### Fase 4 · Modelo replicable federal

| Elemento | Detalle |
|---|---|
| Objetivo | Empaquetar un «kit» documentado (software, guías, convenio tipo, capacitación) que otros estados/municipios puedan adoptar, alineado a SESNSP — sin pretender sustituir la Plataforma Central de Inteligencia. |
| Entregables | Distribución versionada; guía de adopción; programa de formación; mesa técnica con SESNSP. |
| Quién aprueba | SESNSP (emite modelos de Centros de Comando y Control, LGSNSP art. 47 fr. XVI) / Conferencia Nacional de Secretarías de Seguridad Pública (homologación e interoperabilidad de Centros de Comando, art. 26 fr. XVIII); estados piloto. |
| Indicadores | Número de entidades que adoptan; tiempo medio de despliegue; evaluaciones independientes. |
| Duración estimada | 18–36 meses (programa). |

## 9. Lista de verificación «para no fallar» antes de cada reunión

### 9.1 Documentos y materiales

- Enlace de la demo y contraseña (enviar por canales separados si es posible).
- Este plan en PDF (versión del día).
- Una hoja de una página: «Qué es / Qué no es».
- Capturas de pantalla recientes (mapa, asignación por calles, mapa de calor).
- Lista de fuentes INEGI/OSM (FUENTES.md del proyecto).
- Borrador de convenio de piloto (aunque sea esquemático) para mostrar seriedad.
- Identificación del proponente y datos de contacto.

### 9.2 Chequeos técnicos de la demo (30–60 min antes)

- Abrir el sitio en la misma red/proyector que se usará.
- Probar login correcto e incorrecto.
- Verificar que cargan las 494 localidades y los perímetros Lavín/Sacramento.
- Simular una llamada y confirmar asignación por calles (o el mensaje de respaldo en línea recta).
- Probar en teléfono (por si piden verlo en móvil).
- Tener plan B: capturas y video corto si no hay internet.

### 9.3 Preguntas que casi seguro harán (y postura sugerida)

| Pregunta probable | Respuesta corta sugerida |
|---|---|
| ¿Está conectado al 9-1-1? | No. Es simulación. Para datos reales hace falta convenio. |
| ¿Cuánto cuesta? | La demo, casi nada. Un piloto municipal serio: orden de 0.8–2.5 M MXN según supuestos (ver plan). |
| ¿Para qué sirve si ya hay C5? | Como capa municipal complementaria y auditable, no como sustituto. |
| ¿Quién mantiene el código? | Hoy el proponente; en piloto debe quedar en el municipio/estado con soporte definido. |
| ¿Y los datos personales? | Hoy no hay datos personales reales. En piloto se aplica LGPDPPSO. |
| ¿Es inteligencia artificial que predice delitos? | No. Es mapa + rutas + (futuro) estadísticas. El «riesgo horario» de v3 sería estimado, no oficial. |
| ¿Podemos usarlo mañana en el turno? | No de forma responsable. Primero convenio, hosting propio y capacitación. |

### 9.4 Actitud en la reunión

- Hablar con claridad y sin tecnicismos innecesarios; usar el glosario.
- Nunca afirmar capacidades que la demo no tiene.
- Anotar por escrito cada compromiso («quién» y «para cuándo»).
- Si no sabe una respuesta legal/técnica: decirlo y ofrecer respuesta en X días.

## 10. Preguntas difíciles y cómo responder con honestidad

#### P1. ¿Usted qué gana con esto?

**R.** Soy un ciudadano de Gómez Palacio que quiere aportar una herramienta útil. Si el municipio la adopta, el código debe quedar bajo gobernanza institucional. No estoy vendiendo humo ni pidiendo un contrato opaco; estoy pidiendo que se evalúe con reglas claras.

#### P2. ¿Y si el sistema falla y alguien resulta dañado?

**R.** Por eso no debe operarse sin convenio, sin protocolo de contingencia y sin que el despacho humano siga siendo responsable. El software apoya; no reemplaza el criterio del personal ni la cadena de mando.

#### P3. ¿Esto no es vigilancia masiva?

**R.** El riesgo existe si se usa mal. Por eso hace falta propósito limitado (emergencias y seguridad pública), roles, auditoría, protección de datos y supervisión. Un mapa de patrullas no debe convertirse en herramienta de abuso.

#### P4. ¿Por qué no comprar un sistema comercial famoso?

**R.** Puede ser una opción válida. Este prototipo muestra que una ruta con software libre es posible y auditable. La decisión es de la autoridad tras comparar costo total, soberanía del dato, soporte y cumplimiento normativo.

#### P5. ¿Ya habló con el C5 estatal?

**R.** El primer paso natural es el municipio. Si hay interés, el siguiente es alinear con el Centro de Comando del Estado (ley 2026) para no duplicar ni pelear sistemas.

#### P6. ¿Tiene usted certificación, ISO, dictamen del SESNSP?

**R.** No. Es un prototipo cívico. Las certificaciones corresponden a la fase institucional, no a la demo.

#### P7. ¿De dónde salieron las coordenadas de los ejidos?

**R.** Del Catálogo Único de INEGI, verificadas con OpenStreetMap. Está documentado en FUENTES.md del repositorio. No se inventaron.

#### P8. ¿Por qué el servidor OSRM público?

**R.** Porque es una demo. En producción se necesita OSRM o pgRouting propio; el servidor público no está hecho para operación institucional.

#### P9. ¿Y La Laguna? Torreón es Coahuila.

**R.** Exacto: cualquier fase metropolitana exige convenio interestatal Durango–Coahuila, no solo buena voluntad municipal.

#### P10. ¿Cuánto tarda en verse un beneficio real?

**R.** En un piloto bien hecho, indicadores de proceso (tiempo de asignación, georreferencia) pueden verse en meses. Impacto en incidencia delictiva es más lento y multifactorial; no debe prometerse como efecto mágico del software.

## 11. Próximos pasos inmediatos

**Para Raúl Muñoz Villa (orden sugerido):**

1. Enviar el enlace de la demo y la contraseña al titular de Seguridad Pública de Gómez Palacio (mensajes separados).
2. Adjuntar o entregar este plan en PDF y la hoja de una página «Qué es / Qué no es».
3. Agendar una demostración presencial o por videollamada de 20 minutos + 20 de preguntas.
4. Preparar borrador de convenio de piloto (objeto, datos, roles, duración, salida).
5. Identificar en el Ayuntamiento al enlace de TI y al área jurídica.
6. No publicar datos reales ni conectar nada a C4/C5 sin documento firmado.
7. Si hay interés: solicitar oficio de intención y pasar a presupuestos de Fase 1 (hosting + OSRM propio).
8. Mantener el repositorio y la documentación al día; registrar cada reunión en una bitácora breve.
9. Para La Laguna: solo después de un piloto municipal estable, abrir conversación interestatal Durango–Coahuila.
10. Revisar cada seis meses el marco legal (leyes nuevas 2025–2026 pueden generar reglamentos).

*Criterio de éxito del primer mes: una reunión formal realizada, dudas por escrito, y una decisión explícita de continuar o no a un piloto con convenio.*

## 12. Fuentes consultadas

*Consulta realizada para este documento con fecha de corte 8 de octubre de 2026. Se indica enlace para verificación. No se inventaron cifras de leyes ni de programas.*

| Documento / recurso | Emisor / fecha | Enlace |
|---|---|---|
| LGSNSP (nueva ley) | DOF 16/07/2025 | <https://www.diputados.gob.mx/LeyesBiblio/pdf/LGSNSP.pdf> |
| LGSNSP (página de referencias) | Cámara de Diputados | <https://www.diputados.gob.mx/LeyesBiblio/ref/lgsnsp.htm> |
| Ley Sistema Nacional de Investigación e Inteligencia | DOF 16/07/2025 | <https://www.diputados.gob.mx/LeyesBiblio/pdf/LSNIIMSP.pdf> |
| LGPDPPSO | DOF 20/03/2025 | <https://www.diputados.gob.mx/LeyesBiblio/pdf/LGPDPPSO.pdf> |
| Decreto transparencia y datos (contexto) | DOF 20/03/2025 | <https://sidof.segob.gob.mx/notas/getNewsletter/20-03-2025/Vespertina/320122> |
| Ley en Materia de Telecomunicaciones y Radiodifusión | DOF 16/07/2025 | <https://sidof.segob.gob.mx/notas/docFuente/5763167> |
| Modificación Lineamientos colaboración seguridad y justicia (IFT) | DOF 07/02/2025 | <https://www.ift.org.mx/sites/default/files/conocenos/pleno/sesiones_pleno/acuerdo_liga/p_ift_181224_807_dof_acc.pdf> |
| CNIE v3.0 | SESNSP, junio 2024 | <https://www.gob.mx/cms/uploads/attachment/file/927338/CNIE_V_3.0_Oficial_junio_24.pdf> |
| PROY-NOM-227-SE-2020 (estandarización 9-1-1) | DOF 05/01/2021 | <https://diariooficial.gob.mx/nota_detalle.php?codigo=5609451&fecha=05/01/2021> |
| Ley del Sistema Estatal de Seguridad Pública de Durango | P.O. 07/06/2026 | <https://congresodurango.gob.mx/Archivos/legislacion/LEY%20DEL%20SISTEMA%20ESTATAL%20DE%20SEGURIDAD%20P%C3%9ABLICA%20(NUEVA).pdf> |
| FORTAMUN (SESNSP) | gob.mx | <https://www.gob.mx/sesnsp/acciones-y-programas/fondo-de-aportaciones-para-el-fortalecimiento-de-los-municipios-y-de-las-demarcaciones-territoriales-del-distrito-federal-fortamun> |
| Anexos Ley de Egresos Durango 2026 (FASP/FORTAMUN estatales) | Congreso Durango | <https://congresodurango.gob.mx/Archivos/LXX/LEYES-INGRESOS/2026/Anexos%20a%20la%20Ley%20de%20Egresos%20del%20Estado%20de%20Durango%20para%20el%20Ejercicio%20Fiscal%202026.pdf> |
| PEF 2021 (contexto desaparición FORTASEG) | DOF 30/11/2020 | <https://www.diputados.gob.mx/LeyesBiblio/abro/pef_2021/PEF_2021_orig_30nov20.pdf> |
| PEF 2026 (art. 6 fr. IX, FORTAMUN 20 % seguridad) | DOF / Cámara de Diputados | <http://www.diputados.gob.mx/LeyesBiblio/pdf/PEF_2026.pdf> |
| Incidencia delictiva municipal (datos abiertos SESNSP) | datos.gob.mx | <https://historico.datos.gob.mx/busca/dataset/secretariado-ejecutivo-del-sistema-nacional-de-seguridad-publica/resource/b62f9143-45ae-496f-945e-608b5accc368> |
| Nueva metodología de incidencia delictiva | SNIEG / SESNSP | <https://www.snieg.mx/Documentos/Gobierno/sesiones/doc_12025/1_nueva_metod_rec_inc_delic.pdf> |
| Inicio de funciones de la CRT (extinción del IFT) | La Jornada, 19/10/2025 | <https://www.jornada.com.mx/noticia/2025/10/19/economia/inicia-funciones-la-crt-nuevo-regulador-en-telecomunicaciones> |
| Extinción del INAI: acuerdo de la SABG | DOF | <https://sidof.segob.gob.mx/notas/docFuente/5753636> |
| ISO/IEC 27001:2022 | ISO | <https://www.iso.org/standard/27001> |
| Política de uso del servidor demo de OSRM | Project OSRM (wiki) | <https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy> |
| FORTASEG eliminado en 2021 (verificación periodística) | Grupo Animal | <https://grupoanimal.mx/verificacion-politica/fortaseg-desaparecio-falso-dicho-amlo> |
| INEGI Catálogo Único de Claves Geoestadísticas | INEGI | <https://www.inegi.org.mx/servicios/catalogoUnico.html> |
| Demo Durango GeoInteligencia | GitHub Pages | <https://d-lang-gif.github.io/durango-geointeligencia/> |
| Código fuente | GitHub | <https://github.com/D-lang-gif/durango-geointeligencia> |
| OSRM (proyecto) / uso del demo server | Project OSRM | <https://github.com/Project-OSRM/osrm-backend> |
| OpenStreetMap — relación límite Gómez Palacio | OSM 5605840 | <https://www.openstreetmap.org/relation/5605840> |
| Bando de Policía y Gobierno / Reglamento Protección y Vialidad Gómez Palacio | Orden jurídico / vLex | <http://www.ordenjuridico.gob.mx/Documentos/Estatal/Durango/Todos%20los%20Municipios/wo81556.pdf> |

> **Nota:** Algunos portales gubernamentales (DOF, gob.mx) pueden exigir captcha o cambiar de URL; si un enlace falla, buscar por el nombre exacto de la norma y la fecha de publicación.

## Anexo A. Glosario (términos en lenguaje sencillo)

| Término | Significado sencillo |
|---|---|
| 9-1-1 | Número único nacional para pedir ayuda en emergencias. |
| AVL / GPS de patrulla | Dispositivo que reporta dónde está la unidad en el mapa. |
| CAD | Sistema de cómputo con el que el centro de emergencias registra y despacha incidentes. |
| C4 / C5 / Centro de Comando | Centro donde se ven cámaras, llamadas y se coordina la respuesta. En Durango la ley 2026 habla de «Centro de Comando». |
| CNIE | Catálogo Nacional de Incidentes de Emergencia: lista oficial de tipos de emergencia. |
| Convenio | Acuerdo firmado entre instituciones que permite compartir datos o trabajar juntas. |
| Ejido (en este mapa) | Punto de localidad INEGI usado como referencia; no es el polígono de tierras ejidales. |
| FASP / FORTAMUN | Fondos federales (Ramo 33) que pueden financiar seguridad; tienen reglas de uso. |
| FORTASEG | Antiguo subsidio a municipios; ya no existe desde el PEF 2021. |
| Geointeligencia | Usar mapas y datos de ubicación para apoyar decisiones de seguridad. |
| GitHub Pages | Servicio gratuito para publicar un sitio web estático; útil para demos, no para operación policial. |
| INEGI | Instituto que produce la cartografía y estadísticas oficiales de México. |
| Leaflet | Biblioteca libre para mostrar mapas en una página web. |
| LGPDPPSO | Ley que obliga a cuidar los datos personales cuando los tiene el gobierno. |
| OpenStreetMap (OSM) | Mapa libre hecho por colaboradores; hay que dar crédito al usarlo. |
| OSRM | Motor libre que calcula rutas por calles (tiempos y caminos). |
| Piloto | Prueba controlada, con pocos usuarios y reglas claras, antes de ampliar. |
| Plataforma México / Plataforma Central de Inteligencia | Infraestructura nacional de interconexión de información de seguridad; no se sustituye con un mapa municipal. |
| PostGIS | Extensión de base de datos que entiende geometrías (puntos, polígonos, distancias). |
| SESNSP | Secretariado Ejecutivo del Sistema Nacional de Seguridad Pública. |
| SLA / disponibilidad | Compromiso de qué tanto tiempo el sistema debe estar funcionando. |
| 2FA | Segundo factor de autenticación: además de contraseña, un código o dispositivo. |

---

*— Fin del documento —*  
*Raúl Muñoz Villa · Gómez Palacio, Durango · 8 de octubre de 2026*  
*Iniciativa cívica · Sin respaldo oficial*
