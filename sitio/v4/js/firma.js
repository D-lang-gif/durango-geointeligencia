/* Durango GeoInteligencia v4 — utilidades criptográficas compartidas (consola y página de verificación).
   - AES-256-GCM para guardar secretos CIFRADOS en este navegador (llave API, llave de firma del Director).
   - Firma de credenciales con Ed25519 (WebCrypto). Si el navegador no tiene Ed25519, se usa ECDSA P-256 (ES256).
   - Formato de credencial: DGI1.<payload base64url>.<firma base64url>; el payload incluye la llave pública del firmante (pk)
     y su huella (kid). La CONFIANZA se decide comparando la huella con las llaves del Director registradas en el lector o servidor. */
(function () {
  "use strict";
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const aB64 = (u8) => { let s = ""; const a = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8); for (let k = 0; k < a.length; k += 0x8000) s += String.fromCharCode.apply(null, a.subarray(k, k + 0x8000)); return btoa(s); };
  const aUrl = (u8) => aB64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const deUrl = (s) => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return b64(s); };
  const hex = (u8) => Array.from(new Uint8Array(u8), (b) => b.toString(16).padStart(2, "0")).join("");
  const aleatorio = (n) => crypto.getRandomValues(new Uint8Array(n));

  async function sellar(llaveRaw, datos, aad) { // AES-256-GCM → {iv, ct} en base64
    const k = await crypto.subtle.importKey("raw", llaveRaw, "AES-GCM", false, ["encrypt"]);
    const iv = aleatorio(12), o = { name: "AES-GCM", iv }; if (aad) o.additionalData = te.encode(aad);
    const claro = typeof datos === "string" ? te.encode(datos) : datos;
    return { iv: aB64(iv), ct: aB64(new Uint8Array(await crypto.subtle.encrypt(o, k, claro))) };
  }
  async function abrir(llaveRaw, sobre, aad) {
    const k = await crypto.subtle.importKey("raw", llaveRaw, "AES-GCM", false, ["decrypt"]);
    const o = { name: "AES-GCM", iv: b64(sobre.iv) }; if (aad) o.additionalData = te.encode(aad);
    return new Uint8Array(await crypto.subtle.decrypt(o, k, b64(sobre.ct)));
  }
  async function sha256Hex(datos) { return hex(await crypto.subtle.digest("SHA-256", typeof datos === "string" ? te.encode(datos) : datos)); }
  async function huella(pubRaw) { const h = (await sha256Hex(pubRaw)).slice(0, 16).toUpperCase(); return h.match(/.{4}/g).join("-"); }

  // ---------- Firma ----------
  const ALG = { Ed25519: { gen: { name: "Ed25519" }, imp: { name: "Ed25519" }, firma: { name: "Ed25519" } },
    ES256: { gen: { name: "ECDSA", namedCurve: "P-256" }, imp: { name: "ECDSA", namedCurve: "P-256" }, firma: { name: "ECDSA", hash: "SHA-256" } } };
  let algDisponible = null;
  async function algoritmo() {
    if (algDisponible) return algDisponible;
    try { await crypto.subtle.generateKey(ALG.Ed25519.gen, true, ["sign", "verify"]); algDisponible = "Ed25519"; } catch (e) { algDisponible = "ES256"; }
    return algDisponible;
  }
  async function generarLlaves() { // extraíble solo para poder guardarla CIFRADA; en sesión se usa como no extraíble
    const alg = await algoritmo();
    const par = await crypto.subtle.generateKey(ALG[alg].gen, true, ["sign", "verify"]);
    const pub = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", par.privateKey));
    return { alg, pub, pkcs8, kid: await huella(pub) };
  }
  async function importarPrivada(alg, pkcs8) { return crypto.subtle.importKey("pkcs8", pkcs8, ALG[alg].imp, false, ["sign"]); }
  async function importarPublica(alg, pubRaw) { return crypto.subtle.importKey("raw", pubRaw, ALG[alg].imp, false, ["verify"]); }

  async function emitirToken(payload, privada, alg) {
    const cuerpo = aUrl(te.encode(JSON.stringify(payload)));
    const firma = new Uint8Array(await crypto.subtle.sign(ALG[alg].firma, privada, te.encode("DGI1." + cuerpo)));
    return `DGI1.${cuerpo}.${aUrl(firma)}`;
  }
  function leerToken(token) {
    const t = String(token || "").trim().replace(/^.*[#&?]t=/, "").replace(/[\s&].*$/, "");
    const p = t.split(".");
    if (p.length !== 3 || p[0] !== "DGI1") throw new Error("No es una credencial DGI1 (formato desconocido).");
    let payload; try { payload = JSON.parse(td.decode(deUrl(p[1]))); } catch (e) { throw new Error("La credencial está dañada (no se puede leer)."); }
    return { token: t, payload, firmado: "DGI1." + p[1], firma: deUrl(p[2]) };
  }
  // Verifica la firma con la llave incluida en la credencial. Devuelve {firmaOk, kidOk, payload}.
  async function verificarToken(token) {
    const r = leerToken(token), P = r.payload;
    if (!P || P.v !== 1 || !P.pk || !ALG[P.alg]) return { firmaOk: false, kidOk: false, payload: P, error: "Credencial incompleta." };
    const pub = deUrl(P.pk); let firmaOk = false;
    try { firmaOk = await crypto.subtle.verify(ALG[P.alg].firma, await importarPublica(P.alg, pub), r.firma, te.encode(r.firmado)); }
    catch (e) { return { firmaOk: false, kidOk: false, payload: P, error: P.alg === "Ed25519" ? "Este navegador no puede verificar firmas Ed25519 (actualícelo)." : String(e.message || e) }; }
    const kid = await huella(pub);
    return { firmaOk, kidOk: !!(P.emisor && P.emisor.kid === kid), kid, payload: P, token: r.token };
  }
  // Firma/verificación de registros internos (p. ej. el estado del traspaso de mando)
  async function firmarTexto(texto, privada, alg) { return aUrl(new Uint8Array(await crypto.subtle.sign(ALG[alg].firma, privada, te.encode(texto)))); }
  async function verificarTexto(texto, firmaUrl, pubB64, alg) {
    try { return await crypto.subtle.verify(ALG[alg].firma, await importarPublica(alg, b64(pubB64)), deUrl(firmaUrl), te.encode(texto)); } catch (e) { return false; }
  }

  window.DGI_FIRMA = { b64, aB64, aUrl, deUrl, hex, aleatorio, sellar, abrir, sha256Hex, huella, algoritmo, generarLlaves,
    importarPrivada, importarPublica, emitirToken, leerToken, verificarToken, firmarTexto, verificarTexto };
})();
