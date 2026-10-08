/* Durango GeoInteligencia — acceso con usuario y contraseña (sitio estático).
   La contraseña NO está en el sitio. Se deriva una clave con PBKDF2-HMAC-SHA256 (sal aleatoria, 600 000 iteraciones):
   los primeros 32 bytes descifran el paquete de datos (AES-256-GCM) y los otros 32 se comparan con el verificador.
   OJO: es una protección de nivel demostración (ver README: un sitio estático permite ataques de fuerza bruta sin conexión). */
(function () {
  "use strict";
  const P = window.PAQUETE;
  const $ = (id) => document.getElementById(id);
  const CLAVE_SESION = "dgi_clave_v2";
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");
  const aB64 = (u8) => btoa(String.fromCharCode(...u8));

  function soportado() {
    return window.isSecureContext && window.crypto && crypto.subtle && "DecompressionStream" in window;
  }

  async function descifrar(claveBytes) {
    const clave = await crypto.subtle.importKey("raw", claveBytes, "AES-GCM", false, ["decrypt"]);
    const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(P.iv) }, clave, b64(P.datos));
    const flujo = new Blob([claro]).stream().pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(flujo).text());
  }

  async function derivar(usuario, contrasena) {
    const secreto = new TextEncoder().encode(`${usuario}:${contrasena}`.normalize("NFC"));
    const base = await crypto.subtle.importKey("raw", secreto, "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: b64(P.sal), iterations: P.iter }, base, 512));
    return { clave: bits.slice(0, 32), verificador: hex(bits.slice(32)) };
  }

  function entrar(datos) {
    document.body.classList.add("dentro");
    $("acceso").classList.add("oculto");
    window.DGI_iniciar(datos);
  }

  function mensaje(t, error) { const m = $("msg-acceso"); m.textContent = t; m.className = "msg-acceso" + (error ? " error" : ""); }

  $("ver-pw").addEventListener("click", () => {
    const i = $("contrasena"); i.type = i.type === "password" ? "text" : "password";
  });

  $("form-acceso").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!soportado()) { mensaje("Este navegador no es compatible (se requiere Chrome, Safari 16.4+ o Firefox actualizados, con HTTPS).", true); return; }
    const btn = $("btn-entrar");
    const usuario = $("usuario").value.trim().toLowerCase();
    const contrasena = $("contrasena").value.trim().toLowerCase();
    btn.disabled = true; btn.textContent = "Verificando…"; mensaje("");
    try {
      const { clave, verificador } = await derivar(usuario, contrasena);
      if (verificador !== P.verificador) {
        await new Promise((r) => setTimeout(r, 900));
        mensaje("Usuario o contraseña incorrectos.", true);
        return;
      }
      const datos = await descifrar(clave);
      try { sessionStorage.setItem(CLAVE_SESION, aB64(clave)); } catch (e) { /* modo privado */ }
      $("contrasena").value = "";
      entrar(datos);
    } catch (e) {
      console.error(e);
      mensaje("No se pudieron abrir los datos: " + (e.message || e), true);
    } finally {
      btn.disabled = false; btn.textContent = "Entrar";
    }
  });

  $("btn-salir").addEventListener("click", () => {
    try { sessionStorage.removeItem(CLAVE_SESION); } catch (e) { /* nada */ }
    location.reload();
  });

  // Sesión ya abierta en esta pestaña (se borra al cerrar la pestaña o con "Salir")
  (async () => {
    let guardada = null;
    try { guardada = sessionStorage.getItem(CLAVE_SESION); } catch (e) { /* nada */ }
    if (guardada && soportado()) {
      try { entrar(await descifrar(b64(guardada))); return; } catch (e) { sessionStorage.removeItem(CLAVE_SESION); }
    }
    $("usuario").focus();
  })();
})();
