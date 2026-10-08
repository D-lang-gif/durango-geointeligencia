/* Durango GeoInteligencia — sitio estático (Leaflet + OpenStreetMap + OSRM).
   PROTOTIPO: patrullas, incidentes y teléfonos son DATOS SIMULADOS; la simulación corre en el navegador.
   Localidades: INEGI. Ejidos verificados: INEGI/OSM. Rutas por calles: OSRM (servidor público de demostración). */
(function () {
  "use strict";
  const TZ = "America/Mexico_City";
  const OSRM = "https://router.project-osrm.org";
  const INTERVALO_MS = 3000;          // un ciclo cada 3 s (igual que el servidor)
  const FACTOR = 15;                  // simulación acelerada ×15
  const VEL_RECTA = 40 / 3.6;         // 40 km/h para la ruta en línea recta (respaldo)
  const T_SITIO_MS = 60000;           // 60 s reales en sitio y se cierra el incidente
  const RADIO_BASE_M = 1200;          // patrullaje alrededor de la base
  const TIMEOUT_OSRM_MS = 6000;
  const N_CANDIDATAS = 3;             // patrullas más cercanas en línea recta que se comparan por tiempo de manejo
  const CLAVE_ESTADO = "dgi_simulacion_v2";

  const ESTATUS_UNIDAD = { disponible: "Disponible", asignada: "En camino", en_sitio: "En sitio" };
  const ESTATUS_INC = { pendiente: "Pendiente", asignado: "Unidad en camino", en_sitio: "Unidad en sitio", cerrado: "Cerrado" };
  const PRIORIDAD = { alta: "Alta", media: "Media", baja: "Baja" };
  const TIPOS = [
    ["Robo a casa habitación", "alta"], ["Accidente vial", "alta"], ["Violencia familiar", "alta"],
    ["Riña en vía pública", "media"], ["Robo de vehículo", "media"], ["Disparos de arma de fuego (reporte)", "alta"],
    ["Persona sospechosa", "baja"], ["Ruido / alteración del orden", "baja"], ["Robo de ganado o equipo agrícola", "media"],
  ];
  // Datos de ejemplo (los mismos del servidor, db/04_seed.sql). Teléfonos ficticios con formato "SIM".
  const SEMILLA_UNIDADES = [
    ["P-101", 25.5692, -103.4990, "Centro"], ["P-102", 25.5640, -103.4780, "Oriente"], ["P-103", 25.5480, -103.4900, "Sur"],
    ["P-104", 25.5900, -103.4800, "Nororiente"], ["P-105", 25.5850, -103.5070, "Norponiente"],
  ];
  const SEMILLA_INCIDENTES = [
    ["GP-DEMO-0001", "Robo a casa habitación", "alta", 25.7801, -103.3545, "Venecia", "871-SIM-0101", true, 25, null],
    ["GP-DEMO-0002", "Accidente vial", "alta", 25.7568, -103.5680, "Brittingham", "871-SIM-0102", true, 18, null],
    ["GP-DEMO-0003", "Riña en vía pública", "media", 25.6795, -103.4680, "La Popular", "871-SIM-0103", false, 12, "P-104"],
    ["GP-DEMO-0004", "Violencia familiar", "alta", 25.7215, -103.6590, "Dinamita", "871-SIM-0104", true, 7, null],
    ["GP-DEMO-0005", "Persona sospechosa", "baja", 25.6838, -103.4250, "Tajo Viejo", "871-SIM-0105", false, 3, "P-102"],
  ];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hora = (ms) => (ms ? new Date(ms).toLocaleTimeString("es-MX", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—");
  const km = (m) => (m == null ? "—" : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
  const minutos = (s) => (s == null ? "—" : `${Math.max(1, Math.round(s / 60))} min`);
  const num = (n) => Number(n).toLocaleString("es-MX");
  const esMovil = () => window.matchMedia("(max-width: 760px)").matches;

  function dist(a, b) { // haversine, a y b = [lat, lon]
    const R = 6371008.8, r = Math.PI / 180;
    const dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function desplazar(lat, lon, metros, rumbo) {
    const R = 6371008.8, d = metros / R, b = (rumbo * Math.PI) / 180;
    const f1 = (lat * Math.PI) / 180, l1 = (lon * Math.PI) / 180;
    const f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(f1), Math.cos(d) - Math.sin(f1) * Math.sin(f2));
    return [(f2 * 180) / Math.PI, (l2 * 180) / Math.PI];
  }
  const pos = (o) => [o.lat, o.lon];

  // ---------- Rutas (OSRM con respaldo en línea recta) ----------
  function prepararRuta(coords, distancia, duracion, fuente, error) {
    coords = coords.map(([a, b]) => [+a.toFixed(6), +b.toFixed(6)]);
    const acum = [0];
    for (let i = 1; i < coords.length; i++) acum.push(acum[i - 1] + dist(coords[i - 1], coords[i]));
    return { coords, acum, largo: acum[acum.length - 1], distancia, duracion: Math.max(duracion, 1), fuente, error: error || null, t: 0 };
  }
  function rutaRecta(a, b, error) { const d = dist(a, b); return prepararRuta([a, b], d, d / VEL_RECTA, "recta", error); }
  function puntoEnRuta(r) { // posición e índice del tramo según el tiempo simulado recorrido
    const s = Math.min(1, r.t / r.duracion) * r.largo;
    let i = 0;
    while (i < r.acum.length - 2 && r.acum[i + 1] < s) i++;
    const seg = r.acum[i + 1] - r.acum[i] || 1, f = Math.min(1, Math.max(0, (s - r.acum[i]) / seg));
    const a = r.coords[i], b = r.coords[i + 1] || a;
    return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], i };
  }
  async function pedirJSON(url) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), TIMEOUT_OSRM_MS);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error(`OSRM HTTP ${r.status}`);
      const j = await r.json();
      if (j.code !== "Ok") throw new Error(`OSRM: ${j.code}`);
      return j;
    } catch (e) { throw new Error(e.name === "AbortError" ? "OSRM no respondió en 6 s" : e.message); }
    finally { clearTimeout(t); }
  }
  const ll = (p) => `${p[1].toFixed(6)},${p[0].toFixed(6)}`;
  async function rutaOSRM(a, b) {
    try {
      const j = await pedirJSON(`${OSRM}/route/v1/driving/${ll(a)};${ll(b)}?overview=full&geometries=geojson`);
      const r = j.routes[0];
      return prepararRuta([a, ...r.geometry.coordinates.map(([x, y]) => [y, x]), b], r.distance, r.duration, "osrm");
    } catch (e) { return rutaRecta(a, b, e.message); }
  }

  // ---------- Estado de la simulación ----------
  let D = null;            // datos descifrados (localidades, ejidos, perímetros, límite)
  let E = null;            // estado: unidades, incidentes, cerrados, seq
  let mapa, capas = {}, marcadoresUnidad = new Map(), marcadoresIncidente = new Map(), primeraVez = true;

  function estadoInicial() {
    const ahora = Date.now();
    const unidades = SEMILLA_UNIDADES.map(([codigo, lat, lon, zona]) => ({ codigo, tipo: "patrulla", zona, lat, lon, base: [lat, lon], estatus: "disponible", incidente: null, ruta: null, act: ahora }));
    const incidentes = SEMILLA_INCIDENTES.map(([folio, tipo, prioridad, lat, lon, ref, tel, aml, hace, pat]) => ({
      folio, tipo, prioridad, lat, lon, referencia: ref, direccion: `Ejido ${ref} (ejemplo)`, telefono: tel, aml,
      tiempo_llamada: ahora - hace * 60000, estatus: "pendiente", patrulla: null, _semilla: pat }));
    return { v: 2, unidades, incidentes, cerrados: 0, seq: 0, creado: ahora };
  }
  function guardar() {
    try { localStorage.setItem(CLAVE_ESTADO, JSON.stringify(E, (k, v) => (k === "_reservada" || k === "_pidiendo" || k === "_asignando" ? undefined : v))); } catch (e) { /* sin espacio */ }
  }
  function cargarEstado() {
    try { const s = JSON.parse(localStorage.getItem(CLAVE_ESTADO)); if (s && s.v === 2 && Array.isArray(s.unidades)) return s; } catch (e) { /* nada */ }
    return null;
  }
  const unidad = (c) => E.unidades.find((u) => u.codigo === c);
  const incidente = (f) => E.incidentes.find((i) => i.folio === f);

  async function despacharSemilla() { // incidentes de ejemplo ya despachados al iniciar (como en el servidor)
    await Promise.all(E.incidentes.filter((i) => i._semilla).map(async (i) => {
      const u = unidad(i._semilla); delete i._semilla;
      if (!u || u.estatus !== "disponible") return;
      u._reservada = true;
      const r = await rutaOSRM(pos(u), pos(i));
      ocupar(u, i, r, null);
    }));
    guardar(); pintar();
  }

  function ocupar(u, i, r, candidatas) {
    r.destino = "incidente";
    Object.assign(u, { estatus: "asignada", incidente: i.folio, ruta: r, act: Date.now() });
    delete u._reservada;
    Object.assign(i, { estatus: "asignado", patrulla: u.codigo, distancia_m: r.distancia, eta_s: r.duracion, fuente_ruta: r.fuente,
                       error_ruta: r.error, candidatas, tiempo_asignacion: Date.now() });
  }

  // Patrulla más cercana POR TIEMPO DE MANEJO entre las N más cercanas en línea recta
  async function asignar(i) {
    if (i.estatus !== "pendiente" || i._asignando) return null;
    i._asignando = true; pintar();
    try {
      const libres = () => E.unidades.filter((u) => u.estatus === "disponible" && !u._reservada);
      let disp = libres();
      if (!disp.length) {
        return { ok: false, mensaje: "Sin unidades disponibles en este momento: el incidente queda PENDIENTE de asignación." };
      }
      const cand = disp.map((u) => ({ u, recta: dist(pos(u), pos(i)) })).sort((a, b) => a.recta - b.recta).slice(0, N_CANDIDATAS);
      let candidatas = null, elegida = cand[0];
      try {
        const coords = [...cand.map((c) => ll(pos(c.u))), ll(pos(i))].join(";");
        const j = await pedirJSON(`${OSRM}/table/v1/driving/${coords}?sources=${cand.map((_, k) => k).join(";")}&destinations=${cand.length}&annotations=duration,distance`);
        candidatas = cand.map((c, k) => ({ codigo: c.u.codigo, recta: c.recta, dur: j.durations[k][0], dist: j.distances ? j.distances[k][0] : null }));
        const validas = candidatas.filter((c) => c.dur != null);
        if (validas.length) { const mejor = validas.reduce((a, b) => (b.dur < a.dur ? b : a)); elegida = cand.find((c) => c.u.codigo === mejor.codigo); }
      } catch (e) { candidatas = null; }
      let u = elegida.u;
      if (u.estatus !== "disponible" || u._reservada) { // la tomó otra llamada mientras se consultaba OSRM
        disp = libres(); if (!disp.length) return { ok: false, mensaje: "Sin unidades disponibles: el incidente queda PENDIENTE." };
        u = disp.sort((a, b) => dist(pos(a), pos(i)) - dist(pos(b), pos(i)))[0];
      }
      u._reservada = true;
      const r = await rutaOSRM(pos(u), pos(i));
      ocupar(u, i, r, candidatas);
      return { ok: true, u, r, candidatas, mensaje: candidatas ? `Unidad ${u.codigo} asignada (la de menor tiempo de manejo entre las ${cand.length} más cercanas en línea recta).` : `Unidad ${u.codigo} asignada (la más cercana en línea recta: OSRM no respondió para comparar tiempos de manejo).` };
    } finally {
      delete i._asignando; guardar(); pintar();
    }
  }

  function ciclo() {
    const ahora = Date.now(), avance = (INTERVALO_MS / 1000) * FACTOR;
    for (const u of E.unidades) {
      if (u._reservada) continue;
      if (u.ruta) {
        u.ruta.t += avance;
        const { p } = puntoEnRuta(u.ruta);
        [u.lat, u.lon] = p; u.act = ahora;
        if (u.ruta.t >= u.ruta.duracion) {
          const fin = u.ruta.coords[u.ruta.coords.length - 1]; [u.lat, u.lon] = fin;
          if (u.ruta.destino === "incidente") {
            const i = incidente(u.incidente);
            if (i && i.estatus === "asignado") { u.estatus = "en_sitio"; i.estatus = "en_sitio"; i.tiempo_llegada = ahora; }
            else { u.estatus = "disponible"; u.incidente = null; }
          }
          u.ruta = null;
        }
      } else if (u.estatus === "disponible" && !u._pidiendo) {
        const d = dist(pos(u), u.base);
        if (d > RADIO_BASE_M) { // regresa a su base por calles
          u._pidiendo = true;
          rutaOSRM(pos(u), u.base).then((r) => { if (u.estatus === "disponible" && !u.ruta && !u._reservada) { r.destino = "base"; u.ruta = r; } delete u._pidiendo; });
        } else { [u.lat, u.lon] = desplazar(u.lat, u.lon, 40 + Math.random() * 80, Math.random() * 360); u.act = ahora; }
      }
      if ((u.estatus === "asignada" || u.estatus === "en_sitio") && !E.incidentes.some((i) => i.patrulla === u.codigo && (i.estatus === "asignado" || i.estatus === "en_sitio"))) {
        u.estatus = "disponible"; u.incidente = null; if (u.ruta && u.ruta.destino === "incidente") u.ruta = null;
      }
    }
    // Tras 60 s en sitio se cierra el incidente y la patrulla queda libre
    for (const i of E.incidentes) {
      if (i.estatus === "en_sitio" && ahora - i.tiempo_llegada >= T_SITIO_MS) {
        i.estatus = "cerrado"; E.cerrados++;
        const u = unidad(i.patrulla); if (u && u.incidente === i.folio) { u.estatus = "disponible"; u.incidente = null; }
      }
    }
    E.incidentes = E.incidentes.filter((i) => i.estatus !== "cerrado");
    guardar(); pintar();
  }

  // ---------- Mapa ----------
  const iconoUnidad = (u) => L.divIcon({ className: "mk", iconSize: [40, 46], iconAnchor: [20, 18], popupAnchor: [0, -16],
    html: `<div class="mk-unidad ${esc(u.estatus)}"><div class="em">🚔</div><div class="cod">${esc(u.codigo)}</div></div>` });
  const iconoIncidente = (i) => L.divIcon({ className: "mk", iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -14],
    html: `<div class="mk-inc ${esc(i.prioridad)}"><span class="anillo"></span><span class="em">🚨</span></div>` });
  const iconoEjido = () => L.divIcon({ className: "mk mk-ejido", iconSize: [22, 22], iconAnchor: [11, 11], html: "🌾" });
  const txtRuta = (fuente) => (fuente === "osrm" ? "por calles (OSRM)" : "línea recta (OSRM no disponible)");

  const popupUnidad = (u) => `<div class="popup"><h4>🚔 ${esc(u.codigo)}</h4><table>
      <tr><td>Estatus</td><td><b>${esc(ESTATUS_UNIDAD[u.estatus] || u.estatus)}</b></td></tr>
      <tr><td>Base</td><td>${esc(u.zona)}</td></tr>
      <tr><td>Incidente</td><td>${esc(u.incidente || "—")}</td></tr>
      ${u.ruta ? `<tr><td>Ruta</td><td>${u.ruta.destino === "base" ? "Regreso a base" : "Hacia incidente"}, ${txtRuta(u.ruta.fuente)}</td></tr>` : ""}
      <tr><td>Posición</td><td>${u.lat.toFixed(5)}, ${u.lon.toFixed(5)}</td></tr>
      <tr><td>Actualizado</td><td>${hora(u.act)} (centro)</td></tr></table>
      <div class="sim">Unidad y GPS simulados (datos de ejemplo).</div></div>`;
  const popupIncidente = (i) => `<div class="popup"><h4>🚨 ${esc(i.folio)}</h4><table>
      <tr><td>Tipo</td><td><b>${esc(i.tipo)}</b></td></tr>
      <tr><td>Prioridad</td><td>${esc(PRIORIDAD[i.prioridad])}</td></tr>
      <tr><td>Estatus</td><td>${esc(ESTATUS_INC[i.estatus] || i.estatus)}</td></tr>
      <tr><td>Referencia</td><td>${esc(i.direccion || i.referencia || "—")}</td></tr>
      ${i.localidad ? `<tr><td>Localidad INEGI</td><td>${esc(i.localidad)}</td></tr>` : ""}
      <tr><td>Teléfono</td><td>${esc(i.telefono)} (ficticio)</td></tr>
      <tr><td>Ubicación AML</td><td>${i.aml ? "Sí" : "No"} (simulado)</td></tr>
      <tr><td>Patrulla</td><td>${esc(i.patrulla || "Sin asignar")}</td></tr>
      ${i.patrulla ? `<tr><td>Ruta</td><td>${km(i.distancia_m)} · ${minutos(i.eta_s)} · ${txtRuta(i.fuente_ruta)}</td></tr>` : ""}
      <tr><td>Llamada</td><td>${hora(i.tiempo_llamada)}</td></tr>
      <tr><td>Llegada</td><td>${hora(i.tiempo_llegada)}</td></tr></table>
      <div class="sim">Incidente de ejemplo (simulado). No proviene del 911.</div></div>`;
  const popupEjido = (e) => `<div class="popup"><h4>🌾 ${esc(e.nombre)}</h4><table>
      <tr><td>Nombre INEGI</td><td>${esc(e.oficial)}</td></tr>
      <tr><td>Clave INEGI</td><td>${esc(e.cvegeo)}</td></tr>
      <tr><td>Coordenadas</td><td>${e.lat.toFixed(6)}, ${e.lon.toFixed(6)}</td></tr>
      <tr><td>Población 2020</td><td>${e.pob != null ? num(e.pob) : "—"}</td></tr>
      <tr><td>Verificación</td><td>${esc(e.verif)}</td></tr>
      ${e.notas ? `<tr><td>Nota</td><td>${esc(e.notas)}</td></tr>` : ""}
      <tr><td>Fuente</td><td><a href="https://gaia.inegi.org.mx/wscatgeo/v2/localidades/${esc(e.cvegeo)}" target="_blank" rel="noopener">INEGI</a>${e.osm ? ` · <a href="https://www.openstreetmap.org/${esc(e.osm)}" target="_blank" rel="noopener">OSM</a>` : ""}</td></tr></table></div>`;
  const popupLocalidad = (l) => `<div class="popup"><h4>📍 ${esc(l[1])}</h4><table>
      <tr><td>Clave INEGI</td><td>10007${esc(l[0])}</td></tr>
      <tr><td>Ámbito</td><td>${l[5] === "U" ? "Urbano" : "Rural"}</td></tr>
      <tr><td>Población 2020</td><td>${l[4] != null ? num(l[4]) : "sin dato (INEGI: “-”)"}</td></tr>
      <tr><td>Coordenadas</td><td>${l[2].toFixed(6)}, ${l[3].toFixed(6)}</td></tr>
      <tr><td>Fuente</td><td><a href="https://gaia.inegi.org.mx/wscatgeo/v2/localidades/10007${esc(l[0])}" target="_blank" rel="noopener">INEGI</a></td></tr></table></div>`;

  function construirMapa() {
    mapa = L.map("mapa", { zoomControl: true, zoomSnap: 0.25, zoomDelta: 0.5, preferCanvas: false }).setView([25.68, -103.48], 10);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · INEGI · Rutas: OSRM' }).addTo(mapa);
    L.control.scale({ imperial: false }).addTo(mapa);
    const lienzo = L.canvas({ padding: 0.5 });

    capas.limite = L.layerGroup().addTo(mapa);
    capas.localidades = L.layerGroup().addTo(mapa);
    capas.perimetros = L.layerGroup().addTo(mapa);
    capas.ejidos = L.layerGroup().addTo(mapa);
    capas.rutas = L.layerGroup().addTo(mapa);
    capas.incidentes = L.layerGroup().addTo(mapa);
    capas.unidades = L.layerGroup().addTo(mapa);
    // El mapa de calor va dentro de un grupo: su opción maxZoom (intensidad) haría que Leaflet deshabilite la casilla al acercarse
    capas.calorHeat = L.heatLayer([], { radius: 35, blur: 25, maxZoom: 13, minOpacity: 0.35 });
    capas.calor = L.layerGroup([capas.calorHeat]);

    L.geoJSON(D.limite, { interactive: false, style: { color: "#0b2545", weight: 2, dashArray: "4 4", fill: false, opacity: 0.7 } }).addTo(capas.limite);

    // 494 localidades INEGI: círculos pequeños en canvas, tamaño y color según población 2020
    const ordenadas = [...D.localidades].sort((a, b) => (a[4] || 0) - (b[4] || 0));
    for (const l of ordenadas) {
      const p = l[4] || 0;
      const est = p >= 2500 ? { radius: 8, fillColor: "#c1121f" } : p >= 500 ? { radius: 5, fillColor: "#f4a261" } : { radius: 3, fillColor: "#6c757d" };
      L.circleMarker([l[2], l[3]], { renderer: lienzo, ...est, color: "#fff", weight: 1, fillOpacity: 0.85 })
        .bindTooltip(`${l[1]}${l[4] != null ? ` · ${num(l[4])} hab.` : ""}`, { direction: "top" })
        .bindPopup(popupLocalidad(l)).addTo(capas.localidades);
    }
    $("n-loc").textContent = num(D.localidades.length);

    // Perímetros: SOLO puntos de las localidades integrantes (no existe polígono oficial publicado)
    const porClave = new Map(D.localidades.map((l) => [l[0], l]));
    const COLOR = { "Lavín": "#7b2cbf", "Sacramento": "#0077b6" };
    for (const [nombre, miembros] of Object.entries(D.perimetros)) {
      for (const m of miembros) {
        const l = porClave.get(m.cve); if (!l) continue;
        L.circleMarker([l[2], l[3]], { radius: 12, color: COLOR[nombre] || "#333", weight: 3, fill: false, dashArray: m.nota.startsWith("Probable") ? "4 4" : null })
          .bindTooltip(`Perímetro ${nombre}: ${l[1]}`, { direction: "bottom" })
          .bindPopup(`<div class="popup"><h4>◎ Perímetro ${esc(nombre)}</h4><table>
            <tr><td>Localidad INEGI</td><td><b>${esc(l[1])}</b> (10007${esc(l[0])})</td></tr>
            <tr><td>Nombre en la fuente</td><td>${esc(m.nombre_fuente)}</td></tr>
            ${m.nota ? `<tr><td>Nota</td><td>${esc(m.nota)}</td></tr>` : ""}
            <tr><td>Fuente</td><td>Ayuntamiento de Gómez Palacio, SIDEAPAAR 2023, “Indicadores de resultados” (tabla “Comunidades atendidas en drenaje y alcantarillado”)</td></tr></table>
            <div class="sim">No existe un polígono oficial publicado (INEGI ni OpenStreetMap) para este perímetro: se marcan solo las localidades que lo integran; no se dibuja un límite.</div></div>`)
          .addTo(capas.perimetros);
      }
    }

    const IZQ = new Set(["Chihuahuita (Viejo)", "Nuevo Gómez"]);
    for (const e of D.ejidos) {
      L.marker([e.lat, e.lon], { icon: iconoEjido(), zIndexOffset: 200 }).bindPopup(popupEjido(e))
        .bindTooltip(e.nombre, { permanent: true, direction: IZQ.has(e.nombre) ? "left" : "right", offset: [IZQ.has(e.nombre) ? -8 : 8, 0], className: "etq-ejido" })
        .addTo(capas.ejidos);
    }

    // En teléfono: botón propio "Capas" que muestra/oculta la lista (más fiable en pantallas táctiles que el control plegable de Leaflet)
    let botonCapas = null;
    if (esMovil()) {
      const Boton = L.Control.extend({ options: { position: "topright" }, onAdd() {
        const b = L.DomUtil.create("button", "boton-capas"); b.type = "button"; b.innerHTML = "🗂️ Capas";
        L.DomEvent.disableClickPropagation(b); return b; } });
      botonCapas = new Boton().addTo(mapa).getContainer();
    }
    const control = L.control.layers(null, {
      "🚔 Patrullas (simuladas)": capas.unidades,
      "🚨 Incidentes (simulados)": capas.incidentes,
      "🛣️ Rutas patrulla → incidente": capas.rutas,
      "🌾 Ejidos verificados (13)": capas.ejidos,
      [`📍 Localidades INEGI (${D.localidades.length})`]: capas.localidades,
      "◎ Perímetros Lavín / Sacramento": capas.perimetros,
      "🔥 Mapa de calor de incidentes": capas.calor,
      "▭ Límite municipal (OSM)": capas.limite,
    }, { collapsed: false, position: esMovil() ? "topright" : "bottomright" }).addTo(mapa);
    if (botonCapas) {
      const lista = control.getContainer(); lista.classList.add("capas-oculta");
      const alternar = (mostrar) => { lista.classList.toggle("capas-oculta", !mostrar); botonCapas.classList.toggle("activo", mostrar); };
      L.DomEvent.on(botonCapas, "click", (e) => { L.DomEvent.stop(e); alternar(lista.classList.contains("capas-oculta")); });
      mapa.on("click", () => alternar(false));
      // También se oculta al tocar cualquier parte del mapa fuera de la lista (puntos, rutas o ventanas emergentes incluidos)
      L.DomEvent.on(mapa.getContainer(), "pointerdown", (e) => {
        if (!lista.classList.contains("capas-oculta") && !lista.contains(e.target) && !botonCapas.contains(e.target)) alternar(false);
      });
    }
    mapa.fitBounds(L.geoJSON(D.limite).getBounds(), { padding: [10, 10] });
  }

  function restoDeRuta(u) {
    const { i } = puntoEnRuta(u.ruta);
    return [[u.lat, u.lon], ...u.ruta.coords.slice(i + 1)];
  }

  function pintar() {
    if (!mapa) return;
    const vistosU = new Set();
    for (const u of E.unidades) {
      vistosU.add(u.codigo);
      let m = marcadoresUnidad.get(u.codigo);
      if (!m) { m = L.marker(pos(u), { icon: iconoUnidad(u), zIndexOffset: 1000 }).bindPopup(popupUnidad(u)).addTo(capas.unidades); m._est = u.estatus; marcadoresUnidad.set(u.codigo, m); }
      else { m.setLatLng(pos(u)); if (m._est !== u.estatus) { m.setIcon(iconoUnidad(u)); m._est = u.estatus; } m.setPopupContent(popupUnidad(u)); }
    }
    const vistosI = new Set();
    for (const i of E.incidentes) {
      vistosI.add(i.folio);
      let m = marcadoresIncidente.get(i.folio);
      if (!m) { m = L.marker(pos(i), { icon: iconoIncidente(i), zIndexOffset: 500 }).bindPopup(popupIncidente(i)).addTo(capas.incidentes); marcadoresIncidente.set(i.folio, m); }
      else m.setPopupContent(popupIncidente(i));
    }
    for (const [k, m] of marcadoresIncidente) if (!vistosI.has(k)) { capas.incidentes.removeLayer(m); marcadoresIncidente.delete(k); }
    capas.calorHeat.setLatLngs(E.incidentes.map((i) => [i.lat, i.lon, i.prioridad === "alta" ? 1 : i.prioridad === "media" ? 0.7 : 0.4]));

    capas.rutas.clearLayers();
    for (const u of E.unidades) {
      if (!u.ruta) continue;
      const haciaInc = u.ruta.destino === "incidente", osrm = u.ruta.fuente === "osrm";
      const estilo = haciaInc
        ? (osrm ? { color: "#1d4ed8", weight: 5, opacity: 0.85 } : { color: "#d62828", weight: 4, opacity: 0.9, dashArray: "8 8" })
        : { color: "#6b7280", weight: 3, opacity: 0.6, dashArray: osrm ? null : "4 6" };
      L.polyline(restoDeRuta(u), estilo)
        .bindTooltip(`${u.codigo}: ${haciaInc ? `hacia ${u.incidente}` : "regreso a base"} · ${txtRuta(u.ruta.fuente)} · ${km(u.ruta.distancia)} · ${minutos(u.ruta.duracion)}`, { sticky: true })
        .addTo(capas.rutas);
    }

    const disp = E.unidades.filter((u) => u.estatus === "disponible").length;
    $("c-disponibles").textContent = disp;
    $("c-ocupadas").textContent = E.unidades.length - disp;
    $("c-incidentes").textContent = E.incidentes.length;
    $("c-pendientes").textContent = E.incidentes.filter((i) => i.estatus === "pendiente").length;
    pintarLista();
  }

  function pintarLista() {
    const ul = $("lista-incidentes");
    if (!E.incidentes.length) { ul.innerHTML = `<li class="vacio">Sin incidentes activos. Cerrados en esta sesión: ${E.cerrados}.</li>`; return; }
    const orden = { pendiente: 0, asignado: 1, en_sitio: 2 };
    const lista = [...E.incidentes].sort((a, b) => orden[a.estatus] - orden[b.estatus] || b.tiempo_llamada - a.tiempo_llamada);
    ul.innerHTML = lista.map((i) => `
      <li class="${esc(i.prioridad)}" data-folio="${esc(i.folio)}">
        <div class="fila1"><span>${esc(i.folio)}</span><span class="estatus ${esc(i.estatus)}">${esc(ESTATUS_INC[i.estatus])}</span></div>
        <div class="fila2">${esc(i.tipo)} · Prioridad ${esc(PRIORIDAD[i.prioridad])}</div>
        <div class="fila2">📍 ${esc(i.referencia || "—")} · 🕒 ${hora(i.tiempo_llamada)}</div>
        <div class="fila2">🚔 ${esc(i.patrulla || "Sin asignar")}${i.patrulla ? ` · ${km(i.distancia_m)} · ${minutos(i.eta_s)} · ${i.fuente_ruta === "osrm" ? "por calles" : "línea recta"}` : ""}</div>
        ${i.estatus === "pendiente" ? `<button class="btn-asignar" data-folio="${esc(i.folio)}" ${i._asignando ? "disabled" : ""}>${i._asignando ? "Calculando rutas…" : "Asignar patrulla más cercana"}</button>` : ""}
      </li>`).join("");
  }

  // ---------- Resultado / avisos ----------
  function avisoMapa(html, clase) {
    const a = $("aviso-mapa"); a.className = "aviso-mapa " + (clase || ""); a.innerHTML = html;
    clearTimeout(avisoMapa._t); avisoMapa._t = setTimeout(() => a.classList.add("oculto"), 9000);
  }
  function mostrarResultado(i, res) {
    const box = $("resultado");
    const ok = res && res.ok;
    box.className = "resultado" + (ok ? (res.r.fuente === "osrm" ? "" : " pendiente") : " pendiente");
    const cand = ok && res.candidatas ? res.candidatas.map((c) => `${esc(c.codigo)}: ${c.dur != null ? minutos(c.dur) : "s/ruta"}${c.dist != null ? ` (${km(c.dist)})` : ""}`).join(" · ") : null;
    box.innerHTML = `<h3>${ok ? "✅ Patrulla asignada" : "⏳ Incidente en espera"}</h3>
      <dl>
        <dt>Folio</dt><dd>${esc(i.folio)}</dd>
        <dt>Tipo</dt><dd>${esc(i.tipo)}</dd>
        <dt>Cerca de</dt><dd>🌾 ${esc(i.referencia)}${i.dist_ejido != null ? ` (${km(i.dist_ejido)})` : ""}</dd>
        ${i.localidad ? `<dt>Localidad INEGI</dt><dd>${esc(i.localidad)}</dd>` : ""}
        <dt>Patrulla</dt><dd>${esc(ok ? res.u.codigo : "Sin unidad disponible")}</dd>
        ${ok ? `<dt>Distancia</dt><dd>${km(res.r.distancia)} ${res.r.fuente === "osrm" ? "por calles" : "en línea recta"}</dd>
        <dt>Tiempo est.</dt><dd>${minutos(res.r.duracion)} ${res.r.fuente === "osrm" ? "de manejo (OSRM)" : "a 40 km/h"}</dd>` : ""}
        ${cand ? `<dt>Comparadas</dt><dd class="fino">${cand}</dd>` : ""}
      </dl>
      <p class="nota">${esc(res ? res.mensaje : "")}${ok && res.r.fuente !== "osrm" ? ` Ruta en LÍNEA RECTA: OSRM no disponible (${esc(res.r.error)}).` : ""}${i.fuera ? " ATENCIÓN: el punto está fuera del municipio de Gómez Palacio." : ""} Llamada simulada: folio, teléfono y ubicación son datos de ejemplo; movimiento acelerado ×15.</p>`;
    if (ok) {
      avisoMapa(`✅ <b>${esc(res.u.codigo)}</b> → ${esc(i.folio)} · ${km(res.r.distancia)} · ${minutos(res.r.duracion)} · ${res.r.fuente === "osrm" ? "por calles (OSRM)" : "<b>línea recta</b> (OSRM no disponible)"}`, res.r.fuente === "osrm" ? "" : "alerta");
      mapa.fitBounds(L.latLngBounds(res.r.coords), { padding: esMovil() ? [30, 30] : [60, 60], maxZoom: 15 });
    } else avisoMapa(`⏳ ${esc(i.folio)}: sin unidad disponible, queda en espera.`, "alerta");
  }

  function dentroMunicipio(lat, lon) {
    const g = D.limite.geometry || D.limite;
    const anillo = g.type === "Polygon" ? g.coordinates[0] : g.coordinates[0][0];
    let dentro = false;
    for (let a = 0, b = anillo.length - 1; a < anillo.length; b = a++) {
      const [xi, yi] = anillo[a], [xj, yj] = anillo[b];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
    return dentro;
  }
  function localidadCercana(p) {
    let mejor = null, dm = Infinity;
    for (const l of D.localidades) { const d = dist(p, [l[2], l[3]]); if (d < dm) { dm = d; mejor = l; } }
    return mejor ? `${mejor[1]} (${km(dm)})` : null;
  }
  function folioNuevo() {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "");
    E.seq += 1; return `GP-${f}-${String(E.seq).padStart(4, "0")}`;
  }

  async function simularLlamada() {
    const btn = $("btn-simular");
    btn.disabled = true; btn.textContent = "📞 Calculando ruta…";
    const ej = D.ejidos[Math.floor(Math.random() * D.ejidos.length)];
    const [lat, lon] = desplazar(ej.lat, ej.lon, 150 + Math.random() * 550, Math.random() * 360);
    const [tipo, prioridad] = TIPOS[Math.floor(Math.random() * TIPOS.length)];
    const i = { folio: folioNuevo(), tipo, prioridad, lat, lon, referencia: ej.nombre, direccion: `Cerca de ${ej.nombre} (simulado)`,
      telefono: "871-SIM-" + String(Math.floor(Math.random() * 10000)).padStart(4, "0"), aml: Math.random() < 0.7,
      tiempo_llamada: Date.now(), estatus: "pendiente", patrulla: null, dist_ejido: dist([lat, lon], [ej.lat, ej.lon]),
      localidad: localidadCercana([lat, lon]), fuera: !dentroMunicipio(lat, lon) };
    E.incidentes.push(i); guardar(); pintar();
    if (esMovil()) abrirPanel(false);
    try {
      const res = await asignar(i);
      mostrarResultado(i, res);
      setTimeout(() => { const m = marcadoresIncidente.get(i.folio); if (m && !esMovil()) m.openPopup(); }, 700);
    } finally { btn.disabled = false; btn.textContent = "📞 Simular llamada 911"; }
  }

  function abrirPanel(abrir) {
    const p = $("panel"); p.classList.toggle("abierto", abrir);
    $("asa").setAttribute("aria-expanded", String(abrir));
    $("asa-txt").textContent = abrir ? "▼ Ver mapa" : "▲ Ver panel";
  }

  // ---------- Inicio (lo llama acceso.js tras descifrar los datos) ----------
  window.DGI_iniciar = function (datos) {
    if (mapa) return;
    D = datos;
    construirMapa();
    const guardado = cargarEstado();
    E = guardado || estadoInicial();
    pintar();
    if (!guardado) despacharSemilla();
    setInterval(ciclo, INTERVALO_MS);

    $("btn-simular").addEventListener("click", simularLlamada);
    $("asa").addEventListener("click", () => abrirPanel(!$("panel").classList.contains("abierto")));
    $("lista-incidentes").addEventListener("click", async (ev) => {
      const btn = ev.target.closest(".btn-asignar");
      if (btn) {
        ev.stopPropagation();
        const i = incidente(btn.dataset.folio); if (!i) return;
        if (esMovil()) abrirPanel(false);
        const res = await asignar(i);
        if (res) mostrarResultado(i, res);
        return;
      }
      const li = ev.target.closest("li[data-folio]"); if (!li) return;
      const m = marcadoresIncidente.get(li.dataset.folio);
      if (m) { if (esMovil()) abrirPanel(false); mapa.flyTo(m.getLatLng(), 14, { duration: 0.8 }); setTimeout(() => m.openPopup(), 850); }
    });
    $("btn-reiniciar").addEventListener("click", () => {
      if (!confirm("¿Restablecer patrullas e incidentes de ejemplo?")) return;
      E = estadoInicial(); guardar(); $("resultado").className = "resultado oculto";
      pintar(); despacharSemilla();
    });
    const reloj = () => { $("reloj").textContent = new Date().toLocaleTimeString("es-MX", { timeZone: TZ }) + " (centro)"; };
    reloj(); setInterval(reloj, 1000);
    window.__dgi = { mapa, estado: () => E, datos: () => D }; // depuración
  };
})();
