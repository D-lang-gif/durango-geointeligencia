/* Durango GeoInteligencia v3 — MODELO ESTIMADO de riesgo por zona y hora (SIMULACIÓN, no datos oficiales por colonia u hora).
   - Peso de cada tipo de delito: participación REAL en Gómez Palacio 2025 (SESNSP, fuero común, nivel municipal).
   - Perfil por hora y por día: SUPUESTOS generales del modelo (no hay datos públicos por hora para Gómez Palacio). Coinciden con
     observaciones publicadas para la Zona Metropolitana de La Laguna (Observatorio de La Laguna / CCI Laguna, 26/06/2025): robos con
     violencia más frecuentes en horario vespertino y nocturno, y violencia familiar concentrada en domingo de 18:00 a 24:00.
   - Peso de cada zona: población estimada (INEGI 2020 repartida por densidad de calles de OSM; en zona rural, población INEGI de
     las localidades cercanas) y actividad comercial (comercios y servicios de OSM). No se usa ningún dato delictivo por colonia. */
(function () {
  "use strict";
  // Tipo del modelo -> [etiqueta, prioridad 911, renglón(es) SESNSP 2025 usados para su participación, perfil por hora 0..23, factor por día [lun-jue, vie, sáb, dom], impulsor]
  const TIPOS = {
    violencia_familiar: { etq: "Violencia familiar", prio: "alta", sesnsp: ["Violencia familiar"], imp: "res",
      h: [0.9,0.7,0.5,0.35,0.25,0.25,0.35,0.5,0.6,0.65,0.7,0.75,0.8,0.85,0.9,1.0,1.1,1.25,1.5,1.7,1.8,1.75,1.5,1.2], d: [0.9,1.0,1.2,1.4], rural: 1.0 },
    lesiones: { etq: "Riña / lesiones dolosas", prio: "alta", sesnsp: ["Lesiones dolosas"], imp: "res",
      h: [1.6,1.5,1.3,1.0,0.6,0.35,0.3,0.35,0.45,0.5,0.6,0.7,0.8,0.85,0.9,0.95,1.0,1.1,1.3,1.5,1.7,1.85,1.9,1.8], d: [0.8,1.1,1.5,1.4], rural: 0.9 },
    narcomenudeo: { etq: "Narcomenudeo (reporte ciudadano)", prio: "baja", sesnsp: ["Narcomenudeo"], imp: "res",
      h: [1.3,1.1,0.9,0.6,0.4,0.3,0.3,0.4,0.6,0.7,0.8,0.9,1.0,1.0,1.0,1.1,1.2,1.3,1.4,1.5,1.6,1.6,1.5,1.4], d: [1.0,1.05,1.1,1.0], rural: 0.6 },
    amenazas: { etq: "Amenazas", prio: "media", sesnsp: ["Amenazas"], imp: "res",
      h: [0.6,0.4,0.3,0.2,0.2,0.3,0.5,0.8,1.0,1.2,1.3,1.3,1.3,1.3,1.3,1.3,1.3,1.3,1.4,1.4,1.3,1.1,0.9,0.7], d: [1.0,1.0,1.05,1.05], rural: 0.9 },
    danio: { etq: "Daño a la propiedad", prio: "baja", sesnsp: ["Daño a la propiedad"], imp: "res",
      h: [1.4,1.4,1.3,1.1,0.8,0.6,0.5,0.6,0.7,0.8,0.8,0.8,0.9,0.9,0.9,0.9,1.0,1.0,1.1,1.2,1.3,1.4,1.5,1.5], d: [0.95,1.0,1.15,1.1], rural: 0.8 },
    robo_casa: { etq: "Robo a casa habitación", prio: "alta", sesnsp: ["Robo a casa habitación"], imp: "res",
      h: [0.4,0.35,0.3,0.3,0.3,0.4,0.6,1.0,1.4,1.6,1.7,1.7,1.6,1.5,1.5,1.5,1.4,1.3,1.1,0.9,0.7,0.6,0.5,0.45], d: [1.1,1.0,0.85,0.8], rural: 0.8 },
    robo_negocio: { etq: "Robo a negocio", prio: "alta", sesnsp: ["Robo a negocio"], imp: "com",
      h: [0.6,0.5,0.4,0.3,0.3,0.3,0.4,0.6,0.8,1.0,1.1,1.2,1.2,1.2,1.2,1.2,1.3,1.4,1.6,1.8,1.9,1.7,1.2,0.8], d: [1.05,1.05,0.95,0.8], rural: 0.35 },
    robo_transeunte: { etq: "Robo a transeúnte", prio: "alta", sesnsp: ["Robo a transeúnte"], imp: "com",
      h: [0.9,0.6,0.4,0.3,0.3,0.4,0.7,0.9,0.9,0.8,0.8,0.9,1.0,1.1,1.1,1.1,1.2,1.4,1.8,2.0,2.0,1.8,1.5,1.2], d: [1.0,1.1,1.1,0.9], rural: 0.3 },
    otros_robos: { etq: "Robo (otros)", prio: "media", sesnsp: ["Otros robos"], imp: "com",
      h: [0.7,0.6,0.5,0.4,0.4,0.5,0.7,0.9,1.0,1.1,1.1,1.2,1.2,1.2,1.2,1.2,1.2,1.3,1.4,1.4,1.3,1.2,1.0,0.8], d: [1.0,1.0,1.0,0.95], rural: 0.5 },
    robo_vehiculo: { etq: "Robo de vehículo", prio: "media", sesnsp: ["Robo de vehículo automotor (coche y moto)"], imp: "mix",
      h: [1.8,1.9,1.9,1.8,1.5,1.1,0.7,0.5,0.5,0.5,0.6,0.6,0.6,0.6,0.6,0.6,0.7,0.8,0.9,1.1,1.3,1.5,1.6,1.7], d: [0.95,1.05,1.15,1.05], rural: 0.6 },
    accidente: { etq: "Accidente vial", prio: "alta", sesnsp: ["Lesiones culposas", "Homicidio culposo"], imp: "mix",
      h: [0.8,0.7,0.6,0.5,0.4,0.5,0.9,1.4,1.5,1.1,0.9,1.0,1.2,1.4,1.5,1.3,1.2,1.3,1.6,1.5,1.3,1.1,1.0,0.9], d: [0.95,1.1,1.2,1.1], rural: 1.0 },
  };
  const DIAS = ["Lunes a jueves", "Viernes", "Sábado", "Domingo"];
  for (const t of Object.values(TIPOS)) { const m = t.h.reduce((a, b) => a + b, 0) / 24; t.h = t.h.map((x) => x / m); }

  // Fracción de la actividad diurna que se desplaza a zonas comerciales (población flotante: trabajo, compras, transporte).
  // SUPUESTO del modelo; no aplica a violencia familiar ni a robo a casa habitación (ligados al domicilio).
  const ACTIVIDAD = [0.10,0.08,0.06,0.05,0.05,0.08,0.20,0.40,0.55,0.60,0.65,0.70,0.70,0.70,0.65,0.65,0.65,0.60,0.55,0.45,0.35,0.25,0.18,0.12];
  const SIN_DESPLAZAMIENTO = new Set(["violencia_familiar", "robo_casa"]);
  let Z = [], conteos = {}, maxGlobal = [1, 1, 1, 1];

  function iniciar(zonas, sesnsp) {
    const p25 = sesnsp.periodos.find((p) => p.id === "2025");
    const dest = Object.fromEntries(p25.destacados);
    conteos = {};
    for (const [k, t] of Object.entries(TIPOS)) conteos[k] = t.sesnsp.reduce((a, n) => a + (dest[n] || 0), 0);
    const urb = zonas.filter((z) => z.tipo !== "rural");
    const comMedia = urb.reduce((a, z) => a + (z.com || 0), 0) / urb.length;
    const pobTotal = zonas.reduce((a, z) => a + z.pob, 0), pobUrb = urb.reduce((a, z) => a + z.pob, 0);
    const actUrb = urb.reduce((a, z) => a + (z.com || 0) + 5, 0);
    Z = zonas.map((z) => {
      const rural = z.tipo === "rural", c = rural ? 0 : ((z.com || 0) + 5) / (comMedia + 5);
      const pobS = z.pob / pobTotal, actS = rural ? pobS : (((z.com || 0) + 5) / actUrb) * (pobUrb / pobTotal);
      return { ...z, c, pobS, actS, w: Array.from({ length: 24 }, () => ({})) };
    });
    for (const [k, t] of Object.entries(TIPOS)) {
      for (let h = 0; h < 24; h++) {
        const a = SIN_DESPLAZAMIENTO.has(k) ? 0 : ACTIVIDAD[h];
        let s = 0;
        for (const z of Z) {
          const f = z.tipo === "rural" ? t.rural : t.imp === "res" ? 1 : t.imp === "com" ? 0.4 + 0.6 * z.c : 0.7 + 0.3 * z.c;
          z.w[h][k] = ((1 - a) * z.pobS + a * z.actS) * f; s += z.w[h][k];
        }
        for (const z of Z) z.w[h][k] /= s; // la suma sobre zonas reproduce la participación SESNSP del tipo
      }
    }
    maxGlobal = [0, 1, 2, 3].map((d) => Math.max(...Array.from({ length: 24 }, (_, h) => Math.max(...Z.map((z) => riesgoZona(z, h, d).total)))));
  }

  // Carpetas "esperadas" del modelo en esa zona, a esa hora, en un año (escala de las cifras reales 2025)
  function riesgoZona(z, h, d) {
    const porTipo = {}; let total = 0;
    for (const [k, t] of Object.entries(TIPOS)) { const v = conteos[k] * z.w[h][k] * (t.h[h] / 24) * t.d[d]; porTipo[k] = v; total += v; }
    return { total, porTipo };
  }
  function ranking(h, d) {
    return Z.map((z) => { const r = riesgoZona(z, h, d); return { z, ...r, rel: r.total / maxGlobal[d] }; }).sort((a, b) => b.total - a.total);
  }
  function totalHora(h, d) { return Z.reduce((a, z) => a + riesgoZona(z, h, d).total, 0); }
  function principal(porTipo) { return Object.entries(porTipo).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => TIPOS[k].etq); }
  function elegir(pesos) { // muestreo proporcional
    const s = pesos.reduce((a, [, p]) => a + p, 0); let r = Math.random() * s;
    for (const [v, p] of pesos) { r -= p; if (r <= 0) return v; }
    return pesos[pesos.length - 1][0];
  }
  function incidenteAleatorio(h, d) { // zona y tipo según el modelo (más probable donde y cuando el riesgo estimado es mayor)
    const rk = ranking(h, d);
    const fila = elegir(rk.map((r) => [r, r.total]));
    const tipo = elegir(Object.entries(fila.porTipo));
    return { zona: fila.z, tipo, etq: TIPOS[tipo].etq, prio: TIPOS[tipo].prio };
  }

  // Despliegue preventivo: reparto proporcional al riesgo de la hora (método de cocientes / D'Hondt) con mínimo 1 unidad por sector
  // urbano; las unidades rurales se quedan en su sector (Lavín, Sacramento, rural centro-norte). Asignación unidad-zona por cercanía.
  function desplegar(unidades, h, d, dist) {
    const asign = new Map();
    const porGrupo = new Map();
    for (const u of unidades) { const g = u.rural ? u.sector : "urbano"; if (!porGrupo.has(g)) porGrupo.set(g, []); porGrupo.get(g).push(u); }
    const rk = ranking(h, d);
    for (const [g, us] of porGrupo) {
      const zonas = rk.filter((r) => (g === "urbano" ? r.z.tipo !== "rural" : r.z.sector === g));
      if (!zonas.length || !us.length) continue;
      const n = new Map(zonas.map((r) => [r.z.id, 0])), slots = [];
      if (g === "urbano") { // mínimo de cobertura: la zona de mayor riesgo de cada sector urbano
        const sectores = [...new Set(zonas.map((r) => r.z.sector))];
        for (const s of sectores) { if (slots.length >= us.length) break; const r = zonas.find((x) => x.z.sector === s); slots.push(r.z); n.set(r.z.id, 1); }
      }
      while (slots.length < us.length) {
        let mejor = null, v = -1;
        for (const r of zonas) { const q = r.total / (n.get(r.z.id) + 1); if (q > v) { v = q; mejor = r; } }
        slots.push(mejor.z); n.set(mejor.z.id, n.get(mejor.z.id) + 1);
      }
      // emparejamiento voraz por distancia (con preferencia por la zona actual para no mover unidades sin necesidad)
      const pares = [];
      us.forEach((u, i) => slots.forEach((z, j) => pares.push([dist([u.lat, u.lon], [z.lat, z.lon]) - (u.zona === z.id ? 1500 : 0), i, j])));
      pares.sort((a, b) => a[0] - b[0]);
      const uU = new Set(), uS = new Set();
      for (const [, i, j] of pares) { if (uU.has(i) || uS.has(j)) continue; uU.add(i); uS.add(j); asign.set(us[i].codigo, slots[j].id); }
    }
    return asign;
  }

  window.DGI_MODELO = { TIPOS, DIAS, iniciar, riesgoZona, ranking, totalHora, principal, incidenteAleatorio, desplegar,
    ACTIVIDAD, zonas: () => Z, conteos: () => conteos, maxGlobal: () => maxGlobal };
})();
