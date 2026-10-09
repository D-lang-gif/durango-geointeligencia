/* Durango GeoInteligencia v4 — CENTRO DE MANDO (DEMO, DATOS OPERATIVOS SIMULADOS).
   Roles: ALFA (Raúl, administrador) · CHARLIE (autoridades) · BRAVO (supervisión) · DELTA (unidades) · ECO (escuelas / vecinos).
   Agrega a la v3: capa de escuelas SEP (agrupadas por inmueble, perímetros y racimos), botón de pánico silencioso simulado
   (9-1-1/C5 → unidad más cercana → vecinos verificados, con 5 s para cancelar), categorías de incidente, violencia familiar en
   modo discreto, KPIs, feed, gráfica de tiempos de reacción, bitácora de auditoría, licencias simuladas y compuerta «Conexión real».
   NO se llama a ningún sistema real (9-1-1, C5, SMS). Todo vive en este navegador (localStorage). */
(function () {
  "use strict";
  const TZ = "America/Mexico_City", FACTOR = 15;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const hms = (t) => new Date(t).toLocaleTimeString("es-MX", { timeZone: TZ, hour12: false });
  const fecha = (t) => new Date(t).toLocaleDateString("es-MX", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
  const leer = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
  const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin espacio */ } };
  const esMovil = () => window.matchMedia("(max-width: 760px)").matches;
  const el = (tag, txt, cls) => { const n = document.createElement(tag); if (txt != null) n.textContent = txt; if (cls) n.className = cls; return n; };
  const minTxt = (s) => `${Math.max(1, Math.round(s / 60))} min`;
  function haversine(a, b) {
    const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
  }

  // ---------------- Roles: qué paneles ve cada uno ----------------
  const ROLES = {
    alfa: { etq: "ALFA", desc: "Administrador", tabs: ["mando", "operacion", "panico", "escuelas", "vf", "horarios", "estadistica", "licencias", "auditoria"], simular: true, cerrar: true },
    charlie: { etq: "CHARLIE", desc: "Autoridades", tabs: ["mando", "operacion", "panico", "escuelas", "vf", "estadistica", "auditoria"] },
    bravo: { etq: "BRAVO", desc: "Supervisión", tabs: ["mando", "operacion", "panico", "escuelas", "horarios"], simular: true, cerrar: true },
    delta: { etq: "DELTA", desc: "Unidad", tabs: ["unidad", "panico", "escuelas"] },
    eco: { etq: "ECO", desc: "Escuela / vecinos", tabs: ["miescuela", "escuelas"] },
  };
  let S = null, R = null, G = null, D = null;

  // ---------------- Bitácora de auditoría (encadenada con SHA-256; se muestra con textContent) ----------------
  const CLAVE_AUD = "dgi_v4_auditoria";
  let colaAud = Promise.resolve();
  async function sha256(t) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))), (b) => b.toString(16).padStart(2, "0")).join(""); }
  function auditar(ses, accion, detalle) {
    colaAud = colaAud.then(async () => {
      const L = leer(CLAVE_AUD, []);
      const prev = L.length ? L[L.length - 1].hash : "0".repeat(64);
      const e = { n: L.length + 1, t: Date.now(), usuario: (ses && ses.usuario) || "-", rol: (ses && ses.rol) || "-", accion, detalle: detalle || "", prev };
      e.hash = await sha256(JSON.stringify([e.n, e.t, e.usuario, e.rol, e.accion, e.detalle, e.prev]));
      L.push(e); escribir(CLAVE_AUD, L.slice(-400));
      if (S) pintarAuditoria();
    }).catch(() => {});
    return colaAud;
  }
  function pintarAuditoria() {
    const tb = $("tabla-auditoria"); if (!tb || !R || !R.tabs.includes("auditoria")) return;
    const L = leer(CLAVE_AUD, []).slice(-80).reverse();
    tb.replaceChildren(...L.map((e) => {
      const tr = el("tr"); if (/fallid|bloqu/.test(e.accion)) tr.className = "mal";
      for (const v of [e.n, hms(e.t), `${e.usuario} (${String(e.rol).toUpperCase()})`, e.accion, e.detalle]) tr.appendChild(el("td", String(v)));
      return tr;
    }));
  }

  // ---------------- Licencias (SIMULADAS) ----------------
  const CLAVE_LIC = "dgi_v4_licencias", DIA = 86400000;
  function licenciasIniciales() {
    const hoy = Date.now();
    return [
      { org: "ORG-000", nombre: "Administración · Raúl Muñoz Villa", asientos: 2, usados: 1, vence: null, estado: "activa", protegida: true },
      { org: "ORG-001", nombre: "Seguridad Pública Gómez Palacio (simulada)", asientos: 12, usados: 9, vence: Date.parse("2026-12-31T23:59:59-06:00"), estado: "activa" },
      { org: "ORG-002", nombre: "Autoridades invitadas (simulada)", asientos: 5, usados: 2, vence: hoy + 45 * DIA, estado: "activa" },
      { org: "ORG-003", nombre: "Red escolar muestra (simulada)", asientos: 3, usados: 2, vence: Date.parse("2027-07-16T23:59:59-06:00"), estado: "activa" },
      { org: "ORG-004", nombre: "Municipio de Lerdo · prospecto (simulada)", asientos: 10, usados: 0, vence: hoy + 30 * DIA, estado: "pendiente" },
    ];
  }
  const licencias = {
    todas() { let L = leer(CLAVE_LIC, null); if (!Array.isArray(L) || !L.length) { L = licenciasIniciales(); escribir(CLAVE_LIC, L); } return L; },
    verificar(org) {
      const l = this.todas().find((x) => x.org === org);
      if (!l) return { ok: false, motivo: "Su organización no tiene licencia (simulado)." };
      if (l.estado !== "activa") return { ok: false, motivo: `La licencia de ${org} está ${l.estado.toUpperCase()} (simulado). Contacte a Alfa.` };
      if (l.vence && l.vence < Date.now()) return { ok: false, motivo: `La licencia de ${org} venció el ${fecha(l.vence)} (simulado).` };
      return { ok: true, l };
    },
  };
  function pintarLicencias() {
    const tb = $("lic-tabla"); if (!tb || S.rol !== "alfa") return;
    tb.replaceChildren(...licencias.todas().map((l) => {
      const tr = el("tr"), venc = l.vence && l.vence < Date.now();
      const c1 = el("td"); c1.appendChild(el("b", l.org)); c1.appendChild(el("br")); c1.appendChild(el("small", l.nombre));
      tr.append(c1, el("td", `${l.usados}/${l.asientos}`), el("td", l.vence ? fecha(l.vence) : "sin vencimiento"), el("td", venc ? "vencida" : l.estado));
      const acc = el("td");
      if (!l.protegida) for (const [a, t] of [["mas30", "+30 días"], ["asiento", "+1 asiento"], [l.estado === "activa" ? "suspender" : "activar", l.estado === "activa" ? "Suspender" : "Activar"]]) {
        const b = el("button", t, "boton-secundario"); b.type = "button"; b.dataset.lic = l.org; b.dataset.acc = a; acc.appendChild(b);
      } else acc.appendChild(el("small", "propietario"));
      tr.appendChild(acc); return tr;
    }));
  }
  function accionLicencia(org, acc) {
    const L = licencias.todas(), l = L.find((x) => x.org === org); if (!l || l.protegida) return;
    if (acc === "mas30") l.vence = Math.max(l.vence || Date.now(), Date.now()) + 30 * DIA;
    if (acc === "asiento") l.asientos += 1;
    if (acc === "suspender") l.estado = "suspendida";
    if (acc === "activar") { l.estado = "activa"; if (l.vence && l.vence < Date.now()) l.vence = Date.now() + 30 * DIA; }
    escribir(CLAVE_LIC, L); auditar(S, "licencia_" + acc, `${org} (simulado)`); pintarLicencias();
  }

  // ---------------- Política de visibilidad por rol (la usa app.js) ----------------
  const verDetalleVF = () => S && S.rol === "charlie";
  function difuminar(i) { const g = 0.005; return [Math.floor(i.lat / g) * g + g / 2, Math.floor(i.lon / g) * g + g / 2]; } // celda ≈ 500 m
  const alertaDeMiEscuela = (i) => !!(i && i.panico && S.rol === "eco" && alertas().some((a) => a.id === i.panico && a.g === S.escuela));
  const POLITICA = {
    protegido: (i) => !!(i && i.sensible && !verDetalleVF()),
    posIncidente: (i) => (i.sensible && !verDetalleVF() ? difuminar(i) : [i.lat, i.lon]),
    ocultarRuta: (u, i) => (S.rol === "delta" && u.codigo !== S.unidad) || !!(i && i.sensible && !verDetalleVF()) || (S.rol === "eco" && !alertaDeMiEscuela(i)),
    verUnidad: (u) => (S.rol === "delta" ? u.codigo === S.unidad : S.rol === "eco" ? !!(u.incidente && alertaDeMiEscuela(G && G.estado().incidentes.find((x) => x.folio === u.incidente))) : true),
    verIncidente: (i) => (S.rol === "eco" ? alertaDeMiEscuela(i) : true),
  };

  // ---------------- Escuelas SEP (agrupadas por inmueble) ----------------
  // D.escuelas: [lat, lon, radio_m, [[clave, nombre, nivel, sostenimiento, municipio, localidad, colonia, direccion, turno, calidad], ...]]
  let cluster = null, perimetros = null; const marcEsc = new Map(), circEsc = new Map();
  const nombreG = (g) => (g[3].length > 1 ? `${g[3][0][1]} (+${g[3].length - 1})` : g[3][0][1]);
  function popupEscuela(k) {
    const g = D.escuelas[k], u = unidadMasCercana([g[0], g[1]]);
    const filas = g[3].slice(0, 12).map((e) => `<tr><td>${esc(e[0])}</td><td><b>${esc(e[1])}</b><br><small>${esc(e[2])} · ${esc(e[3])} · ${esc(e[8])}</small></td></tr>`).join("");
    const e0 = g[3][0];
    return `<div class="popup"><h4>🏫 ${g[3].length > 1 ? `${g[3].length} escuelas en este inmueble` : esc(e0[1])}</h4><table>${filas}
      ${g[3].length > 12 ? `<tr><td></td><td>… y ${g[3].length - 12} más</td></tr>` : ""}
      <tr><td>Dirección</td><td>${esc(e0[7])}${e0[6] ? ", " + esc(e0[6]) : ""} · ${esc(e0[5])}, ${esc(e0[4])}</td></tr>
      <tr><td>Prioridad</td><td><b>1</b> (escuelas) · perímetro sugerido ${g[2]} m</td></tr>
      <tr><td>Unidad más cercana</td><td>${u ? `${esc(u.u.codigo)} · ${(u.d / 1000).toFixed(1)} km en línea recta (simulada)` : "sin unidad disponible"}</td></tr>
      ${e0[9] !== "ok" ? `<tr><td>Coordenada</td><td>${esc(e0[9])}</td></tr>` : ""}</table>
      <div class="sim">Fuente: SEP, Catálogo de Centros de Trabajo 2025 (datos.gob.mx). Sin datos de alumnos.</div>
      ${R.simular ? `<button class="boton-secundario btn-panico-esc" data-esc="${k}" type="button">🚨 Simular botón de pánico aquí</button>` : ""}</div>`;
  }
  function construirEscuelas() {
    const lienzo = L.canvas({ padding: 0.3 });
    perimetros = L.layerGroup();
    cluster = L.markerClusterGroup({ chunkedLoading: true, showCoverageOnHover: false, maxClusterRadius: 45, disableClusteringAtZoom: 16, spiderfyOnMaxZoom: false,
      iconCreateFunction: (c) => { const n = c.getAllChildMarkers().reduce((a, m) => a + (m.options.nEsc || 1), 0);
        return L.divIcon({ html: `<div><span>${n}</span></div>`, className: "marker-cluster marker-cluster-escuelas", iconSize: L.point(38, 38) }); } });
    const marcadores = [];
    D.escuelas.forEach((g, k) => {
      const n = g[3].length;
      const m = L.marker([g[0], g[1]], { nEsc: n, icon: L.divIcon({ className: "mk", iconSize: [22, 22], iconAnchor: [11, 11], html: `<div class="mk-esc-grupo">${n > 1 ? n : "🏫"}</div>` }) })
        .bindTooltip(nombreG(g), { direction: "top" }).bindPopup(() => popupEscuela(k), { maxWidth: 320 });
      marcadores.push(m); marcEsc.set(k, m);
      const c = L.circle([g[0], g[1]], { renderer: lienzo, radius: g[2], color: "#13315c", weight: 1, fillColor: "#13315c", fillOpacity: 0.06, interactive: false }).addTo(perimetros);
      circEsc.set(k, c);
    });
    cluster.addLayers(marcadores);
    cluster.addTo(G.mapa); perimetros.addTo(G.mapa);
    const hosp = L.layerGroup(); // PENDIENTE: hospitales, clínicas (CLUES) y sitios de apoyo
    if (G.control) {
      G.control.addOverlay(cluster, `🏫 Escuelas SEP (${D.escuelas_meta.registros.toLocaleString("es-MX")}) · prioridad 1`);
      G.control.addOverlay(perimetros, "◯ Perímetros escolares 200/300 m");
      G.control.addOverlay(hosp, "🏥 Hospitales y sitios de apoyo (pendiente)");
    }
    $("esc-resumen").textContent = `${D.escuelas_meta.registros.toLocaleString("es-MX")} escuelas SEP (Gómez Palacio y Lerdo) en ${D.escuelas_meta.inmuebles} inmuebles · todas prioridad 1 · hospitales y sitios de apoyo: pendiente.`;
    $("esc-fuente").textContent = `Fuente: ${D.escuelas_meta.fuente}. Corte: ${D.escuelas_meta.fecha_fuente}. Consulta: ${D.escuelas_meta.fecha_consulta}. Radios de perímetro sugeridos, no norma oficial.`;
    const sel = $("pan-escuela");
    if (sel) {
      const orden = D.escuelas.map((g, k) => [k, nombreG(g)]).sort((a, b) => a[1].localeCompare(b[1], "es"));
      sel.replaceChildren(...orden.map(([k, n]) => { const o = el("option", n); o.value = k; return o; }));
      const prim = D.escuelas.findIndex((g) => g[3].some((e) => e[4] === "Gómez Palacio" && e[2] === "primaria")); if (prim >= 0) sel.value = prim;
    }
  }
  function pintarEscuelasLista() {
    const ul = $("lista-escuelas"); if (!ul || !G) return;
    const c = G.mapa.getCenter(), p = [c.lat, c.lng];
    const cerca = D.escuelas.map((g, k) => [k, haversine(p, [g[0], g[1]])]).sort((a, b) => a[1] - b[1]).slice(0, 10);
    ul.replaceChildren(...cerca.map(([k, d]) => { const g = D.escuelas[k], li = el("li"); li.dataset.esc = k;
      li.appendChild(el("b", nombreG(g))); li.appendChild(el("small", `${g[3][0][2]} · ${g[3][0][5]}, ${g[3][0][4]} · ${(d / 1000).toFixed(1)} km del centro del mapa · perímetro ${g[2]} m`)); return li; }));
  }
  function unidadMasCercana(p) {
    if (!G) return null; let mejor = null, dm = Infinity;
    for (const u of G.estado().unidades) { if (u.tipo === "transito" || u.estatus !== "disponible") continue; const d = haversine(p, [u.lat, u.lon]); if (d < dm) { dm = d; mejor = u; } }
    return mejor ? { u: mejor, d: dm } : null;
  }

  // ---------------- Botón de pánico silencioso (SIMULADO) ----------------
  const CLAVE_PAN = "dgi_v4_panico";
  const MSG_VECINOS = "Resguárdate, no acudas, autoridades avisadas.";
  const alertas = () => leer(CLAVE_PAN, []);
  const mutar = (id, fn) => { const A = alertas(), a = A.find((x) => x.id === id); if (a) { fn(a); escribir(CLAVE_PAN, A); } return a; };
  let cuenta = null;
  function pedirPanico(k, origen) { // 5 s para cancelar
    if (cuenta) return;
    const g = D.escuelas[k]; let s = 5;
    $("cp-escuela").textContent = `${nombreG(g)} · ${g[3][0][5]}, ${g[3][0][4]}`;
    $("cp-seg").textContent = s; $("cuenta-panico").classList.remove("oculto");
    auditar(S, "panico_presionado", `${nombreG(g)} · ${origen}`);
    cuenta = setInterval(() => {
      s -= 1; $("cp-seg").textContent = s;
      if (s <= 0) { clearInterval(cuenta); cuenta = null; $("cuenta-panico").classList.add("oculto"); activarPanico(k, origen); }
    }, 1000);
  }
  function cancelarPanico() {
    if (!cuenta) return; clearInterval(cuenta); cuenta = null; $("cuenta-panico").classList.add("oculto");
    auditar(S, "panico_cancelado", "cancelado dentro de los 5 s"); feed("escolar", "Botón de pánico CANCELADO dentro de los 5 s (simulado)");
  }
  function activarPanico(k, origen) {
    const g = D.escuelas[k], A = alertas();
    const a = { id: `PAN-SIM-${String(A.length + 1).padStart(4, "0")}`, g: k, nombre: nombreG(g), lat: g[0], lon: g[1], origen, t0: Date.now(), estado: "activa", pasos: {} };
    A.push(a); escribir(CLAVE_PAN, A);
    auditar(S, "panico_activado", `${a.id} · ${a.nombre} · ${origen}`); feed("escolar", `🚨 ${a.id} activado · ${a.nombre}`);
    if (S.rol !== "eco" && S.rol !== "delta") G.mapa.flyTo([g[0], g[1]], 15, { duration: 0.8 });
    pintarPanico(); return a;
  }
  const enCurso = new Set();
  function procesarAlertas() {
    const ahora = Date.now();
    for (const a of alertas()) {
      if (a.estado !== "activa") continue;
      if (!a.pasos.c5 && ahora - a.t0 >= 800) {
        mutar(a.id, (x) => { x.pasos.c5 = Date.now(); x.folioC5 = `C5-SIM-${String(Math.floor(Math.random() * 1e5)).padStart(5, "0")}`; });
        feed("escolar", `1) ${a.id}: aviso a 9-1-1 / C5 (simulado)`); auditar(S, "panico_c5_simulado", a.id);
      } else if (a.pasos.c5 && !a.pasos.unidad && !enCurso.has(a.id)) {
        enCurso.add(a.id);
        const i = { folio: G.folioNuevo(), tipo: "Escuelas · botón de pánico (prioridad 1)", categoria: "escolar", prioridad: "alta", lat: a.lat, lon: a.lon,
          referencia: a.nombre, direccion: `${a.nombre} (catálogo SEP)`, telefono: "botón de pánico (simulado)", aml: false, tiempo_llamada: a.t0,
          estatus: "pendiente", patrulla: null, panico: a.id, localidad: G.localidadCercana([a.lat, a.lon]) };
        G.agregar(i).then((res) => {
          const ok = res && res.ok;
          mutar(a.id, (x) => { x.pasos.unidad = Date.now(); x.folio = i.folio; x.unidad = ok ? res.u.codigo : null; x.eta = ok ? res.r.duracion : null; x.fuente = ok ? res.r.fuente : null; });
          feed("escolar", `2) ${a.id}: ${ok ? `unidad ${res.u.codigo} en camino · ETA ${minTxt(res.r.duracion)}` : "sin unidad disponible: en espera"}`);
          auditar(S, "panico_unidad", `${a.id} · ${ok ? res.u.codigo : "sin unidad"}`);
        }).catch(() => {}).finally(() => enCurso.delete(a.id));
      } else if (a.pasos.unidad && !a.pasos.vecinos && ahora - a.pasos.unidad >= 800) {
        const n = 8 + (a.g % 13);
        mutar(a.id, (x) => { x.pasos.vecinos = Date.now(); x.vecinos = n; });
        feed("escolar", `3) ${a.id}: ${n} vecinos verificados avisados: «${MSG_VECINOS}» (simulado)`); auditar(S, "panico_vecinos_simulado", `${a.id} · ${n} vecinos`);
      }
    }
  }
  function tarjetaAlerta(a) {
    const div = el("div", null, "alerta-pan " + a.estado);
    const cab = el("div", null, "cab"); cab.append(el("b", a.id), el("span", a.estado === "activa" ? "ACTIVA" : a.estado.toUpperCase(), "estatus"), el("small", hms(a.t0)));
    div.append(cab, el("div", `🏫 ${a.nombre}`));
    const ol = el("ol"), t = (x) => (x ? ` (+${((x - a.t0) / 1000).toFixed(1)} s)` : "");
    const paso = (ok, txt) => { const li = el("li", txt, ok ? "ok" : ""); ol.appendChild(li); };
    paso(true, `Activación · ${a.origen}`);
    paso(!!a.pasos.c5, `1) Aviso a 9-1-1 / C5${a.folioC5 ? ` · folio ${a.folioC5}` : ""}${t(a.pasos.c5)}`);
    paso(!!a.pasos.unidad, `2) Unidad más cercana${a.pasos.unidad ? (a.unidad ? ` · ${a.unidad} · ETA ${minTxt(a.eta)} (${a.fuente === "osrm" ? "por calles" : "línea recta"})` : " · sin unidad disponible") : ""}${t(a.pasos.unidad)}`);
    paso(!!a.pasos.vecinos, `3) Vecinos verificados${a.pasos.vecinos ? ` · ${a.vecinos} avisados` : ""}${t(a.pasos.vecinos)}`);
    div.appendChild(ol);
    if (a.pasos.vecinos) div.appendChild(el("div", `📣 «${MSG_VECINOS}»`, "msg-vecinos"));
    if (R.cerrar && a.estado === "activa") { const b = el("button", "Cerrar alerta", "boton-secundario"); b.type = "button"; b.dataset.cerrarPan = a.id; div.appendChild(b); }
    return div;
  }
  function pintarPanico() {
    const A = alertas();
    const cont = $("lista-panico");
    if (cont) cont.replaceChildren(...(A.length ? A.slice().reverse().slice(0, 6).map(tarjetaAlerta) : [el("p", "Sin alertas. Simule una activación arriba o con el botón 🚨 de una escuela en el mapa.", "chica")]));
    if (S.rol === "eco") {
      const mias = A.filter((a) => a.g === S.escuela), a = mias[mias.length - 1], v = $("eco-vecinos");
      if (a) v.replaceChildren(tarjetaAlerta(a));
    }
    if (S.rol === "delta") {
      const act = A.filter((a) => a.estado === "activa"), c = $("unidad-alertas");
      c.replaceChildren(...(act.length ? act.map((a) => el("div", `🚨 ${a.id} · ${a.nombre}${a.unidad ? ` · atiende ${a.unidad}` : ""}`)) : [el("span", "Sin alertas.")]));
    }
    const k = $("kpis"); if (k) pintarKPIs();
    if (G) for (const [kk, m] of marcEsc) { const on = A.some((a) => a.g === kk && a.estado === "activa"); const e = m.getElement(); if (e && e.firstChild) e.firstChild.classList.toggle("alerta", on); const c = circEsc.get(kk); if (c && c._on !== on) { c.setStyle(on ? { color: "#d62828", fillColor: "#d62828", fillOpacity: 0.25, weight: 2 } : { color: "#13315c", fillColor: "#13315c", fillOpacity: 0.06, weight: 1 }); c._on = on; } }
  }

  // ---------------- Feed, tiempos de reacción y KPIs ----------------
  const CLAVE_FEED = "dgi_v4_feed", CLAVE_TIEMPOS = "dgi_v4_tiempos";
  const CAT = { escolar: "Escuelas", violencia_familiar: "V. familiar", transito: "Tránsito", robo: "Robo", lesiones: "Lesiones", amenazas: "Amenazas", otros: "Otros", sistema: "Sistema" };
  let FEED = [], TIEMPOS = [];
  function feed(cat, txt) { FEED.unshift({ t: Date.now(), cat, txt }); FEED = FEED.slice(0, 60); escribir(CLAVE_FEED, FEED); pintarFeed(); }
  function pintarFeed() {
    const ul = $("feed"); if (!ul) return;
    if (!FEED.length) { ul.replaceChildren(el("li", "Esperando eventos…", "vacio")); return; }
    ul.replaceChildren(...FEED.slice(0, 40).map((f) => { const li = el("li"); li.append(el("time", hms(f.t)), el("span", CAT[f.cat] || "Otros", "tag " + f.cat), el("span", f.txt)); return li; }));
  }
  const visto = new Map();
  function observar() {
    const E = G.estado(), presentes = new Set();
    for (const i of E.incidentes) {
      if (!POLITICA.verIncidente(i)) continue;
      presentes.add(i.folio);
      const prev = visto.get(i.folio), cat = i.categoria || "otros", prot = POLITICA.protegido(i);
      const tipo = prot ? "Violencia familiar · caso reservado" : i.tipo, ref = prot ? "zona aproximada" : i.referencia;
      if (!prev) feed(cat, `Nuevo ${i.folio} · ${tipo} · ${ref}`);
      else if (prev !== i.estatus) {
        if (i.estatus === "asignado") feed(cat, `${i.patrulla} asignada → ${i.folio}`);
        if (i.estatus === "en_sitio") {
          feed(cat, `${i.patrulla} en sitio · ${i.folio}`);
          if (i.tiempo_asignacion && i.tiempo_llegada && !TIEMPOS.some((x) => x.folio === i.folio)) {
            const espera = i.folio.startsWith("GP-DEMO") ? 0 : Math.max(0, i.tiempo_asignacion - i.tiempo_llamada) / 60000;
            const traslado = ((i.tiempo_llegada - i.tiempo_asignacion) * FACTOR) / 60000;
            TIEMPOS.push({ folio: i.folio, cat, min: +(espera + traslado).toFixed(1) }); TIEMPOS = TIEMPOS.slice(-30); escribir(CLAVE_TIEMPOS, TIEMPOS);
          }
        }
      }
      visto.set(i.folio, i.estatus);
    }
    for (const [f, st] of visto) if (!presentes.has(f)) { visto.delete(f); if (st === "en_sitio") feed("otros", `Cerrado ${f}`); }
  }
  function tiemposIniciales() { const c = ["robo", "transito", "violencia_familiar", "lesiones", "escolar", "amenazas", "transito", "robo", "otros", "lesiones"], m = [6.2, 4.8, 8.9, 5.5, 3.9, 7.4, 5.1, 9.8, 6.6, 4.4];
    return c.map((x, k) => ({ folio: `HIST-SIM-${k + 1}`, cat: x, min: m[k], hist: true })); }
  const mediana = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
  const COLOR = { escolar: "#d62828", violencia_familiar: "#6a1b9a", transito: "#f77f00", robo: "#13315c", lesiones: "#e76f51", amenazas: "#2a9d8f", otros: "#8090a8" };
  function grafica() {
    const cont = $("graf-tiempos"); if (!cont) return;
    const d = TIEMPOS.slice(-16), v = d.map((x) => x.min), mx = Math.max(12, ...v) * 1.1, W = 560, H = 150, pad = 24;
    const bw = (W - pad - 6) / Math.max(d.length, 1), y = (m) => H - 16 - ((H - 28) * m) / mx, med = mediana(v);
    const barras = d.map((x, k) => `<rect x="${(pad + k * bw + 2).toFixed(1)}" y="${y(x.min).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${(H - 16 - y(x.min)).toFixed(1)}" rx="2" fill="${COLOR[x.cat] || COLOR.otros}" opacity="${x.hist ? 0.45 : 0.95}"></rect>`).join("");
    const ejes = [0, 5, 10, 15, 20].filter((m) => m < mx).map((m) => `<text x="2" y="${y(m) + 3}" fill="#6b7890" font-size="9">${m}</text><line x1="${pad}" x2="${W - 4}" y1="${y(m)}" y2="${y(m)}" stroke="#e4e9f1"/>`).join("");
    const lm = med == null ? "" : `<line x1="${pad}" x2="${W - 4}" y1="${y(med)}" y2="${y(med)}" stroke="#2a9d8f" stroke-dasharray="5 4"/><text x="${W - 6}" y="${y(med) - 3}" fill="#2a9d8f" font-size="10" text-anchor="end">Mediana ${med.toFixed(1)} min</text>`;
    cont.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Tiempos de reacción simulados">${ejes}${barras}${lm}</svg>`;
    const pie = el("div", null, "graf-pie"); pie.append(el("span", `n=${v.length} · minutos simulados (×${FACTOR})`), el("span", "barras tenues = históricos simulados"), el("span", "rojo = escuelas · morado = v. familiar · naranja = tránsito"));
    cont.appendChild(pie);
  }
  function tarjeta(num, lbl, cls, sub) { const d = el("div", null, "tarjeta " + (cls || "")); d.append(el("span", String(num), "num"), el("span", lbl, "lbl")); if (sub) d.appendChild(el("span", sub, "sub")); return d; }
  function pintarKPIs() {
    const k = $("kpis"); if (!k || !G) return;
    const E = G.estado(), inc = E.incidentes, us = E.unidades, cu = (c) => inc.filter((i) => i.categoria === c).length;
    const act = alertas().filter((a) => a.estado === "activa").length, med = mediana(TIEMPOS.map((x) => x.min));
    k.replaceChildren(
      tarjeta(us.length, "🚔 Unidades en servicio", "", `${us.filter((u) => u.tipo === "transito").length} de Tránsito`),
      tarjeta(us.filter((u) => u.estatus === "disponible").length, "En rondín", "verde"),
      tarjeta(inc.length, "🚨 Incidentes activos", "alerta", `${inc.filter((i) => i.estatus === "pendiente").length} en espera`),
      tarjeta(act, "🏫 Alertas escolares", act ? "alerta" : ""),
      tarjeta(cu("violencia_familiar"), "🛡️ V. familiar (anónimo)"),
      tarjeta(cu("transito"), "🚧 Tránsito", "naranja"),
      tarjeta(med == null ? "—" : med.toFixed(1), "⏱ Reacción (mediana, min)"),
      tarjeta(D.escuelas_meta.registros.toLocaleString("es-MX"), "🏫 Escuelas SEP", "", `${D.escuelas_meta.inmuebles} inmuebles`),
      tarjeta(leer(CLAVE_CONEX, {}).bloqueada ? "BLOQ." : "OFF", "🔒 Conexión real", "alerta", "simulación"));
  }

  // ---------------- Violencia familiar (modo discreto) ----------------
  function pintarVF() {
    const c = $("vf-contenido"); if (!c || !R.tabs.includes("vf")) return;
    const casos = G.estado().incidentes.filter((i) => i.categoria === "violencia_familiar");
    if (S.rol === "charlie") {
      const ul = el("ul", null, "lista-v4");
      for (const i of casos) { const li = el("li"); li.append(el("b", `${i.folio} · ${i.estatus} · ${i.patrulla || "sin unidad"}`), el("small", `${i.direccion || i.referencia} · tel. ${i.telefono} · ${i.localidad || ""} (simulado)`)); ul.appendChild(li); }
      c.replaceChildren(el("h3", `Casos activos: ${casos.length} (detalle visible solo para Charlie)`), casos.length ? ul : el("p", "Sin casos activos.", "chica"), el("p", "Sin aviso a vecinos. Unidades: acercamiento sin sirena; no compartir el domicilio por radio abierto (simulado).", "chica"));
    } else {
      const b = el("div", null, "tarjetas");
      b.append(tarjeta(casos.length, "Casos activos"), tarjeta(casos.filter((i) => i.estatus === "pendiente").length, "En espera"), tarjeta(casos.filter((i) => i.estatus !== "pendiente").length, "Con unidad"));
      c.replaceChildren(b, el("p", "Vista ANÓNIMA: sin folios, domicilios, teléfonos ni rutas. El detalle solo lo ve Charlie.", "chica"),
        el("p", "Referencia oficial: en 2025 Gómez Palacio registró 1,048 carpetas por violencia familiar (SESNSP), el delito más frecuente del municipio.", "chica"));
    }
  }

  // ---------------- Delta: mi unidad ----------------
  function pintarUnidad() {
    const c = $("mi-unidad"); if (!c || S.rol !== "delta") return;
    const u = G.estado().unidades.find((x) => x.codigo === S.unidad); if (!u) { c.replaceChildren(el("p", "Unidad no encontrada.")); return; }
    const i = G.estado().incidentes.find((x) => x.patrulla === u.codigo);
    const b = el("section", null, "bloque"); const [tn, th] = G.turno();
    b.append(el("h2", `${u.codigo} · ${{ disponible: "Disponible", asignada: "En camino", en_sitio: "En sitio" }[u.estatus] || u.estatus}`),
      el("p", `Oficial ${G.clave(u.codigo, tn)} (clave ficticia) · Turno ${tn} ${th} · Sector ${u.sector}`, "chica"));
    if (i) b.append(el("p", `Asignación ${i.folio}: ${POLITICA.protegido(i) ? "Violencia familiar · caso reservado (domicilio por canal seguro)" : i.tipo}`),
      el("p", `${POLITICA.protegido(i) ? "Zona aproximada" : i.direccion || i.referencia}${i.eta_s ? ` · ETA ${minTxt(i.eta_s)}` : ""}`, "chica"));
    else b.appendChild(el("p", "Sin asignación activa (simulado).", "chica"));
    c.replaceChildren(b);
  }

  // ---------------- Registrar incidente con categoría ----------------
  const TIPOS_FORM = { escolar: "Escuelas · incidente en plantel (prioridad 1)", violencia_familiar: "Violencia familiar", transito: "Tránsito · accidente vial", robo: "Robo a transeúnte",
    robo_negocio: "Robo a negocio", lesiones: "Riña / lesiones dolosas", amenazas: "Amenazas", narcomenudeo: "Narcomenudeo (reporte ciudadano)", danio: "Daño a la propiedad" };
  function registrarIncidente(cat) {
    let lat, lon, ref;
    if (cat === "escolar") { const gp = D.escuelas.filter((g) => g[3][0][4] === "Gómez Palacio"), g = gp[Math.floor(Math.random() * gp.length)]; [lat, lon, ref] = [g[0], g[1], nombreG(g)]; }
    else { const z = D.zonas[Math.floor(Math.random() * 16)]; [lat, lon] = G.desplazar(z.lat, z.lon, 120 + Math.random() * 400, Math.random() * 360); ref = z.nombre; }
    const tipo = TIPOS_FORM[cat], vf = cat === "violencia_familiar";
    G.agregar({ folio: G.folioNuevo(), tipo: tipo + " (simulado)", categoria: G.categoriaDe(tipo) === "otros" && cat === "escolar" ? "escolar" : G.categoriaDe(tipo), sensible: vf,
      prioridad: cat === "escolar" || vf || cat === "transito" ? "alta" : "media", lat, lon, referencia: ref,
      direccion: vf ? `Domicilio simulado · zona ${ref}` : `${ref} (simulado)`, telefono: "871-SIM-" + String(Math.floor(Math.random() * 1e4)).padStart(4, "0"),
      aml: true, tiempo_llamada: Date.now(), estatus: "pendiente", patrulla: null, localidad: G.localidadCercana([lat, lon]) });
    auditar(S, "incidente_registrado", vf ? "violencia familiar (detalle reservado)" : tipo);
  }

  // ---------------- Compuerta «Conexión real» (bloqueada; no configurada en la demo) ----------------
  const CLAVE_CONEX = "dgi_v4_conexion", MAX_CONEX = 3;
  function pintarConexion() {
    const st = leer(CLAVE_CONEX, { fallos: 0 }), b = $("btn-conexion");
    b.classList.toggle("bloqueada", !!st.bloqueada); b.title = st.bloqueada ? "Conexión real: BLOQUEADA tras 3 intentos fallidos" : "Conexión real: apagada (no configurada en esta demo)";
    $("mc-titulo").textContent = st.bloqueada ? "🔒 Conexión real · BLOQUEADA" : "🔒 Conexión real · apagada";
    $("mc-intentos").textContent = st.bloqueada ? "Bloqueada en este navegador tras 3 intentos fallidos." : `Intentos fallidos: ${st.fallos || 0} de ${MAX_CONEX}.`;
    $("mc-enviar").disabled = !!st.bloqueada;
  }
  async function borrarDatosDelSitio() {
    try { localStorage.clear(); } catch (e) { /* nada */ }
    try { sessionStorage.clear(); } catch (e) { /* nada */ }
    try { if (indexedDB.databases) for (const db of await indexedDB.databases()) if (db.name) indexedDB.deleteDatabase(db.name); } catch (e) { /* nada */ }
    try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (e) { /* nada */ }
  }
  async function intentarConexion(ev) {
    ev.preventDefault();
    const st = leer(CLAVE_CONEX, { fallos: 0 }); if (st.bloqueada) return;
    const btn = $("mc-enviar"), msg = $("mc-msg"); btn.disabled = true; msg.className = "msg-acceso"; msg.textContent = "Verificando…";
    let alfaOk = false; try { alfaOk = await window.DGI_verificarAlfa($("mc-alfa").value); } catch (e) { alfaOk = false; }
    $("mc-alfa").value = "";
    st.fallos = (st.fallos || 0) + 1;
    const motivo = alfaOk ? "credencial de Alfa válida; falta confirmación del Director de Seguridad Pública (no configurada: servidor pendiente)" : "credencial de Alfa incorrecta";
    if (st.fallos >= MAX_CONEX) {
      await auditar(S, "conexion_real_intento_fallido", `${st.fallos}/${MAX_CONEX} · ${motivo}`);
      await borrarDatosDelSitio();
      escribir(CLAVE_CONEX, { fallos: st.fallos, bloqueada: true, t: Date.now() });
      await auditar({ usuario: S.usuario, rol: S.rol }, "conexion_real_bloqueo", `3 intentos fallidos: compuerta bloqueada y datos de sesión del sitio borrados en este navegador`);
      try { localStorage.setItem("dgi_v4_aviso_bloqueo", "Conexión real BLOQUEADA tras 3 intentos fallidos. Se borraron los datos de sesión de este sitio en este navegador y se registró en la bitácora."); } catch (e) { /* nada */ }
      location.reload(); return;
    }
    escribir(CLAVE_CONEX, st);
    await auditar(S, "conexion_real_intento_fallido", `${st.fallos}/${MAX_CONEX} · ${motivo}`);
    msg.className = "msg-acceso error";
    msg.textContent = alfaOk ? "Credencial de Alfa válida, pero la confirmación del Director(a) de Seguridad Pública no está configurada en esta demo (servidor pendiente). La conexión real sigue apagada."
      : "Credencial de Alfa incorrecta. La conexión real sigue apagada.";
    pintarConexion(); btn.disabled = !!leer(CLAVE_CONEX, {}).bloqueada;
  }

  // ---------------- Inicio ----------------
  function mostrarTab(id) {
    document.querySelectorAll(".pestanas button").forEach((b) => b.classList.toggle("activo", b.dataset.tab === id));
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("oculto", t.id !== id));
  }
  function iniciar(sesion, datos) {
    S = sesion; R = ROLES[S.rol]; D = datos;
    document.body.classList.add("rol-" + S.rol);
    $("chip-rol").textContent = `${R.etq} · ${R.desc}`; $("chip-rol").title = S.nombre;
    if (S.rol === "eco" || S.rol === "delta" || S.rol === "charlie") { $("btn-simular").hidden = true; }
    if (S.rol === "eco") $("auto-llamadas").checked = false;
    window.DGI_POLITICA = POLITICA;
    window.DGI_iniciar(datos);
    G = window.__dgi;
    document.querySelectorAll(".pestanas button[data-tab]").forEach((b) => { b.hidden = !R.tabs.includes(b.dataset.tab.replace("tab-", "")); });
    mostrarTab("tab-" + R.tabs[0]);
    FEED = leer(CLAVE_FEED, []); TIEMPOS = leer(CLAVE_TIEMPOS, null) || tiemposIniciales(); escribir(CLAVE_TIEMPOS, TIEMPOS);
    for (const i of G.estado().incidentes) visto.set(i.folio, i.estatus);
    feed("sistema", `Sesión ${R.etq} iniciada`);
    construirEscuelas();
    if (S.rol === "eco") {
      const g = D.escuelas[S.escuela];
      $("eco-escuela").textContent = `🏫 ${nombreG(g)}`;
      $("eco-sub").textContent = `${g[3].length} escuela(s) en el inmueble (${[...new Set(g[3].map((e) => e[2]))].join(", ")}) · ${g[3][0][7]}, ${g[3][0][5]} · perímetro ${g[2]} m (catálogo SEP)`;
      setTimeout(() => G.mapa.setView([g[0], g[1]], 15, { animate: false }), 1200);
      $("eco-panico").addEventListener("click", () => pedirPanico(S.escuela, "Eco · escuela"));
    }
    if (S.rol === "delta") { const u = G.estado().unidades.find((x) => x.codigo === S.unidad); if (u) setTimeout(() => G.mapa.setView([u.lat, u.lon], 13, { animate: false }), 1200); }

    $("cp-cancelar").addEventListener("click", cancelarPanico);
    $("form-panico").addEventListener("submit", (ev) => { ev.preventDefault(); if (R.simular) pedirPanico(+$("pan-escuela").value, `simulación (${R.etq})`); });
    $("form-incidente").addEventListener("submit", (ev) => { ev.preventDefault(); if (R.simular) registrarIncidente($("inc-cat").value); });
    $("btn-conexion").addEventListener("click", () => { pintarConexion(); $("mc-msg").textContent = ""; $("modal-conexion").classList.remove("oculto"); auditar(S, "conexion_real_consulta", "se abrió la compuerta (bloqueada)"); });
    $("mc-cancelar").addEventListener("click", () => $("modal-conexion").classList.add("oculto"));
    $("form-conexion").addEventListener("submit", intentarConexion);
    document.addEventListener("click", (ev) => {
      const pe = ev.target.closest(".btn-panico-esc"); if (pe && R.simular) { G.mapa.closePopup(); pedirPanico(+pe.dataset.esc, `simulación (${R.etq})`); return; }
      const cp = ev.target.closest("[data-cerrar-pan]");
      if (cp && R.cerrar) { const a = mutar(cp.dataset.cerrarPan, (x) => { x.estado = "cerrada"; x.fin = Date.now(); }); if (a) auditar(S, "panico_cerrado", a.id); pintarPanico(); return; }
      const lb = ev.target.closest("[data-lic][data-acc]"); if (lb && S.rol === "alfa") { accionLicencia(lb.dataset.lic, lb.dataset.acc); return; }
      const li = ev.target.closest("#lista-escuelas li[data-esc]");
      if (li) { const m = marcEsc.get(+li.dataset.esc); if (m) { if (esMovil()) $("panel").classList.remove("abierto"); cluster.zoomToShowLayer(m, () => m.openPopup()); } }
    });
    window.addEventListener("storage", (ev) => { if (ev.key === CLAVE_PAN) pintarPanico(); if (ev.key === CLAVE_AUD) pintarAuditoria(); });
    const tick = () => {
      try {
        observar(); procesarAlertas(); pintarPanico(); pintarUnidad(); pintarVF();
        if (!tick.n || tick.n % 3 === 0) { grafica(); pintarEscuelasLista(); }
        tick.n = (tick.n || 0) + 1;
      } catch (e) { console.warn(e); }
    };
    tick(); setInterval(tick, 1000);
    pintarFeed(); pintarLicencias(); pintarAuditoria(); pintarConexion();
    window.__cm = { alertas, auditoria: () => leer(CLAVE_AUD, []), sesion: () => S, pedirPanico, cancelarPanico, escuelas: () => ({ marcadores: marcEsc.size, perimetros: circEsc.size, registros: D.escuelas_meta.registros }), cluster: () => cluster };
  }

  window.DGI_CM = { iniciar, auditar, licencias };
})();
