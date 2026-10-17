/* Durango GeoInteligencia v4 — MÓDULO DE INTEGRACIÓN (Director(a) de Seguridad Pública).
   1) Conexión con el C4/API y CCTV que el Director autoriza: «Probar conexión», modo demostración ↔ modo operativo, sondeo periódico.
      En modo operativo NO hay simulación: si los endpoints no entregan datos se muestra «Esperando datos del C4». Nunca se inventan incidentes.
   2) Auto-escaneo SOLO de las redes / hosts que el Director lista y autoriza (en el navegador: solo hosts/URL; rangos IP y puertos
      ONVIF requieren el servidor de integración en la red municipal). Cada dispositivo se aprueba uno por uno.
   3) Credenciales emitidas y FIRMADAS por el Director (Ed25519; ES256 si el navegador no tiene Ed25519) con QR de verificación.
   4) Traspaso de mando: Alfa queda como «última instancia» y solo el Director puede reactivarlo.
   5) Recorrido demo del Director: arenero aparte (claves dgi_v4_rec_*) que se borra al terminar; sin datos delictivos inventados.
   Secretos (llave API, llave de firma) se guardan CIFRADOS (AES-256-GCM) en este navegador; nunca en el repositorio.
   LÍMITE HONESTO: en GitHub Pages todo vive en el navegador (nivel demostración). Producción: servidor propio en la red municipal
   (servidor/integracion/), que guarda la configuración cifrada, escanea la red y aplica los permisos del lado del servidor. */
