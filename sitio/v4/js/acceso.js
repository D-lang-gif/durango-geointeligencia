/* Durango GeoInteligencia v4 (DEMO) — acceso por ROL.
   Cada usuario (alfa, charlie, bravo, delta, eco) tiene sal + verificador PBKDF2-HMAC-SHA256 (600 000 it.). Las contraseñas NO están en el sitio.
   La llave de datos va envuelta por usuario: solo quien conoce su contraseña descifra el paquete del mapa.
   LÍMITE HONESTO: es verificación en el navegador (nivel demostración); para uso real, autenticación y permisos en servidor. */
(function () {
  "use strict";
  const P = window.PAQUETE;
  const $ = (id) => document.getElementById(id);
  const CLAVE_SESION = "dgi_v4_sesion", CLAVE_INTENTOS = "dgi_v4_intentos";
  const MAX_INTENTOS = 5, BLOQUEO_MS = 60000;
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");
  const aB64 = (u8) => { let s = ""; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
  const soportado = () => window.isSecureContext && window.crypto && crypto.subtle && "DecompressionStream" in window;
  function mensaje(t, error) { const m = $("msg-acceso"); m.textContent = t; m.className = "msg-acceso" + (error ? " error" : ""); }

  async function derivar(usuario, contrasena, salB64) {
    const secreto = new TextEncoder().encode(`${usuario}:${contrasena}`.normalize("NFC"));
    const base = await crypto.subtle.importKey("raw", secreto, "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: b64(salB64), iterations: P.iter }, base, 512));
    return { kek: bits.slice(0, 32), verificador: hex(bits.slice(32)) };
  }
  async function abrirAES(llave, iv, ct, aad) {
    const k = await crypto.subtle.importKey("raw", llave, "AES-GCM", false, ["decrypt"]);
    const o = { name: "AES-GCM", iv: b64(iv) }; if (aad) o.additionalData = new TextEncoder().encode(aad);
    return new Uint8Array(await crypto.subtle.decrypt(o, k, b64(ct)));
  }
  async function descifrarDatos(dek) {
    const claro = await abrirAES(dek, P.iv, P.datos);
    const flujo = new Blob([claro]).stream().pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(flujo).text());
  }
  // Verificación de la credencial de Alfa (la usa la compuerta «Conexión real»)
  window.DGI_verificarAlfa = async function (pw) {
    const r = P.usuarios.alfa; const { verificador } = await derivar("alfa", String(pw || "").trim().toLowerCase(), r.sal);
    return verificador === r.verificador;
  };

  function intentos() { try { return JSON.parse(localStorage.getItem(CLAVE_INTENTOS)) || { n: 0, hasta: 0 }; } catch (e) { return { n: 0, hasta: 0 }; } }
  function fallo(usuario) {
    const s = intentos(); s.n += 1; if (s.n >= MAX_INTENTOS) { s.hasta = Date.now() + BLOQUEO_MS; s.n = 0; }
    try { localStorage.setItem(CLAVE_INTENTOS, JSON.stringify(s)); } catch (e) { /* nada */ }
    window.DGI_CM && window.DGI_CM.auditar({ usuario: usuario || "(vacío)", rol: "-" }, s.hasta > Date.now() ? "acceso_bloqueo_temporal" : "acceso_fallido", "usuario o contraseña incorrectos");
  }
  function abrir(sesion, datos) {
    document.body.classList.add("dentro");
    $("acceso").classList.add("oculto");
    window.DGI_CM.iniciar(sesion, datos);
  }
  async function entrar(u, reg, kek) {
    const lic = window.DGI_CM.licencias.verificar(reg.org);
    if (!lic.ok) { mensaje(lic.motivo, true); window.DGI_CM.auditar({ usuario: u, rol: reg.rol }, "acceso_bloqueado_licencia", lic.motivo); return; }
    const dek = await abrirAES(kek, reg.llave.iv, reg.llave.ct, u);
    const datos = await descifrarDatos(dek);
    const sesion = { usuario: u, rol: reg.rol, nombre: reg.nombre, org: reg.org, unidad: reg.unidad || null, escuela: reg.escuela ?? null, inicio: Date.now() };
    try { sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ ...sesion, dek: aB64(dek) })); } catch (e) { /* modo privado */ }
    try { localStorage.removeItem(CLAVE_INTENTOS); } catch (e) { /* nada */ }
    window.DGI_CM.auditar(sesion, "acceso", `${reg.rol.toUpperCase()} · licencia ${reg.org}`);
    $("contrasena").value = "";
    abrir(sesion, datos);
  }

  $("ver-pw").addEventListener("click", () => { const i = $("contrasena"); i.type = i.type === "password" ? "text" : "password"; });
  $("form-acceso").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!soportado()) { mensaje("Este navegador no es compatible (se requiere Chrome, Safari 16.4+ o Firefox actualizados, con HTTPS).", true); return; }
    const s = intentos();
    if (s.hasta > Date.now()) { mensaje(`Demasiados intentos. Espere ${Math.ceil((s.hasta - Date.now()) / 1000)} s.`, true); return; }
    const btn = $("btn-entrar"); btn.disabled = true; btn.textContent = "Verificando…"; mensaje("");
    try {
      const u = $("usuario").value.trim().toLowerCase(), pw = $("contrasena").value.trim().toLowerCase();
      const reg = Object.prototype.hasOwnProperty.call(P.usuarios, u) ? P.usuarios[u] : null;
      const { kek, verificador } = await derivar(u, pw, reg ? reg.sal : P.usuarios.alfa.sal); // siempre se deriva (no revela usuarios por tiempo)
      if (!reg || verificador !== reg.verificador) { fallo(u); await new Promise((r) => setTimeout(r, 600)); mensaje("Usuario o contraseña incorrectos.", true); return; }
      await entrar(u, reg, kek);
    } catch (e) {
      console.warn(e); mensaje("No se pudo completar el acceso: " + (e.message || e), true);
    } finally { btn.disabled = false; btn.textContent = "Entrar"; }
  });

  window.DGI_salir = function (motivo) {
    try {
      const s = JSON.parse(sessionStorage.getItem(CLAVE_SESION) || "null");
      if (s && window.DGI_CM) window.DGI_CM.auditar(s, "salida", motivo || "cierre de sesión").finally(() => { sessionStorage.removeItem(CLAVE_SESION); location.reload(); });
      else { sessionStorage.removeItem(CLAVE_SESION); location.reload(); }
    } catch (e) { location.reload(); }
  };
  $("btn-salir").addEventListener("click", () => window.DGI_salir());

  (async () => { // sesión ya abierta en esta pestaña
    let s = null; try { s = JSON.parse(sessionStorage.getItem(CLAVE_SESION) || "null"); } catch (e) { /* nada */ }
    if (s && s.dek && soportado()) {
      try {
        const lic = window.DGI_CM.licencias.verificar(s.org); if (!lic.ok) throw new Error(lic.motivo);
        const datos = await descifrarDatos(b64(s.dek)); const { dek, ...sesion } = s;
        abrir(sesion, datos); return;
      } catch (e) { sessionStorage.removeItem(CLAVE_SESION); mensaje(String(e.message || e), true); }
    }
    const aviso = localStorage.getItem("dgi_v4_aviso_bloqueo");
    if (aviso) { mensaje(aviso, true); localStorage.removeItem("dgi_v4_aviso_bloqueo"); }
    $("usuario").focus();
  })();
})();
