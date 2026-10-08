/* Durango GeoInteligencia — frontend (Leaflet + OpenStreetMap)
   PROTOTIPO: patrullas, incidentes y teléfonos son DATOS SIMULADOS. Ejidos: INEGI/OSM. */
(function () {
  "use strict";
  const params = new URLSearchParams(location.search);
  // En docker-compose y en local el frontend corre en :8080 y la API en :8000
  const API = params.get("api") || (location.port === "8080" ? `${location.protocol}//${location.hostname}:8000` : location.origin);
  const WS_URL = API.replace(/^http/, "ws") + "/ws/tiempo-real";
  const TZ = "America/Mexico_City";

  const ESTATUS_UNIDAD = { disponible: "Disponible", asignada: "En camino", en_sitio: "En sitio", fuera_servicio: "Fuera de servicio" };
  const ESTATUS_INC = { pendiente: "Pendiente", asignado: "Unidad en camino", en_sitio: "Unidad en sitio", cerrado: "Cerrado" };
  const PRIORIDAD = { alta: "Alta", media: "Media", baja: "Baja" };
  const TIPOS = [
    ["Robo a casa habitación", "alta"], ["Accidente vial", "alta"], ["Violencia familiar", "alta"],
    ["Riña en vía pública", "media"], ["Robo de vehículo", "media"], ["Disparos de arma de fuego (reporte)", "alta"],
    ["Persona sospechosa", "baja"], ["Ruido / alteración del orden", "baja"], ["Robo de ganado o equipo agrícola", "media"],
  ];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString("es-MX", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—");
  const km = (m) => (m == null ? "—" : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
  const num = (n) => Number(n).toLocaleString("es-MX");

  // ---------- Mapa ----------
  const mapa = L.map("mapa", { zoomControl: true, zoomSnap: 0.25, zoomDelta: 0.5 }).setView([25.5692, -103.4986], 11);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Ejidos: INEGI',
  }).addTo(mapa);
  L.control.scale({ imperial: false }).addTo(mapa);

  const capaUnidades = L.layerGroup().addTo(mapa);
  const capaIncidentes = L.layerGroup().addTo(mapa);
  const capaEjidos = L.layerGroup().addTo(mapa);
  const capaRutas = L.layerGroup().addTo(mapa);
  const capaLimite = L.layerGroup().addTo(mapa);
  const capaCalor = L.heatLayer([], { radius: 35, blur: 25, maxZoom: 13, minOpacity: 0.35 });

  L.control.layers(null, {
    "🚔 Patrullas (simuladas)": capaUnidades,
    "🚨 Incidentes (simulados)": capaIncidentes,
    "➖ Ruta patrulla → incidente": capaRutas,
    "🌾 Ejidos (INEGI)": capaEjidos,
    "🔥 Mapa de calor de incidentes": capaCalor,
    "▭ Límite municipal (OSM)": capaLimite,
  }, { collapsed: false, position: "bottomright" }).addTo(mapa);

  const iconoUnidad = (u) => L.divIcon({
    className: "mk", iconSize: [40, 46], iconAnchor: [20, 18], popupAnchor: [0, -16],
    html: `<div class="mk-unidad ${esc(u.estatus)}"><div class="em">🚔</div><div class="cod">${esc(u.codigo)}</div></div>`,
  });
  const iconoIncidente = (i) => L.divIcon({
    className: "mk", iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -14],
    html: `<div class="mk-inc ${esc(i.prioridad)}"><span class="anillo"></span><span class="em">🚨</span></div>`,
  });
  const iconoEjido = L.divIcon({ className: "mk mk-ejido", iconSize: [22, 22], iconAnchor: [11, 11], html: "🌾" });

  const popupUnidad = (u) => `<div class="popup"><h4>🚔 ${esc(u.codigo)}</h4><table>
      <tr><td>Tipo</td><td>${esc(u.tipo)}</td></tr>
      <tr><td>Estatus</td><td><b>${esc(ESTATUS_UNIDAD[u.estatus] || u.estatus)}</b></td></tr>
      <tr><td>Incidente</td><td>${esc(u.incidente_folio || "—")}</td></tr>
      <tr><td>Posición</td><td>${u.lat.toFixed(5)}, ${u.lon.toFixed(5)}</td></tr>
      <tr><td>Actualizado</td><td>${hora(u.ultima_actualizacion)} (hora centro)</td></tr></table>
      <div class="sim">Unidad y GPS simulados (datos de ejemplo).</div></div>`;
  const popupIncidente = (i) => `<div class="popup"><h4>🚨 ${esc(i.folio)}</h4><table>
      <tr><td>Tipo</td><td><b>${esc(i.tipo)}</b></td></tr>
      <tr><td>Prioridad</td><td>${esc(PRIORIDAD[i.prioridad] || i.prioridad)}</td></tr>
      <tr><td>Estatus</td><td>${esc(ESTATUS_INC[i.estatus] || i.estatus)}</td></tr>
      <tr><td>Referencia</td><td>${esc(i.direccion || i.ejido_referencia || "—")}</td></tr>
      <tr><td>Teléfono</td><td>${esc(i.telefono_origen || "—")} (ficticio)</td></tr>
      <tr><td>Ubicación AML</td><td>${i.coordenadas_aml ? "Sí" : "No"} (simulado)</td></tr>
      <tr><td>Patrulla</td><td>${esc(i.patrulla_asignada || "Sin asignar")}</td></tr>
      <tr><td>Distancia</td><td>${km(i.distancia_metros)}${i.eta_minutos != null ? ` · ETA ${i.eta_minutos} min` : ""}</td></tr>
      <tr><td>Llamada</td><td>${hora(i.tiempo_llamada)}</td></tr>
      <tr><td>Llegada</td><td>${hora(i.tiempo_llegada)}</td></tr></table>
      <div class="sim">Incidente de ejemplo (simulado). No proviene del 911.</div></div>`;
  const popupEjido = (e) => `<div class="popup"><h4>🌾 ${esc(e.nombre)}</h4><table>
      <tr><td>Nombre INEGI</td><td>${esc(e.nombre_oficial)}</td></tr>
      <tr><td>Clave INEGI</td><td>${esc(e.cvegeo)}</td></tr>
      <tr><td>Coordenadas</td><td>${e.lat.toFixed(6)}, ${e.lon.toFixed(6)}</td></tr>
      <tr><td>Población 2020</td><td>${e.poblacion_2020 != null ? num(e.poblacion_2020) : "—"}</td></tr>
      <tr><td>Verificación</td><td>${esc(e.verificacion || "")}</td></tr>
      ${e.notas ? `<tr><td>Nota</td><td>${esc(e.notas)}</td></tr>` : ""}
      <tr><td>Fuente</td><td><a href="${esc(e.url_fuente)}" target="_blank" rel="noopener">INEGI ${esc(e.cvegeo)}</a>${e.osm_id ? ` · <a href="https://www.openstreetmap.org/${esc(e.osm_id)}" target="_blank" rel="noopener">OSM</a>` : ""}</td></tr></table></div>`;

  const IZQ = new Set(["Chihuahuita (Viejo)", "Nuevo Gómez"]); // etiquetas a la izquierda para que no se encimen
  const marcadoresUnidad = new Map();
  const marcadoresIncidente = new Map();
  let ejidos = [];
  let incidentesActuales = [];
  let primerAjuste = false;

  function actualizarUnidades(lista) {
    const vistos = new Set();
    lista.forEach((u) => {
      vistos.add(u.codigo);
      let m = marcadoresUnidad.get(u.codigo);
      if (!m) {
        m = L.marker([u.lat, u.lon], { icon: iconoUnidad(u), zIndexOffset: 1000 }).bindPopup(popupUnidad(u)).addTo(capaUnidades);
        m._estatus = u.estatus;
        marcadoresUnidad.set(u.codigo, m);
      } else {
        // Corrección: se mueve el marcador existente y se actualiza su popup (no se redibuja sin popup)
        m.setLatLng([u.lat, u.lon]);
        if (m._estatus !== u.estatus) { m.setIcon(iconoUnidad(u)); m._estatus = u.estatus; }
        m.setPopupContent(popupUnidad(u));
      }
      m._datos = u;
    });
    for (const [k, m] of marcadoresUnidad) if (!vistos.has(k)) { capaUnidades.removeLayer(m); marcadoresUnidad.delete(k); }
  }

  function actualizarIncidentes(lista) {
    incidentesActuales = lista;
    const vistos = new Set();
    lista.forEach((i) => {
      vistos.add(i.folio);
      let m = marcadoresIncidente.get(i.folio);
      if (!m) {
        m = L.marker([i.lat, i.lon], { icon: iconoIncidente(i), zIndexOffset: 500 }).bindPopup(popupIncidente(i)).addTo(capaIncidentes);
        marcadoresIncidente.set(i.folio, m);
      } else {
        m.setLatLng([i.lat, i.lon]);
        m.setPopupContent(popupIncidente(i));
      }
    });
    for (const [k, m] of marcadoresIncidente) if (!vistos.has(k)) { capaIncidentes.removeLayer(m); marcadoresIncidente.delete(k); }
    capaCalor.setLatLngs(lista.map((i) => [i.lat, i.lon, i.prioridad === "alta" ? 1 : i.prioridad === "media" ? 0.7 : 0.4]));
    dibujarRutas();
    pintarLista();
  }

  function dibujarRutas() {
    capaRutas.clearLayers();
    incidentesActuales.forEach((i) => {
      if (i.estatus !== "asignado" || !i.patrulla_asignada) return;
      const m = marcadoresUnidad.get(i.patrulla_asignada);
      if (!m) return;
      L.polyline([m.getLatLng(), [i.lat, i.lon]], { color: "#f77f00", weight: 3, dashArray: "6 6", opacity: 0.85 }).addTo(capaRutas);
    });
  }

  function pintarLista() {
    const ul = $("lista-incidentes");
    if (!incidentesActuales.length) { ul.innerHTML = '<li class="vacio">Sin incidentes activos.</li>'; return; }
    ul.innerHTML = incidentesActuales.map((i) => `
      <li class="${esc(i.prioridad)}" data-folio="${esc(i.folio)}">
        <div class="fila1"><span>${esc(i.folio)}</span><span class="estatus ${esc(i.estatus)}">${esc(ESTATUS_INC[i.estatus] || i.estatus)}</span></div>
        <div class="fila2">${esc(i.tipo)} · Prioridad ${esc(PRIORIDAD[i.prioridad] || i.prioridad)}</div>
        <div class="fila2">📍 ${esc(i.ejido_referencia || i.direccion || "—")} · 🕒 ${hora(i.tiempo_llamada)}</div>
        <div class="fila2">🚔 ${esc(i.patrulla_asignada || "Sin asignar")}${i.eta_minutos != null ? ` · ETA ${i.eta_minutos} min · ${km(i.distancia_metros)}` : ""}</div>
        ${i.estatus === "pendiente" ? `<button class="btn-asignar" data-id="${i.id}">Asignar patrulla más cercana</button>` : ""}
      </li>`).join("");
  }

  $("lista-incidentes").addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".btn-asignar");
    if (btn) {
      ev.stopPropagation();
      btn.disabled = true;
      try {
        const r = await fetch(`${API}/api/incidente/${btn.dataset.id}/asignar`, { method: "POST" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.detail || r.statusText);
        mostrarResultado(d, null);
      } catch (e) { mostrarError(e); }
      return;
    }
    const li = ev.target.closest("li[data-folio]");
    if (!li) return;
    const m = marcadoresIncidente.get(li.dataset.folio);
    if (m) { mapa.flyTo(m.getLatLng(), 14, { duration: 0.8 }); setTimeout(() => m.openPopup(), 850); }
  });

  function pintarResumen(r) {
    $("c-disponibles").textContent = r.unidades_disponibles;
    $("c-ocupadas").textContent = r.unidades_ocupadas;
    $("c-incidentes").textContent = r.incidentes_activos;
    $("c-ejidos").textContent = r.ejidos;
  }

  function ajustarVista() {
    if (primerAjuste) return;
    const pts = [...ejidos.map((e) => [e.lat, e.lon]), ...[...marcadoresUnidad.values()].map((m) => m.getLatLng())];
    if (pts.length > 3) { mapa.fitBounds(L.latLngBounds(pts), { padding: [25, 25], maxZoom: 13 }); primerAjuste = true; }
  }

  // ---------- Datos iniciales ----------
  async function cargarJSON(ruta) {
    const r = await fetch(API + ruta);
    if (!r.ok) throw new Error(`${ruta}: HTTP ${r.status}`);
    return r.json();
  }

  async function cargarInicial() {
    const [ej, un, inc, res, lim] = await Promise.all([
      cargarJSON("/api/ejidos"), cargarJSON("/api/unidades"), cargarJSON("/api/incidentes/activos"),
      cargarJSON("/api/resumen"), cargarJSON("/api/limite").catch(() => null),
    ]);
    ejidos = ej;
    ej.forEach((e) => {
      L.marker([e.lat, e.lon], { icon: iconoEjido })
        .bindPopup(popupEjido(e))
        .bindTooltip(e.nombre, { permanent: true, direction: IZQ.has(e.nombre) ? "left" : "right", offset: [IZQ.has(e.nombre) ? -8 : 8, 0], className: "etq-ejido" })
        .addTo(capaEjidos);
    });
    if (lim) L.geoJSON(lim, { style: { color: "#0b2545", weight: 2, dashArray: "4 4", fill: false, opacity: 0.7 } })
      .bindTooltip("Municipio de Gómez Palacio (límite OSM)").addTo(capaLimite);
    actualizarUnidades(un);
    actualizarIncidentes(inc);
    pintarResumen(res);
    ajustarVista();
  }

  // ---------- WebSocket tiempo real ----------
  let ws, reintento = 1000;
  function conectar() {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => { $("estado-conexion").textContent = "● En vivo (simulación)"; $("estado-conexion").className = "chip conexion conectado"; reintento = 1000; };
    ws.onmessage = (ev) => {
      const d = JSON.parse(ev.data);
      if (d.tipo !== "actualizacion") return;
      actualizarUnidades(d.unidades);
      actualizarIncidentes(d.incidentes);
      pintarResumen(d.resumen);
    };
    ws.onclose = () => {
      $("estado-conexion").textContent = "● Sin conexión, reintentando…"; $("estado-conexion").className = "chip conexion desconectado";
      setTimeout(conectar, reintento); reintento = Math.min(reintento * 2, 15000);
    };
    ws.onerror = () => ws.close();
  }

  // ---------- Simular llamada 911 ----------
  function desplazar(lat, lon, metros, rumboGrados) {
    const R = 6371008.8, d = metros / R, b = (rumboGrados * Math.PI) / 180;
    const f1 = (lat * Math.PI) / 180, l1 = (lon * Math.PI) / 180;
    const f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(f1), Math.cos(d) - Math.sin(f1) * Math.sin(f2));
    return [(f2 * 180) / Math.PI, (l2 * 180) / Math.PI];
  }

  function mostrarResultado(d, tipo) {
    const box = $("resultado");
    const asignada = !!d.patrulla_asignada;
    box.className = "resultado" + (asignada ? "" : " pendiente");
    box.innerHTML = `<h3>${asignada ? "✅ Patrulla asignada" : "⏳ Incidente en espera"}</h3>
      <dl>
        <dt>Folio</dt><dd>${esc(d.folio)}</dd>
        ${tipo ? `<dt>Tipo</dt><dd>${esc(tipo)}</dd>` : ""}
        ${d.ejido_cercano ? `<dt>Cerca de</dt><dd>🌾 ${esc(d.ejido_cercano)}${d.distancia_ejido_m != null ? ` (${km(d.distancia_ejido_m)})` : ""}</dd>` : ""}
        <dt>Patrulla</dt><dd>${esc(d.patrulla_asignada || "Sin unidad disponible")}</dd>
        ${asignada ? `<dt>Distancia</dt><dd>${km(d.distancia_metros)} (línea recta)</dd>
        <dt>ETA estimada</dt><dd>${d.eta_minutos} min a 40 km/h</dd>` : ""}
      </dl>
      <p class="nota">${esc(d.mensaje || "")} Llamada simulada: folio, teléfono y ubicación son datos de ejemplo.</p>`;
  }
  function mostrarError(e) {
    const box = $("resultado");
    box.className = "resultado error";
    box.innerHTML = `<h3>⚠️ No se pudo registrar</h3><p class="nota">${esc(e.message || e)}</p>`;
  }

  $("btn-simular").addEventListener("click", async () => {
    if (!ejidos.length) return;
    const btn = $("btn-simular");
    btn.disabled = true; btn.textContent = "📞 Registrando llamada…";
    const ej = ejidos[Math.floor(Math.random() * ejidos.length)];
    const [lat, lon] = desplazar(ej.lat, ej.lon, 150 + Math.random() * 550, Math.random() * 360);
    const [tipo, prioridad] = TIPOS[Math.floor(Math.random() * TIPOS.length)];
    const tel = "871-SIM-" + String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    try {
      const r = await fetch(`${API}/api/incidente`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, prioridad, lat, lon, direccion: `Cerca de ${ej.nombre} (simulado)`, telefono_origen: tel,
                               coordenadas_aml: Math.random() < 0.7, ejido_referencia: ej.nombre }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail ? JSON.stringify(d.detail) : r.statusText);
      mostrarResultado(d, tipo);
      // abre el popup del nuevo incidente cuando llegue por WebSocket / recarga
      setTimeout(() => { const m = marcadoresIncidente.get(d.folio); if (m) m.openPopup(); }, 600);
    } catch (e) { mostrarError(e); }
    finally { btn.disabled = false; btn.textContent = "📞 Simular llamada 911"; }
  });

  $("btn-reiniciar").addEventListener("click", async () => {
    if (!confirm("¿Restablecer patrullas e incidentes de ejemplo?")) return;
    await fetch(`${API}/api/demo/reiniciar`, { method: "POST" });
    $("resultado").className = "resultado oculto";
  });

  setInterval(() => { $("reloj").textContent = new Date().toLocaleTimeString("es-MX", { timeZone: TZ }) + " (centro)"; }, 1000);

  cargarInicial().then(conectar).catch((e) => { mostrarError(e); conectar(); });
  window.__geo = { mapa, API }; // depuración
})();