(function () {
  "use strict";
  const F = window.DGI_FIRMA, TZ = "America/Mexico_City";
  const $ = (id) => document.getElementById(id);
  const el = (tag, txt, cls) => { const n = document.createElement(tag); if (txt != null) n.textContent = txt; if (cls) n.className = cls; return n; };
  const hms = (t) => new Date(t).toLocaleTimeString("es-MX", { timeZone: TZ, hour12: false });
  const fechaHora = (t) => new Date(t).toLocaleString("es-MX", { timeZone: TZ, hour12: false, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const fechaCorta = (t) => new Date(t).toLocaleDateString("es-MX", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
  const REC = () => { try { return sessionStorage.getItem("dgi_v4_recorrido") === "1"; } catch (e) { return false; } };
  const K = (k) => (REC() ? "dgi_v4_rec_" : "dgi_v4_") + k;
  const leerK = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } };
  const escribirK = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin espacio */ } };
  const leer = (k, d) => leerK(K(k), d), escribir = (k, v) => escribirK(K(k), v);
  const FRASE_OPERATIVO = "ACTIVAR MODO OPERATIVO";
  const FRASE_TRASPASO = "TRANSFIERO EL MANDO A SEGURIDAD PÚBLICA";
  const FRASE_REACTIVAR = "REACTIVO A ALFA COMO ÚLTIMA INSTANCIA";
  const norm = (s) => String(s || "").normalize("NFC").trim().replace(/\s+/g, " ").toUpperCase();
  const ROLES_CRED = { charlie: "Charlie · Autoridades", bravo: "Bravo · Supervisión", delta: "Delta · Unidad de campo", eco: "Eco · Escuela / vecinos" };
  const RUTAS_SALUD = ["", "/salud", "/salud.json", "/health", "/api/health", "/status", "/api/status"];

  let S = null, R = null, D = null, G = null, DEK = null, LLA = null, FIRMA = null;
  const estadoC4 = { salud: null, incidentes: null, unidades: null, camaras: null, ultima: null, espera: true };
  let temporizador = null, capas = null;

  const cfg = () => leer("int_cfg", { base: "", ep: { salud: "", incidentes: "", unidades: "", camaras: "" }, encabezado: "X-API-Key", intervalo: 15, servidor: "", usarServidor: false, camaras: [], redes: [] });
  const modo = () => leer("int_modo", { modo: "demo" });
  const cuentas = () => leer("cuentas", []);
  const director = () => cuentas().find((c) => c.rol === "director" && c.estado === "activa") || null;
  const credenciales = () => leer("credenciales", []);
  const dispositivos = () => leer("dispositivos", []);
  const mandoDe = (k) => leerK(k, null) || { estado: "inicial", alfa: "activo", propietario: "alfa" };
  const mando = () => mandoDe(K("mando"));
  const esDirector = () => !!S && (S.rol === "director" || (REC() && S.rol === "alfa"));
  const alfaRestringido = () => !REC() && mando().estado === "transferido";
  const puedeConfigurar = () => !!S && (esDirector() || (S.rol === "alfa" && !alfaRestringido()));
  const actor = () => (REC() ? { usuario: `${S.usuario}→director-demo`, rol: S.rol } : S);
  const auditar = (accion, detalle) => window.DGI_CM.auditar(actor(), accion, (REC() ? "[recorrido demo] " : "") + (detalle || ""));
  const sesionGuardada = () => { try { return JSON.parse(sessionStorage.getItem("dgi_v4_sesion") || "null"); } catch (e) { return null; } };

  window.DGI_MODO = { operativo: () => modo().modo === "operativo" };

  function cuentaLocal(u) {
    const c = leerK("dgi_v4_cuentas", []).find((x) => x.usuario === u);
    return c ? { ...c, local: true } : null;
  }
  const canonMando = (m) => JSON.stringify([m.estado, m.alfa, m.propietario, m.t, m.v || 1, m.por || ""]);
  async function alfaBloqueado() {
    const dirs = leerK("dgi_v4_cuentas", []).filter((c) => c.rol === "director");
    const m = leerK("dgi_v4_mando", null);
    if (!m) return dirs.some((d) => d.mandoTransferido);
    if (m.estado !== "transferido") return false;
    const d = dirs.find((x) => x.usuario === m.propietario);
    if (!d || !m.firma || !(await F.verificarTexto(canonMando(m), m.firma, d.firma.pub, d.firma.alg))) return true;
    return m.alfa !== "reactivado_por_director";
  }
  async function puedeEntrar(u, reg) {
    if (u === "alfa" && (await alfaBloqueado())) return "La cuenta Alfa está en resguardo como «última instancia» tras el traspaso de mando a Seguridad Pública. Solo el Director(a) puede reactivarla.";
    if (reg && reg.local) {
      if (reg.estado !== "activa") return "Esta cuenta fue revocada por el Director(a) de Seguridad Pública.";
      if (reg.vence && Date.parse(reg.vence) < Date.now()) return `Esta cuenta venció el ${fechaCorta(Date.parse(reg.vence))}.`;
      if (reg.credencial) { const c = leerK("dgi_v4_credenciales", []).find((x) => x.id === reg.credencial); if (c && c.estado !== "vigente") return "La credencial de esta cuenta fue revocada por el Director(a)."; }
    }
    return null;
  }
  async function alEntrar(sesion, kek, dek) {
    DEK = dek; LLA = null; FIRMA = null;
    const envs = leerK("dgi_v4_lla", {});
    try {
      if (sesion.rol === "alfa") {
        if (envs.alfa) LLA = await F.abrir(kek, envs.alfa, "lla:alfa");
        else if (!Object.keys(envs).length && mandoDe("dgi_v4_mando").estado !== "transferido") {
          LLA = F.aleatorio(32); envs.alfa = await F.sellar(kek, LLA, "lla:alfa"); escribirK("dgi_v4_lla", envs);
        }
      } else if (sesion.rol === "director") {
        const d = cuentaLocal(sesion.usuario);
        if (d && d.lla) LLA = await F.abrir(kek, d.lla, "lla:" + d.usuario);
        if (d && d.firma) FIRMA = { privada: await F.importarPrivada(d.firma.alg, await F.abrir(kek, d.firma.priv, "firma:" + d.usuario)), alg: d.firma.alg, pub: d.firma.pub, kid: d.firma.kid, de: d.usuario };
      }
    } catch (e) { console.warn("llaves de administración", e); }
    return { lla: LLA ? F.aB64(LLA) : null };
  }

  async function fetchT(url, opts, ms) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 6000);
    try { return await fetch(url, { cache: "no-store", credentials: "omit", redirect: "follow", ...opts, signal: c.signal }); } finally { clearTimeout(t); }
  }
  function normalizarUrl(s) {
    s = String(s || "").trim(); if (!s) return "";
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
    const u = new URL(s); if (!/^https?:$/.test(u.protocol)) throw new Error("Solo se aceptan direcciones http:// o https://");
    return u.href.replace(/\/$/, u.pathname === "/" && !s.endsWith("/") ? "" : "/");
  }
  const unir = (base, ruta) => (base ? base.replace(/\/+$/, "") + ruta : "");
  async function llaveApi() {
    const s = leer("int_apikey", null); if (!s || !LLA) return null;
    try { return new TextDecoder().decode(await F.abrir(LLA, s, "api")); } catch (e) { return null; }
  }
  const tokenSrv = () => { try { return sessionStorage.getItem(K("srv_token")); } catch (e) { return null; } };
  async function srv(ruta, opts) {
    const base = (cfg().servidor || "").replace(/\/+$/, ""); if (!base) throw new Error("No hay servidor de integración configurado.");
    const h = { Accept: "application/json" }; const tk = tokenSrv(); if (tk) h.Authorization = "Bearer " + tk;
    if (opts && opts.body) h["Content-Type"] = "application/json";
    const r = await fetchT(base + ruta, { method: (opts && opts.method) || "GET", headers: h, body: opts && opts.body ? JSON.stringify(opts.body) : undefined }, (opts && opts.ms) || 10000);
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error((j && (j.detail || j.error)) || `HTTP ${r.status}`);
    return j;
  }
  const srvConectado = () => !!(cfg().servidor && tokenSrv());

  async function probarNavegador(url, conLlave) {
    const t0 = performance.now(), r = { url, via: "navegador" };
    if (location.protocol === "https:" && url.startsWith("http:"))
      return { ...r, ok: false, tipo: "contenido_mixto", msg: "Bloqueado por el navegador: esta página es HTTPS y la dirección es HTTP (contenido mixto). Use HTTPS en el C4 o pruebe desde el servidor de integración." };
    const h = { Accept: "application/json" };
    if (conLlave) { const k = await llaveApi(); if (k) h[cfg().encabezado || "X-API-Key"] = k; }
    try {
      const res = await fetchT(url, { mode: "cors", headers: h }, 6000);
      const ms = Math.round(performance.now() - t0), tipo = res.headers.get("content-type") || "";
      let muestra = ""; try { const tx = await res.text(); muestra = tx.slice(0, 160); } catch (e) { /* nada */ }
      return { ...r, ok: res.ok, status: res.status, ms, tipo: res.ok ? "ok" : "http", ctype: tipo, muestra,
        msg: res.ok ? `Respondió HTTP ${res.status} en ${ms} ms (${tipo || "sin tipo"}).` : `El servidor respondió HTTP ${res.status} (${res.statusText || "error"}). Revise la ruta o la llave API.` };
    } catch (e) {
      if (e.name === "AbortError") return { ...r, ok: false, tipo: "tiempo", msg: "Sin respuesta en 6 s (tiempo agotado). Puede ser una red privada no visible desde este equipo, un firewall o una dirección incorrecta." };
      try {
        await fetchT(url, { mode: "no-cors" }, 6000);
        return { ...r, ok: false, tipo: "cors", msg: `El equipo respondió, pero no permite que esta página lea los datos (CORS). Pida que se habilite CORS para ${location.origin} o use el servidor de integración como intermediario.` };
      } catch (e2) {
        return { ...r, ok: false, tipo: "red", msg: "No se pudo conectar desde el navegador: red privada municipal no accesible desde aquí, bloqueo de «acceso a red privada» del navegador, firewall, DNS o certificado TLS no válido. Pruebe desde el servidor de integración instalado en la red municipal." };
      }
    }
  }

  function aplicarClases() {
    const op = window.DGI_MODO.operativo();
    document.body.classList.toggle("modo-operativo", op);
    document.body.classList.toggle("modo-demo", !op);
    document.body.classList.toggle("recorrido", REC());
    const b = $("banner-modo");
    if (b) {
      if (op) b.textContent = `📡 Modo operativo — datos del C4 configurado y autorizado por el Director(a)${modo().por ? ` (${modo().por})` : ""}${REC() ? " · RECORRIDO DE DEMOSTRACIÓN con endpoint de prueba" : ""}`;
      else b.textContent = "Modo demostración — listo para integración con C4/API/CCTV autorizados por el Director";
    }
  }

  async function altaDirector(ev) {
    ev.preventDefault();
    const msg = $("dir-msg"); const di = (t, e) => { msg.textContent = t; msg.className = "msg-acceso" + (e ? " error" : " ok"); };
    if (REC() || S.rol !== "alfa" || director()) return di("No disponible.", true);
    const nombre = $("dir-nombre").value.trim(), cargo = $("dir-cargo").value.trim() || "Director(a) de Seguridad Pública", u = $("dir-usuario").value.trim().toLowerCase();
    const p1 = $("dir-pw").value.trim(), p2 = $("dir-pw2").value.trim();
    if (nombre.length < 5) return di("Escriba el nombre completo del Director(a).", true);
    if (!/^[a-z0-9._-]{3,32}$/.test(u) || Object.prototype.hasOwnProperty.call(window.PAQUETE.usuarios, u) || cuentaLocal(u)) return di("Usuario no válido o ya existe (3–32: letras minúsculas, números, punto, guion).", true);
    if (p1.length < 12) return di("La contraseña del Director(a) debe tener al menos 12 caracteres (la escribe él/ella).", true);
    if (p1 !== p2) return di("Las contraseñas no coinciden.", true);
    if (!DEK || !LLA) return di("Vuelva a entrar como Alfa con su contraseña para dar de alta al Director(a) (falta la llave de administración en esta sesión).", true);
    di("Generando llaves (puede tardar unos segundos)…");
    const sal = F.aB64(F.aleatorio(16)), { kek, verificador } = await window.DGI_derivar(u, p1, sal);
    const ll = await F.generarLlaves();
    const cta = { usuario: u, nombre, cargo, rol: "director", org: "SSP-GP", sal, verificador, estado: "activa", creado: Date.now(), creadoPor: "alfa",
      llave: await F.sellar(kek, DEK, u), lla: await F.sellar(kek, LLA, "lla:" + u),
      firma: { alg: ll.alg, pub: F.aB64(ll.pub), kid: ll.kid, priv: await F.sellar(kek, ll.pkcs8, "firma:" + u) } };
    const L = cuentas(); L.push(cta); escribir("cuentas", L);
    const envs = leerK("dgi_v4_lla", {}); envs[u] = cta.lla; escribirK("dgi_v4_lla", envs);
    ["dir-pw", "dir-pw2"].forEach((id) => { $(id).value = ""; });
    auditar("director_alta", `${nombre} (${u}) · llave de firma ${ll.alg} ${ll.kid}`);
    if (srvConectado()) srv("/api/llaves-director", { method: "POST", body: { usuario: u, nombre, cargo, alg: ll.alg, pub: cta.firma.pub } }).catch((e) => console.warn(e));
    di(`Director(a) registrado(a). Puede entrar con el usuario «${u}». Huella de su llave de firma: ${ll.kid}.`);
    pintarTodo();
  }
  async function confirmarDirector(pw) {
    if (REC()) return { ok: true, dir: dirDemo() };
    const d = director(); if (!d) return { ok: false, msg: "Primero dé de alta al Director(a) de Seguridad Pública (sección «Director(a)»)." };
    const { kek, verificador } = await window.DGI_derivar(d.usuario, String(pw || "").trim(), d.sal);
    if (verificador !== d.verificador) return { ok: false, msg: "Contraseña del Director(a) incorrecta." };
    return { ok: true, dir: d, kek };
  }
  async function firmaDesde(c) {
    if (FIRMA && FIRMA.de === c.dir.usuario) return FIRMA;
    if (c.kek) { const d = c.dir; return { privada: await F.importarPrivada(d.firma.alg, await F.abrir(c.kek, d.firma.priv, "firma:" + d.usuario)), alg: d.firma.alg, pub: d.firma.pub, kid: d.firma.kid, de: d.usuario }; }
    return null;
  }
  function dirDemo() { return cuentas().find((c) => c.rol === "director") || null; }
  async function prepararRecorrido() {
    let d = dirDemo(); const ll = await F.generarLlaves();
    if (!d) d = { usuario: "director-demo", nombre: "Director(a) de Seguridad Pública (DEMO)", cargo: "Recorrido de demostración · sin validez oficial", rol: "director", estado: "activa", creado: Date.now(), claves: [] };
    d.firma = { alg: ll.alg, pub: F.aB64(ll.pub), kid: ll.kid }; d.claves = [...(d.claves || []), { alg: ll.alg, pub: d.firma.pub, kid: ll.kid }].slice(-20);
    escribir("cuentas", [d]);
    FIRMA = { privada: await F.importarPrivada(ll.alg, ll.pkcs8), alg: ll.alg, pub: d.firma.pub, kid: ll.kid, de: d.usuario };
  }

  function llenarForm() {
    const c = cfg();
    $("int-base").value = c.base || ""; for (const k of ["salud", "incidentes", "unidades", "camaras"]) $("int-ep-" + k).value = (c.ep && c.ep[k]) || "";
    $("int-encabezado").value = c.encabezado || "X-API-Key"; $("int-intervalo").value = c.intervalo || 15;
    $("int-servidor").value = c.servidor || ""; $("int-usar-srv").checked = !!c.usarServidor;
    $("int-apikey").value = ""; $("int-apikey").placeholder = leer("int_apikey", null) ? "•••••• guardada cifrada (escriba para reemplazar)" : "opcional";
  }
  function leerForm() {
    const c = cfg();
    c.base = $("int-base").value.trim() ? normalizarUrl($("int-base").value) : "";
    c.ep = {}; for (const k of ["salud", "incidentes", "unidades", "camaras"]) { const v = $("int-ep-" + k).value.trim(); c.ep[k] = v ? normalizarUrl(v) : ""; }
    if (c.base) { if (!c.ep.salud) c.ep.salud = unir(c.base, "/salud"); if (!c.ep.incidentes) c.ep.incidentes = unir(c.base, "/incidentes"); if (!c.ep.unidades) c.ep.unidades = unir(c.base, "/unidades"); }
    c.encabezado = $("int-encabezado").value.trim() || "X-API-Key";
    c.intervalo = Math.min(300, Math.max(5, +$("int-intervalo").value || 15));
    c.servidor = $("int-servidor").value.trim() ? normalizarUrl($("int-servidor").value).replace(/\/+$/, "") : "";
    c.usarServidor = $("int-usar-srv").checked && !!c.servidor;
    return c;
  }
  async function guardarConfig(silencio) {
    const msg = $("int-msg"); const di = (t, e) => { msg.textContent = t; msg.className = "msg-acceso" + (e ? " error" : " ok"); };
    if (!puedeConfigurar()) { di("Solo el Director(a) (o Alfa antes del traspaso) puede cambiar la integración.", true); return null; }
    let c; try { c = leerForm(); } catch (e) { di("Dirección no válida: " + e.message, true); return null; }
    const antes = JSON.stringify(cfg()), k = $("int-apikey").value;
    if (k) {
      if (!LLA) { di("Para guardar la llave API cifrada, vuelva a entrar con su contraseña (falta la llave de administración en esta sesión).", true); return null; }
      escribir("int_apikey", await F.sellar(LLA, k, "api")); $("int-apikey").value = "";
    }
    c.actualizado = Date.now(); c.por = actor().usuario; escribir("int_cfg", c);
    const ant = JSON.parse(antes || "{}");
    if (antes !== JSON.stringify({ ...c, actualizado: ant.actualizado, por: ant.por }) || k) {
      const m = modo(); if (m.prueba && m.prueba.url !== (c.ep.salud || c.base)) { m.prueba = null; escribir("int_modo", m); }
      auditar("integracion_config", `C4: ${c.base || c.ep.salud || "(vacío)"} · cámaras: ${c.camaras.length} · servidor: ${c.servidor || "no"}${k ? " · llave API actualizada (cifrada)" : ""}`);
    }
    if (srvConectado()) {
      try { await srv("/api/integracion", { method: "PUT", body: { config: c, api_key: k || null } }); if (!silencio) di("Guardado en este navegador y en el servidor de integración (cifrado en reposo)."); }
      catch (e) { di("Guardado en este navegador. El servidor respondió con error: " + e.message, true); }
    } else if (!silencio) di("Guardado en este navegador" + (k ? " (llave API cifrada con AES-256-GCM; nunca se sube al repositorio)." : "."));
    pintarTodo(); return c;
  }
  function llenarDemo() {
    const base = new URL("demo_c4/", location.href).href.replace(/\/$/, "");
    $("int-base").value = base; $("int-ep-salud").value = base + "/salud.json"; $("int-ep-incidentes").value = base + "/incidentes.json";
    $("int-ep-unidades").value = base + "/unidades.json"; $("int-ep-camaras").value = base + "/camaras.json";
    $("int-msg").className = "msg-acceso ok"; $("int-msg").textContent = "Se llenó con el ENDPOINT DE DEMOSTRACIÓN de este sitio (no es un C4: responde listas vacías a propósito). Pulse «Guardar» y luego «Probar conexión».";
  }
  async function probar(desdeServidor) {
    const c = await guardarConfig(true); if (!c) return;
    const url = c.ep.salud || c.base, out = $("int-prueba");
    if (!url) { out.replaceChildren(el("p", "Escriba la IP o URL del C4/API.", "msg-acceso error")); return; }
    out.replaceChildren(el("p", `Probando ${url}…`, "chica"));
    let r;
    if (desdeServidor) {
      try { r = await srv("/api/integracion/probar", { method: "POST", body: { url, usar_llave: true }, ms: 15000 }); r.via = "servidor"; }
      catch (e) { r = { ok: false, via: "servidor", url, msg: "No se pudo usar el servidor de integración: " + e.message }; }
    } else r = await probarNavegador(url, !c.usarServidor);
    const m = modo(); m.prueba = { url, ok: !!r.ok, t: Date.now(), via: r.via, msg: r.msg }; escribir("int_modo", m);
    auditar("integracion_prueba", `${url} · ${r.via} · ${r.ok ? "OK" : "falló"} · ${r.msg || ""}`.slice(0, 300));
    const caja = el("div", null, "resultado-prueba " + (r.ok ? "ok" : "mal"));
    caja.append(el("b", r.ok ? "✅ Conexión correcta" : "⚠️ Sin conexión utilizable"), el("p", r.msg || "", "chica"));
    if (r.muestra) caja.appendChild(el("pre", r.muestra, "muestra"));
    if (!r.ok && !desdeServidor) {
      const p = el("p", null, "chica");
      p.append(el("span", "Si el C4 está en la red privada municipal, el navegador no puede alcanzarlo desde GitHub Pages. "));
      if (c.servidor) { const b = el("button", "Probar desde el servidor de integración", "boton-secundario"); b.type = "button"; b.addEventListener("click", () => probar(true)); p.appendChild(b); }
      else p.appendChild(el("span", "Configure abajo el servidor de integración (POST /api/integracion/probar) instalado en su red."));
      caja.appendChild(p);
    }
    if (r.ok) caja.appendChild(el("p", "Siguiente paso: el Director(a) confirma abajo en «Activar modo operativo».", "chica"));
    out.replaceChildren(caja); pintarActivacion();
  }

  function agregarCamara(ev) {
    ev.preventDefault(); if (!puedeConfigurar()) return;
    const nombre = $("cam-nombre").value.trim(); let url;
    try { url = normalizarUrl($("cam-url").value); } catch (e) { alert("URL no válida: " + e.message); return; }
    if (!nombre || !url) return;
    const lat = parseFloat($("cam-lat").value), lon = parseFloat($("cam-lon").value);
    const c = cfg(); c.camaras.push({ id: "CAM-" + F.hex(F.aleatorio(3)).toUpperCase(), nombre, url, lat: isFinite(lat) ? lat : null, lon: isFinite(lon) ? lon : null, autorizada: Date.now(), por: actor().usuario });
    escribir("int_cfg", c); auditar("camara_autorizada", `${nombre} · ${url}`);
    ["cam-nombre", "cam-url", "cam-lat", "cam-lon"].forEach((id) => { $(id).value = ""; }); pintarTodo();
  }
  function quitarCamara(id) {
    if (!puedeConfigurar()) return;
    const c = cfg(), x = c.camaras.find((k) => k.id === id); if (!x || !confirm(`¿Quitar la cámara «${x.nombre}» de las autorizadas?`)) return;
    c.camaras = c.camaras.filter((k) => k.id !== id); escribir("int_cfg", c); auditar("camara_retirada", `${x.nombre} · ${x.url}`); pintarTodo();
  }
  function pintarCamaras() {
    const ul = $("cam-lista"); if (!ul) return; const L = cfg().camaras;
    ul.replaceChildren(...(L.length ? L.map((k) => {
      const li = el("li"); li.append(el("b", `📹 ${k.nombre}`), el("small", `${k.url}${k.lat != null ? ` · ${k.lat.toFixed(5)}, ${k.lon.toFixed(5)}` : " · sin coordenadas"} · autorizada ${fechaCorta(k.autorizada)}`));
      const a = el("a", "Abrir", "boton-secundario"); a.href = k.url; a.target = "_blank"; a.rel = "noopener noreferrer";
      const b = el("button", "Quitar", "boton-secundario"); b.type = "button"; b.dataset.quitarCam = k.id; b.disabled = !puedeConfigurar();
      li.append(a, b); return li;
    }) : [el("li", "Sin cámaras autorizadas. Agregue solo las que el Director(a) autorice.", "vacio")]));
  }

  function pintarActivacion() {
    const m = modo(), op = m.modo === "operativo", box = $("int-estado-modo"); if (!box) return;
    const p = m.prueba;
    box.replaceChildren(
      el("p", op ? `📡 MODO OPERATIVO desde ${fechaHora(m.desde)} · confirmado por ${m.por}` : "🔒 MODO DEMOSTRACIÓN (simulación local).", op ? "estado-op" : "estado-demo"),
      el("p", p ? `Última prueba: ${p.ok ? "✅ correcta" : "⚠️ fallida"} · ${p.url} · ${p.via} · ${hms(p.t)}` : "Aún no hay una prueba de conexión.", "chica"));
    $("op-activar").hidden = op; $("op-volver").hidden = !op;
    $("op-btn").disabled = !(p && p.ok) || !puedeConfigurar();
    $("op-pw-fila").hidden = REC();
    $("op-nota").textContent = !(p && p.ok) ? "Para activar: primero «Probar conexión» con resultado correcto." : REC() ? "Recorrido demo: el Director(a) DEMO confirma con la frase." : director() ? `Confirma: ${director().nombre}.` : "Falta dar de alta al Director(a) de Seguridad Pública.";
    $("op-frase-txt").textContent = FRASE_OPERATIVO;
  }
  async function activarOperativo(ev) {
    ev.preventDefault();
    const msg = $("op-msg"); const di = (t, e) => { msg.textContent = t; msg.className = "msg-acceso" + (e ? " error" : " ok"); };
    const m = modo(); if (!(m.prueba && m.prueba.ok)) return di("Primero «Probar conexión» con resultado correcto.", true);
    if (norm($("op-frase").value) !== norm(FRASE_OPERATIVO)) return di(`Escriba exactamente: ${FRASE_OPERATIVO}`, true);
    if (!$("op-ack").checked) return di("Falta confirmar que los endpoints están autorizados por el Director(a).", true);
    di("Verificando…");
    const conf = await confirmarDirector($("op-pw").value); $("op-pw").value = "";
    if (!conf.ok) { auditar("integracion_modo_operativo_rechazado", conf.msg); return di(conf.msg, true); }
    escribir("int_modo", { ...m, modo: "operativo", desde: Date.now(), por: conf.dir.nombre });
    $("op-frase").value = ""; $("op-ack").checked = false;
    auditar("integracion_modo_operativo", `confirmado por ${conf.dir.nombre} · C4: ${m.prueba.url}`);
    cambiarModo(); di("Modo operativo activado: simulación detenida; se consultan los endpoints configurados.");
  }
  function volverDemo() {
    if (!puedeConfigurar()) return;
    if (!confirm("¿Volver a MODO DEMOSTRACIÓN? Se dejará de consultar el C4 y se reanudará la simulación local.")) return;
    const m = modo(); escribir("int_modo", { ...m, modo: "demo", hasta: Date.now() });
    auditar("integracion_modo_demo", "regreso a modo demostración"); cambiarModo();
  }
  function cambiarModo() {
    aplicarClases(); if (G && G.aplicarModo) G.aplicarModo();
    if (window.DGI_MODO.operativo()) iniciarSondeo(); else detenerSondeo();
    pintarTodo(); window.DGI_CM.pintarKPIs();
  }

  const n = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
  function lista(j) {
    if (Array.isArray(j)) return j;
    if (j && typeof j === "object") for (const k of ["datos", "data", "items", "resultados", "results", "incidentes", "unidades", "camaras", "features"]) if (Array.isArray(j[k])) return j[k];
    return null;
  }
  function coord(o) {
    if (o && o.geometry && o.geometry.type === "Point" && Array.isArray(o.geometry.coordinates)) { const [x, y] = o.geometry.coordinates; if (isFinite(x) && isFinite(y)) return [+y, +x]; }
    const p = (o && o.properties) || o || {};
    const lat = n(p.lat ?? p.latitud ?? p.latitude ?? p.y), lon = n(p.lon ?? p.lng ?? p.longitud ?? p.longitude ?? p.x);
    return isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
  }
  const campo = (o, ...ks) => { const p = (o && o.properties) || o || {}; for (const k of ks) if (p[k] != null && p[k] !== "") return String(p[k]); return ""; };
  async function pedirRecurso(recurso, url) {
    const c = cfg();
    if (c.usarServidor && c.servidor) return srv(`/api/c4/${recurso}`, { ms: 12000 });
    const h = { Accept: "application/json" }; const k = await llaveApi(); if (k) h[c.encabezado || "X-API-Key"] = k;
    const r = await fetchT(url, { mode: "cors", headers: h }, 8000);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  async function sondear() {
    const c = cfg(), recursos = { salud: c.ep.salud, incidentes: c.ep.incidentes, unidades: c.ep.unidades, camaras: c.ep.camaras };
    let hubo = false, vacio = true;
    for (const [k, url] of Object.entries(recursos)) {
      if (!url) { estadoC4[k] = { estado: "sin_configurar" }; continue; }
      try {
        const j = await pedirRecurso(k, url);
        if (k === "salud") { estadoC4.salud = { estado: "ok", datos: j }; hubo = true; vacio = false; }
        else {
          const L = lista(j); if (L === null) { estadoC4[k] = { estado: "error", error: "La respuesta no es una lista reconocible." }; continue; }
          estadoC4[k] = { estado: "ok", items: L }; hubo = true; if (L.length) vacio = false;
        }
      } catch (e) { estadoC4[k] = { estado: "error", error: e.message || String(e) }; }
    }
    estadoC4.ultima = Date.now(); estadoC4.espera = !hubo || vacio;
    aplicarDatos(); pintarEstadoC4(); window.DGI_CM.pintarKPIs();
  }
  function aplicarDatos() {
    if (!G || !window.DGI_MODO.operativo()) return;
    const E = G.estado();
    if (estadoC4.unidades && estadoC4.unidades.estado === "ok") {
      E.unidades = estadoC4.unidades.items.map((u, i) => {
        const p = coord(u) || [NaN, NaN], codigo = campo(u, "codigo", "id", "unidad", "unidad_id", "placa") || ("U-" + (i + 1));
        const est = (campo(u, "estatus", "estado", "status") || "disponible").toLowerCase();
        return { codigo, tipo: campo(u, "tipo") || "patrulla", sector: campo(u, "sector") || "C4", rural: false, base: p, baseNombre: "C4", zona: null,
          lat: p[0], lon: p[1], estatus: /disp|libre|rondin|rondín|available/.test(est) ? "disponible" : /sitio|en_sitio|on_scene/.test(est) ? "en_sitio" : "asignada",
          incidente: campo(u, "incidente", "folio") || null, ruta: null, act: Date.now(), deC4: true };
      }).filter((u) => isFinite(u.lat) && isFinite(u.lon));
    } else E.unidades = [];
    if (estadoC4.incidentes && estadoC4.incidentes.estado === "ok") {
      E.incidentes = estadoC4.incidentes.items.map((o, i) => {
        const p = coord(o) || [NaN, NaN], folio = campo(o, "folio", "id", "numero", "clave") || ("C4-" + (i + 1));
        const tipo = campo(o, "tipo", "delito", "categoria", "descripcion") || "Incidente C4";
        const pri = (campo(o, "prioridad", "priority") || "media").toLowerCase();
        return { folio, tipo, categoria: G.categoriaDe(tipo), prioridad: /alta|high|1/.test(pri) ? "alta" : /baja|low|3/.test(pri) ? "baja" : "media",
          lat: p[0], lon: p[1], referencia: campo(o, "referencia", "lugar", "colonia") || "C4", direccion: campo(o, "direccion", "domicilio") || "",
          telefono: campo(o, "telefono") || "", aml: false, tiempo_llamada: Date.parse(campo(o, "fecha", "hora", "timestamp")) || Date.now(),
          estatus: "pendiente", patrulla: campo(o, "patrulla", "unidad") || null, deC4: true, localidad: null };
      }).filter((i) => isFinite(i.lat) && isFinite(i.lon));
    } else E.incidentes = [];
    G.pintar(); pintarCamarasMapa();
  }
  function pintarCamarasMapa() {
    if (!G || !G.mapa) return;
    if (!capas) {
      capas = { camaras: L.layerGroup() };
      if (G.control) G.control.addOverlay(capas.camaras, "📹 Cámaras autorizadas");
    }
    capas.camaras.clearLayers();
    const Lst = cfg().camaras.filter((k) => k.lat != null && k.lon != null);
    for (const k of Lst) {
      L.marker([k.lat, k.lon], { icon: L.divIcon({ className: "mk", iconSize: [28, 28], iconAnchor: [14, 14], html: '<div class="mk-cam">📹</div>' }) })
        .bindPopup(`<div class="popup"><h4>📹 ${k.nombre.replace(/[<>&]/g, "")}</h4><p class="chica">${k.url.replace(/[<>&]/g, "")}</p><p class="sim">Autorizada por el Director(a). No se inventan feeds.</p></div>`)
        .addTo(capas.camaras);
    }
    if (window.DGI_MODO.operativo() && Lst.length && !G.mapa.hasLayer(capas.camaras)) capas.camaras.addTo(G.mapa);
  }
  function iniciarSondeo() {
    detenerSondeo(); sondear().catch((e) => console.warn(e));
    temporizador = setInterval(() => sondear().catch((e) => console.warn(e)), (cfg().intervalo || 15) * 1000);
  }
  function detenerSondeo() { if (temporizador) { clearInterval(temporizador); temporizador = null; } if (capas && G && G.mapa && G.mapa.hasLayer(capas.camaras)) G.mapa.removeLayer(capas.camaras); }
  function pintarEstadoC4() {
    const box = $("c4-estado"); if (!box) return;
    if (!window.DGI_MODO.operativo()) { box.replaceChildren(el("p", "Modo demostración: no se consulta el C4.", "chica")); return; }
    const filas = ["salud", "incidentes", "unidades", "camaras"].map((k) => {
      const e = estadoC4[k]; if (!e) return el("li", `${k}: —`);
      if (e.estado === "sin_configurar") return el("li", `${k}: sin configurar`);
      if (e.estado === "error") return el("li", `${k}: error · ${e.error}`, "mal");
      if (k === "salud") return el("li", `salud: OK`, "ok");
      return el("li", `${k}: ${e.items.length} registro(s)`, e.items.length ? "ok" : "");
    });
    const ul = el("ul", null, "lista-v4"); ul.replaceChildren(...filas);
    box.replaceChildren(el("p", estadoC4.espera ? "⏳ Esperando datos del C4" : `📡 Última respuesta ${hms(estadoC4.ultima)}`, estadoC4.espera ? "espera-c4" : "ok"), ul);
  }
  function resumen() {
    const nI = estadoC4.incidentes && estadoC4.incidentes.estado === "ok" ? estadoC4.incidentes.items.length : null;
    const nU = estadoC4.unidades && estadoC4.unidades.estado === "ok" ? estadoC4.unidades.items.length : null;
    const ok = !!(estadoC4.salud && estadoC4.salud.estado === "ok");
    return { unidades: nU, incidentes: nI, camaras: cfg().camaras.length, estado: estadoC4.espera ? "esperando" : (ok ? "OK" : "error"), ok, ultima: estadoC4.ultima };
  }

  // ---------------- Auto-escaneo (solo redes autorizadas) ----------------
  function validarHost(s) {
    s = String(s || "").trim().toLowerCase();
    if (!s || s.length > 253) return null;
    if (/^(localhost|127\.|0\.0\.0\.0|::1|\[::1\])/.test(s)) return null; // no loopback ajeno
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) {
      const p = s.split(".").map(Number); if (p.some((x) => x > 255)) return null;
      if (p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127)) return s; // privadas + CGNAT
      return null; // no escanear internet público desde el navegador
    }
    if (/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(s) && s.includes(".")) return s;
    return null;
  }
  function validarCidr(s) {
    s = String(s || "").trim(); const m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(s); if (!m) return null;
    const bits = +m[2]; if (bits < 24 || bits > 30) return null; // solo redes chicas (máx. 256 hosts)
    const p = m[1].split(".").map(Number); if (p.some((x) => x > 255)) return null;
    if (!(p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168))) return null;
    return { ip: m[1], bits };
  }
  function pintarRedes() {
    const ul = $("red-lista"); if (!ul) return; const L = cfg().redes || [];
    ul.replaceChildren(...(L.length ? L.map((r) => {
      const li = el("li"); li.append(el("b", r.tipo === "cidr" ? `🌐 ${r.valor}` : `🖥️ ${r.valor}`), el("small", `autorizada ${fechaCorta(r.t)} · ${r.por}`));
      const b = el("button", "Quitar", "boton-secundario"); b.type = "button"; b.dataset.quitarRed = r.id; b.disabled = !puedeConfigurar(); li.appendChild(b); return li;
    }) : [el("li", "Sin redes autorizadas. Escriba hosts o rangos CIDR /24–/30 de la red municipal que usted administra.", "vacio")]));
  }
  function agregarRed(ev) {
    ev.preventDefault(); if (!puedeConfigurar()) return;
    const raw = $("red-valor").value.trim(), cidr = validarCidr(raw), host = validarHost(raw);
    if (!cidr && !host) { alert("Solo se aceptan hosts privados/nombres (p. ej. cam01.intranet.local) o rangos CIDR privados /24–/30 (p. ej. 192.168.10.0/24). No se escanea internet."); return; }
    if (!$("red-ack").checked) { alert("Marque la casilla: confirma que esas redes son de la dependencia y usted las autoriza."); return; }
    const c = cfg(); c.redes = c.redes || [];
    c.redes.push({ id: "RED-" + F.hex(F.aleatorio(3)).toUpperCase(), tipo: cidr ? "cidr" : "host", valor: cidr ? `${cidr.ip}/${cidr.bits}` : host, t: Date.now(), por: actor().usuario });
    escribir("int_cfg", c); auditar("red_autorizada", c.redes[c.redes.length - 1].valor); $("red-valor").value = ""; $("red-ack").checked = false; pintarTodo();
  }
  function quitarRed(id) {
    if (!puedeConfigurar()) return;
    const c = cfg(), x = (c.redes || []).find((r) => r.id === id); if (!x || !confirm(`¿Quitar la autorización de «${x.valor}»?`)) return;
    c.redes = c.redes.filter((r) => r.id !== id); escribir("int_cfg", c); auditar("red_retirada", x.valor); pintarTodo();
  }
  async function escanearNavegador(hosts, out) {
    const hallados = [];
    for (const h of hosts) {
      out.appendChild(el("p", `Consultando ${h}…`, "chica"));
      for (const ruta of RUTAS_SALUD) {
        const url = `https://${h}${ruta || "/"}`;
        try {
          const r = await fetchT(url, { mode: "cors", headers: { Accept: "application/json, text/plain, */*" } }, 2500);
          if (r.ok || r.status === 401 || r.status === 403) {
            hallados.push({ id: "HALL-" + F.hex(F.aleatorio(3)).toUpperCase(), host: h, url, tipo: "rest_salud", status: r.status, t: Date.now() });
            break;
          }
        } catch (e) { /* siguiente ruta */ }
      }
    }
    return hallados;
  }
  async function escanear() {
    if (!puedeConfigurar()) return;
    const out = $("scan-resultado"), c = cfg(), redes = c.redes || [];
    if (!redes.length) { out.replaceChildren(el("p", "Primero autorice al menos un host o rango CIDR.", "msg-acceso error")); return; }
    if (!$("scan-ack").checked) { out.replaceChildren(el("p", "Marque la casilla de autorización antes de escanear.", "msg-acceso error")); return; }
    out.replaceChildren(el("p", "Escaneando SOLO las redes autorizadas…", "chica"));
    auditar("escaneo_inicio", redes.map((r) => r.valor).join(", "));
    let hallados = [];
    if (srvConectado()) {
      try {
        const j = await srv("/api/escaneo", { method: "POST", body: { redes }, ms: 60000 });
        hallados = j.hallazgos || [];
        out.appendChild(el("p", `Servidor: ${hallados.length} hallazgo(s) (ONVIF/puertos comunes + REST).`, "chica"));
      } catch (e) { out.appendChild(el("p", "El servidor no respondió (" + e.message + "). Se intenta desde el navegador solo con hosts (sin rangos).", "chica")); }
    }
    if (!hallados.length) {
      const hosts = redes.filter((r) => r.tipo === "host").map((r) => r.valor);
      const cidrs = redes.filter((r) => r.tipo === "cidr");
      if (cidrs.length && !srvConectado()) out.appendChild(el("p", "⚠️ Los rangos CIDR no se pueden escanear desde GitHub Pages: el navegador no puede recorrer una LAN municipal. Instale el servidor de integración en su red.", "aviso-corto"));
      if (hosts.length) hallados = await escanearNavegador(hosts, out);
    }
    const prev = dispositivos(), ids = new Set(prev.map((d) => d.url || d.host + ":" + d.puerto));
    for (const h of hallados) if (!ids.has(h.url || h.host + ":" + h.puerto)) prev.push({ ...h, estado: "pendiente" });
    escribir("dispositivos", prev);
    auditar("escaneo_fin", `${hallados.length} hallazgo(s)`);
    pintarDispositivos();
    out.appendChild(el("p", hallados.length ? `Se listaron ${hallados.length} dispositivo(s) para que el Director(a) los apruebe uno por uno.` : "No se detectó ningún endpoint alcanzable en las redes autorizadas.", hallados.length ? "ok" : "chica"));
  }
  function pintarDispositivos() {
    const ul = $("dev-lista"); if (!ul) return; const L = dispositivos();
    ul.replaceChildren(...(L.length ? L.map((d) => {
      const li = el("li", null, d.estado); li.append(el("b", `${d.tipo || "dispositivo"} · ${d.host || d.url}`), el("small", `${d.url || ("puerto " + d.puerto)} · ${d.estado} · ${fechaCorta(d.t)}`));
      if (d.estado === "pendiente" && puedeConfigurar()) {
        const a = el("button", "Aprobar", "boton-secundario"); a.type = "button"; a.dataset.aprobarDev = d.id;
        const r = el("button", "Descartar", "boton-secundario"); r.type = "button"; r.dataset.descartarDev = d.id;
        li.append(a, r);
      }
      return li;
    }) : [el("li", "Sin dispositivos detectados.", "vacio")]));
  }
  function aprobarDispositivo(id) {
    if (!puedeConfigurar()) return;
    const L = dispositivos(), d = L.find((x) => x.id === id); if (!d) return;
    d.estado = "aprobado"; d.aprobado = Date.now(); d.por = actor().usuario; escribir("dispositivos", L);
    if (d.url && /camara|onvif|cctv|rtsp|mjpeg|video/i.test(d.tipo + d.url)) {
      const c = cfg(); if (!c.camaras.some((k) => k.url === d.url)) {
        c.camaras.push({ id: "CAM-" + F.hex(F.aleatorio(3)).toUpperCase(), nombre: d.host || d.url, url: d.url, lat: null, lon: null, autorizada: Date.now(), por: actor().usuario, deEscaneo: true });
        escribir("int_cfg", c);
      }
    }
    auditar("dispositivo_aprobado", `${d.tipo} · ${d.host || d.url}`); pintarTodo();
  }
  function descartarDispositivo(id) {
    if (!puedeConfigurar()) return;
    const L = dispositivos().filter((x) => x.id !== id); escribir("dispositivos", L);
    auditar("dispositivo_descartado", id); pintarDispositivos();
  }

  // ---------------- Credenciales firmadas + QR ----------------
  function qr(texto, cont) {
    cont.replaceChildren();
    if (typeof qrcode !== "function") { cont.appendChild(el("p", "Biblioteca QR no cargada.", "chica")); return; }
    try {
      const q = qrcode(0, "M"); q.addData(texto); q.make();
      const img = el("img"); img.alt = "Código QR de la credencial"; img.src = q.createDataURL(4, 4); cont.appendChild(img);
    } catch (e) { cont.appendChild(el("p", "No se pudo generar el QR: " + e.message, "chica")); }
  }
  function urlVerificacion(token) {
    const base = new URL("verificar.html", location.href).href;
    return base + "#t=" + encodeURIComponent(token);
  }
  async function emitirCredencial(ev) {
    ev.preventDefault();
    const msg = $("cred-msg"); const di = (t, e) => { msg.textContent = t; msg.className = "msg-acceso" + (e ? " error" : " ok"); };
    if (!puedeConfigurar()) return di("Solo el Director(a) emite credenciales.", true);
    const nombre = $("cred-nombre").value.trim(), empleado = $("cred-empleado").value.trim(), rol = $("cred-rol").value, vence = $("cred-vence").value;
    const u = ($("cred-usuario").value.trim() || ("u" + empleado)).toLowerCase(), p1 = $("cred-pw").value.trim(), p2 = $("cred-pw2").value.trim();
    if (nombre.length < 3 || !empleado) return di("Nombre y número de empleado son obligatorios.", true);
    if (!ROLES_CRED[rol]) return di("Rol no válido.", true);
    if (vence && Date.parse(vence + "T23:59:59-06:00") < Date.now()) return di("La fecha de vencimiento ya pasó.", true);
    if (!/^[a-z0-9._-]{3,32}$/.test(u) || Object.prototype.hasOwnProperty.call(window.PAQUETE.usuarios, u) || cuentaLocal(u)) return di("Usuario no válido o ya existe.", true);
    if (p1.length < 10) return di("La contraseña del usuario debe tener al menos 10 caracteres.", true);
    if (p1 !== p2) return di("Las contraseñas no coinciden.", true);
    di("Firmando…");
    const conf = await confirmarDirector($("cred-dir-pw").value); $("cred-dir-pw").value = "";
    if (!conf.ok) return di(conf.msg, true);
    const fir = await firmaDesde(conf); if (!fir) return di("No se pudo abrir la llave de firma del Director(a).", true);
    if (!DEK && !REC()) return di("Falta la llave de datos en esta sesión. Entre de nuevo.", true);
    const sal = F.aB64(F.aleatorio(16)), { kek, verificador } = await window.DGI_derivar(u, p1, sal);
    const id = "CRED-" + F.hex(F.aleatorio(4)).toUpperCase();
    const payload = { v: 1, id, nombre, empleado, rol, org: "SSP-GP", emisor: { nombre: conf.dir.nombre, usuario: conf.dir.usuario, kid: fir.kid },
      emitido: new Date().toISOString(), vence: vence ? new Date(vence + "T23:59:59-06:00").toISOString() : null, alg: fir.alg, pk: F.aUrl(F.b64(fir.pub)), kid: fir.kid };
    const token = await F.emitirToken(payload, fir.privada, fir.alg);
    const cta = { usuario: u, nombre, empleado, rol, org: "SSP-GP", sal, verificador, estado: "activa", creado: Date.now(), creadoPor: conf.dir.usuario,
      vence: payload.vence, credencial: id, llave: REC() ? null : await F.sellar(kek, DEK, u) };
    const C = cuentas(); C.push(cta); escribir("cuentas", C);
    const Cr = credenciales(); Cr.push({ id, token, payload, estado: "vigente", emitido: Date.now(), por: conf.dir.usuario }); escribir("credenciales", Cr);
    ["cred-nombre", "cred-empleado", "cred-usuario", "cred-pw", "cred-pw2", "cred-vence"].forEach((id) => { if ($(id)) $(id).value = ""; });
    auditar("credencial_emitida", `${id} · ${nombre} · ${empleado} · ${rol} · firma ${fir.kid}`);
    if (srvConectado()) srv("/api/credenciales", { method: "POST", body: { id, token, payload } }).catch((e) => console.warn(e));
    const url = urlVerificacion(token);
    $("cred-emitida").classList.remove("oculto");
    $("cred-token").value = token; $("cred-url").value = url; $("cred-emitida-txt").textContent = `${nombre} · ${empleado} · ${ROLES_CRED[rol]} · ${id}`;
    qr(url, $("cred-qr"));
    di("Credencial emitida y firmada. Entregue el QR al titular; la contraseña solo la conoce quien la escribió.");
    pintarCredenciales();
  }
  function pintarCredenciales() {
    const tb = $("cred-tabla"); if (!tb) return;
    const L = credenciales().slice().reverse();
    tb.replaceChildren(...(L.length ? L.map((c) => {
      const tr = el("tr"); if (c.estado !== "vigente") tr.className = "mal";
      const p = c.payload || {};
      for (const v of [c.id, p.nombre || "—", p.empleado || "—", (p.rol || "").toUpperCase(), p.vence ? fechaCorta(Date.parse(p.vence)) : "sin vencimiento", c.estado, fechaCorta(c.emitido)]) tr.appendChild(el("td", String(v)));
      const acc = el("td");
      const ver = el("a", "Verificar", "boton-secundario"); ver.href = urlVerificacion(c.token); ver.target = "_blank"; ver.rel = "noopener";
      acc.appendChild(ver);
      if (c.estado === "vigente" && puedeConfigurar()) {
        const b = el("button", "Revocar", "boton-secundario"); b.type = "button"; b.dataset.revocar = c.id; acc.appendChild(b);
      }
      tr.appendChild(acc); return tr;
    }) : [(() => { const tr = el("tr"); tr.appendChild(el("td", "Sin credenciales emitidas.")); tr.firstChild.colSpan = 8; return tr; })()]));
  }
  async function revocarCredencial(id) {
    if (!puedeConfigurar()) return;
    const L = credenciales(), c = L.find((x) => x.id === id); if (!c || !confirm(`¿Revocar la credencial ${id} (${c.payload && c.payload.nombre})?`)) return;
    const conf = await confirmarDirector(prompt(REC() ? "(recorrido demo: pulse Aceptar)" : "Contraseña del Director(a) para revocar:") || "");
    if (!conf.ok) { alert(conf.msg); return; }
    c.estado = "revocada"; c.revocada = Date.now(); c.revocadaPor = conf.dir.usuario; escribir("credenciales", L);
    const C = cuentas(), u = C.find((x) => x.credencial === id); if (u) { u.estado = "revocada"; escribir("cuentas", C); }
    auditar("credencial_revocada", `${id} · ${c.payload && c.payload.nombre}`);
    if (srvConectado()) srv("/api/credenciales/" + encodeURIComponent(id) + "/revocar", { method: "POST", body: {} }).catch((e) => console.warn(e));
    pintarCredenciales();
  }

  // ---------------- Traspaso de mando ----------------
  function pintarMando() {
    const box = $("mando-estado"); if (!box) return;
    const m = mando(), d = director();
    if (m.estado === "transferido") {
      box.replaceChildren(
        el("p", `🏛️ Mando transferido a Seguridad Pública · propietario: ${m.propietario}${m.por ? ` (${m.por})` : ""} · ${fechaHora(m.t)}`, "estado-op"),
        el("p", m.alfa === "reactivado_por_director" ? "Alfa está REACTIVADO como última instancia (por el Director)." : "Alfa está en resguardo: no puede entrar ni administrarse a sí mismo.", "chica"));
      $("tr-form").hidden = true; $("tr-reactivar").hidden = !(esDirector() && m.alfa !== "reactivado_por_director");
    } else {
      box.replaceChildren(el("p", "🧭 Mando inicial: Alfa (Raúl Muñoz Villa) administra el prototipo. El traspaso lo confirma el Director(a).", "estado-demo"),
        el("p", d ? `Director(a) registrado: ${d.nombre} (${d.usuario}).` : "Todavía no hay Director(a) registrado(a).", "chica"));
      $("tr-form").hidden = !puedeConfigurar() || !d; $("tr-reactivar").hidden = true;
    }
    $("tr-frase-txt").textContent = FRASE_TRASPASO; $("tr-re-frase-txt").textContent = FRASE_REACTIVAR;
    $("tr-pw-fila").hidden = REC(); $("tr-re-pw-fila").hidden = REC();
  }
  async function transferir(ev) {
    ev.preventDefault();
    const msg = $("tr-msg"); const di = (t, e) => { msg.textContent = t; msg.className = "msg-acceso" + (e ? " error" : " ok"); };
    if (mando().estado === "transferido") return di("El mando ya fue transferido.", true);
    if (norm($("tr-frase").value) !== norm(FRASE_TRASPASO)) return di(`Escriba exactamente: ${FRASE_TRASPASO}`, true);
    if (!$("tr-ack").checked) return di("Falta confirmar que entiende las consecuencias.", true);
    di("Verificando…");
    const conf = await confirmarDirector($("tr-pw").value); $("tr-pw").value = "";
    if (!conf.ok) { auditar("traspaso_rechazado", conf.msg); return di(conf.msg, true); }
    const fir = await firmaDesde(conf); if (!fir) return di("No se pudo abrir la llave de firma del Director(a).", true);
    const m = { estado: "transferido", alfa: "resguardo", propietario: conf.dir.usuario, por: conf.dir.nombre, t: Date.now(), v: 1 };
    m.firma = await F.firmarTexto(canonMando(m), fir.privada, fir.alg);
    escribir("mando", m);
    const C = cuentas(), d = C.find((x) => x.usuario === conf.dir.usuario); if (d) { d.mandoTransferido = true; escribir("cuentas", C); }
    auditar("traspaso_mando", `propietario ${conf.dir.usuario} · Alfa en resguardo · firma ${fir.kid}`);
    if (srvConectado()) srv("/api/mando/transferir", { method: "POST", body: m }).catch((e) => console.warn(e));
    $("tr-frase").value = ""; $("tr-ack").checked = false;
    di("Mando transferido. Alfa queda como última instancia; solo el Director(a) puede reactivarlo.");
    pintarMando();
    if (S.rol === "alfa" && !REC()) { alert("Traspaso completado. Su sesión Alfa se cerrará: el Director(a) es ahora el único administrador."); setTimeout(() => window.DGI_salir("traspaso_mando"), 800); }
  }
  async function reactivarAlfa(ev) {
    ev.preventDefault();
    const msg = $("tr-re-msg"); const di = (t, e) => { msg.textContent = t; msg.className = "msg-acceso" + (e ? " error" : " ok"); };
    if (!esDirector()) return di("Solo el Director(a) puede reactivar a Alfa.", true);
    if (norm($("tr-re-frase").value) !== norm(FRASE_REACTIVAR)) return di(`Escriba exactamente: ${FRASE_REACTIVAR}`, true);
    di("Verificando…");
    const conf = await confirmarDirector($("tr-re-pw").value); $("tr-re-pw").value = "";
    if (!conf.ok) return di(conf.msg, true);
    const fir = await firmaDesde(conf); if (!fir) return di("No se pudo abrir la llave de firma.", true);
    const m = { ...mando(), alfa: "reactivado_por_director", reactivado: Date.now(), reactivadoPor: conf.dir.usuario };
    m.firma = await F.firmarTexto(canonMando(m), fir.privada, fir.alg);
    escribir("mando", m);
    auditar("alfa_reactivado", `por ${conf.dir.usuario}`);
    if (srvConectado()) srv("/api/mando/reactivar-alfa", { method: "POST", body: m }).catch((e) => console.warn(e));
    $("tr-re-frase").value = ""; di("Alfa reactivado como última instancia. Puede volver a entrar."); pintarMando();
  }

  // ---------------- Recorrido demo del Director ----------------
  async function iniciarRecorrido() {
    if (S.rol !== "alfa") return alert("El recorrido demo lo inicia Alfa (presenta al Director).");
    if (REC()) return;
    try { sessionStorage.setItem("dgi_v4_recorrido", "1"); } catch (e) { /* nada */ }
    await prepararRecorrido();
    auditar("recorrido_demo_inicio", "arenero dgi_v4_rec_* · sin datos delictivos inventados");
    aplicarClases(); pintarTodo();
    alert("Recorrido DEMO del Director activo.\n\n• Usa un arenero aparte (no altera la configuración real).\n• Los botones funcionan; el endpoint de demo responde listas VACÍAS (no inventa delitos).\n• Al terminar, pulse «Salir del recorrido».");
    window.DGI_CM.mostrarTab("tab-integracion");
  }
  function salirRecorrido() {
    if (!REC()) return;
    auditar("recorrido_demo_fin", "borrando arenero");
    detenerSondeo();
    const borrar = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("dgi_v4_rec_")) borrar.push(k); }
    borrar.forEach((k) => localStorage.removeItem(k));
    try { sessionStorage.removeItem("dgi_v4_recorrido"); } catch (e) { /* nada */ }
    FIRMA = null; aplicarClases();
    if (G && G.aplicarModo) G.aplicarModo();
    pintarTodo(); window.DGI_CM.pintarKPIs();
    alert("Recorrido demo terminado. Se borró el arenero.");
  }

  // ---------------- Servidor de integración (token de sesión) ----------------
  async function conectarServidor() {
    const msg = $("srv-msg"); const di = (t, e) => { msg.textContent = t; msg.className = "msg-acceso" + (e ? " error" : " ok"); };
    const c = await guardarConfig(true); if (!c || !c.servidor) return di("Escriba la URL del servidor de integración.", true);
    di("Conectando…");
    try {
      const j = await srv("/api/sesion", { method: "POST", body: { usuario: actor().usuario, rol: S.rol, nombre: S.nombre }, ms: 8000 });
      try { sessionStorage.setItem(K("srv_token"), j.token); } catch (e) { /* nada */ }
      auditar("servidor_integracion_conectado", c.servidor);
      di("Conectado al servidor de integración. La configuración y la bitácora se pueden espejar allí (cifrado en reposo).");
    } catch (e) { di("No se pudo conectar: " + e.message, true); }
  }
  function espejoAuditoria(e) {
    if (!srvConectado()) return;
    srv("/api/auditoria", { method: "POST", body: e }).catch(() => {});
  }

  // ---------------- Pintado / permisos de UI ----------------
  function pintarDirector() {
    const box = $("dir-estado"), form = $("form-director"); if (!box) return;
    const d = director();
    if (REC()) {
      const dd = dirDemo();
      box.replaceChildren(el("p", `🎭 Director(a) DEMO: ${dd ? dd.nombre : "—"} · huella ${dd && dd.firma ? dd.firma.kid : "—"}`, "chica"));
      if (form) form.hidden = true; return;
    }
    if (d) {
      box.replaceChildren(el("p", `👤 ${d.nombre} · ${d.cargo || "Director(a)"} · usuario «${d.usuario}» · firma ${d.firma.alg} ${d.firma.kid}`, "ok"),
        el("p", "La llave privada de firma está cifrada en este navegador. En producción conviene respaldarla en HSM / servidor municipal.", "chica"));
      if (form) form.hidden = true;
    } else {
      box.replaceChildren(el("p", "Todavía no hay Director(a). Alfa lo da de alta en presencia del titular (el Director escribe su propia contraseña).", "chica"));
      if (form) form.hidden = S.rol !== "alfa" || alfaRestringido();
    }
  }
  function pintarPermisos() {
    const ok = puedeConfigurar();
    document.querySelectorAll("#tab-integracion [data-solo-dir], #tab-credenciales [data-solo-dir], #tab-traspaso [data-solo-dir]").forEach((n) => { n.disabled = !ok; });
    const aviso = $("int-aviso-rol");
    if (aviso) aviso.textContent = ok ? (REC() ? "Recorrido DEMO · permisos de Director(a)." : (esDirector() ? "Sesión del Director(a): puede configurar la integración." : "Sesión Alfa (antes del traspaso): puede preparar la integración; el modo operativo y el traspaso los confirma el Director(a)."))
      : "Solo lectura: la integración la administra el Director(a) de Seguridad Pública.";
    $("btn-recorrido").hidden = !(S && S.rol === "alfa" && !REC());
    $("btn-salir-recorrido").hidden = !REC();
    const pw = $("cred-dir-pw-fila"); if (pw) pw.hidden = REC();
  }
  function pintarTodo() {
    if (!$("tab-integracion")) return;
    pintarDirector(); llenarForm(); pintarCamaras(); pintarActivacion(); pintarEstadoC4();
    pintarRedes(); pintarDispositivos(); pintarCredenciales(); pintarMando(); pintarPermisos(); aplicarClases();
  }

  function antesDeIniciar(sesion, rol) {
    S = sesion; R = rol;
    if (REC() && sesion.rol === "alfa") {
      // tras recargar con el recorrido activo: se vuelve a preparar el Director DEMO
      prepararRecorrido().catch((e) => console.warn(e));
      // el rol efectivo en UI es director
      Object.assign(R, window.DGI_CM.roles.director);
      R.etq = "DIRECTOR (DEMO)"; R.desc = "Recorrido de demostración";
    }
    if (alfaRestringido() && sesion.rol === "alfa") {
      // no debería llegar aquí (acceso.js bloquea), pero por si acaso
      R.tabs = R.tabs.filter((t) => !["integracion", "credenciales", "traspaso", "licencias"].includes(t));
    }
  }
  function iniciar(sesion, rol, datos, g) {
    S = sesion; R = rol; D = datos; G = g;
    const sg = sesionGuardada();
    if (sg && sg.lla) try { LLA = F.b64(sg.lla); } catch (e) { /* nada */ }
    if (sg && sg.dek) try { DEK = F.b64(sg.dek); } catch (e) { /* nada */ }
    aplicarClases(); pintarTodo();
    if (window.DGI_MODO.operativo()) iniciarSondeo();
    auditar("integracion_panel_abierto", `modo ${modo().modo}`);
  }

  function cablear() {
    if (cablear.ok) return; cablear.ok = true;
    const on = (id, ev, fn) => { const n = $(id); if (n) n.addEventListener(ev, fn); };
    on("form-director", "submit", altaDirector);
    on("form-integracion", "submit", (ev) => { ev.preventDefault(); guardarConfig(false); });
    on("btn-probar", "click", () => probar(false));
    on("btn-demo-c4", "click", llenarDemo);
    on("btn-conectar-srv", "click", conectarServidor);
    on("form-camara", "submit", agregarCamara);
    on("form-operativo", "submit", activarOperativo);
    on("btn-volver-demo", "click", volverDemo);
    on("form-red", "submit", agregarRed);
    on("btn-escanear", "click", escanear);
    on("form-credencial", "submit", emitirCredencial);
    on("form-traspaso", "submit", transferir);
    on("form-reactivar", "submit", reactivarAlfa);
    on("btn-recorrido", "click", iniciarRecorrido);
    on("btn-salir-recorrido", "click", salirRecorrido);
    on("cred-copiar", "click", () => { const t = $("cred-token"); if (t) { t.select(); document.execCommand("copy"); } });
    document.addEventListener("click", (ev) => {
      const q = ev.target.closest("[data-quitar-cam]"); if (q) { quitarCamara(q.dataset.quitarCam); return; }
      const qr = ev.target.closest("[data-quitar-red]"); if (qr) { quitarRed(qr.dataset.quitarRed); return; }
      const a = ev.target.closest("[data-aprobar-dev]"); if (a) { aprobarDispositivo(a.dataset.aprobarDev); return; }
      const d = ev.target.closest("[data-descartar-dev]"); if (d) { descartarDispositivo(d.dataset.descartarDev); return; }
      const r = ev.target.closest("[data-revocar]"); if (r) { revocarCredencial(r.dataset.revocar); return; }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", cablear); else cablear();

  window.DGI_INT = { cuentaLocal, puedeEntrar, alEntrar, antesDeIniciar, iniciar, resumen, espejoAuditoria, cfg, modo, director, mando, auditar };
})();
