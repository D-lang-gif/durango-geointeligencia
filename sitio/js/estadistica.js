/* Durango GeoInteligencia v3 — pestaña "Estadística oficial (SESNSP)". Muestra las cifras REALES tal como vienen en los
   datos abiertos del SESNSP (fuero común, nivel municipal, Gómez Palacio 10007). No se estima ni se completa ningún valor. */
(function () {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (n) => Number(n).toLocaleString("es-MX");
  const MES = (m) => m.slice(0, 3);

  function barras(filas, max, clase) {
    return filas.map(([k, v]) => `<div class="fila-barra ${clase || ""}"><span class="etq">${esc(k)}</span>
      <span class="barra-fondo"><span class="barra-val" style="width:${max ? Math.max(1.5, (100 * v) / max) : 0}%"></span></span><b>${num(v)}</b></div>`).join("");
  }

  function render(cont, S) {
    if (!S) { cont.innerHTML = '<p class="aviso-corto">No se pudo cargar la estadística oficial.</p>'; return; }
    let actual = S.periodos[0].id;
    const pintar = () => {
      const p = S.periodos.find((x) => x.id === actual);
      const dest = [...p.destacados].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
      const maxMes = Math.max(...p.por_mes);
      cont.innerHTML = `
        <div class="sesnsp-cab">
          <h2>📊 Estadística oficial (SESNSP)</h2>
          <p class="sub">Delitos del fuero común registrados en <b>${esc(S.municipio)}</b> (clave ${esc(S.clave)}). Cifras reales, sin estimaciones.</p>
          <div class="selector-periodo" role="tablist">${S.periodos.map((x) => `<button type="button" data-p="${x.id}" class="${x.id === actual ? "activo" : ""}">${esc(x.titulo)}</button>`).join("")}</div>
        </div>
        <div class="tarjetas sesnsp-tarjetas">
          <div class="tarjeta"><span class="num">${num(p.total)}</span><span class="lbl">Delitos registrados · ${esc(p.titulo)}</span></div>
          <div class="tarjeta"><span class="num">${num(Math.round(p.total / p.meses.length))}</span><span class="lbl">Promedio mensual</span></div>
          <div class="tarjeta"><span class="num">${num(p.robos_con_violencia)}</span><span class="lbl">Robos con violencia</span></div>
          <div class="tarjeta"><span class="num">${num(p.accidentes_transito.lesiones_culposas + p.accidentes_transito.homicidio_culposo)}</span><span class="lbl">Lesiones y homicidios culposos en accidente de tránsito</span></div>
        </div>
        <section class="bloque"><h3>Principales delitos y subtipos</h3>${barras(dest, dest[0][1])}</section>
        <section class="bloque"><h3>Por mes (${esc(p.titulo)})</h3>
          <div class="grafica-meses">${p.por_mes.map((v, i) => `<div class="col" title="${esc(p.meses[i])}: ${num(v)}"><span class="v">${num(v)}</span><span class="b" style="height:${maxMes ? (100 * v) / maxMes : 0}%"></span><span class="m">${MES(p.meses[i])}</span></div>`).join("")}</div>
        </section>
        <details class="bloque"><summary>Todos los tipos de delito (${p.por_tipo.length})</summary>${barras(p.por_tipo, p.por_tipo[0][1], "chica")}</details>
        <section class="bloque"><h3>Total anual (metodología 2015–2025)</h3>${barras(Object.entries(S.totales_anuales), Math.max(...Object.values(S.totales_anuales)))}</section>
        <section class="fuentes">
          <p><strong>Fuente:</strong> ${esc(S.fuente)}. <a href="${esc(S.pagina)}" target="_blank" rel="noopener">gob.mx/sesnsp · Datos abiertos de incidencia delictiva</a>.</p>
          <p><strong>Archivo:</strong> ${esc(p.archivo)} · <strong>${esc(p.metodologia)}</strong>. <strong>Consultado:</strong> ${esc(S.consultado)}.</p>
          <p>${esc(S.nota)} Por eso las zonas y horarios de riesgo del mapa son un <b>modelo estimado (simulación)</b>, no datos oficiales por colonia u hora.</p>
        </section>`;
      cont.querySelectorAll(".selector-periodo button").forEach((b) => b.addEventListener("click", () => { actual = b.dataset.p; pintar(); }));
    };
    pintar();
  }
  window.DGI_ESTADISTICA = { render };
})();
