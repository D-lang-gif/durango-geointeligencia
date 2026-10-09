// Minifica y ofusca los JS propios del sitio publicado (no toca vendor/ ni datos/).
// Uso (lo ejecuta el flujo de publicación): node herramientas/ofuscar.cjs _sitio/js
// Nota: el código que corre en el navegador puede hacerse difícil de leer, no imposible.
"use strict";
const fs = require("fs");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const dir = process.argv[2] || "_sitio/js";
const BANNER = "/*! Durango GeoInteligencia · © 2026 Raúl Muñoz Villa. Todos los derechos reservados. Prohibida su copia, modificación o reutilización sin permiso escrito del autor. */\n";

const archivos = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
if (archivos.length === 0) { console.error("No hay archivos .js en " + dir); process.exit(1); }

// Borrar mapas de código fuente si existieran.
for (const f of fs.readdirSync(path.dirname(dir), { recursive: true })) {
  if (String(f).endsWith(".map")) fs.rmSync(path.join(path.dirname(dir), String(f)));
}

for (const f of archivos) {
  const ruta = path.join(dir, f);
  const fuente = fs.readFileSync(ruta, "utf8");
  // Prefijo distinto por archivo: los scripts clásicos comparten el ámbito global.
  const prefijo = "_" + f.replace(/\W/g, "").slice(0, 6) + "_";
  const r = JavaScriptObfuscator.obfuscate(fuente, {
    compact: true,
    identifierNamesGenerator: "hexadecimal",
    identifiersPrefix: prefijo,
    renameGlobals: false,
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.75,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    selfDefending: false,
    debugProtection: false,
    sourceMap: false,
    seed: 2026,
  });
  const salida = BANNER + r.getObfuscatedCode() + "\n";
  fs.writeFileSync(ruta, salida);
  console.log(`${f}: ${fuente.length} → ${salida.length} bytes`);
}
