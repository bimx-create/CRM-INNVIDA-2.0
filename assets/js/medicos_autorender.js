
// medicos_autorender.js — v9
// Si tu app ya define window.renderMedicos(docs), esto NO hace nada.
// Si no existe, este archivo pinta una tabla básica con los campos principales.

(function(){
  function ensureTableRoot(){
    // Busca una tabla en la sección principal
    let table = document.querySelector("main table");
    if (!table) {
      // crea contenedor y tabla básica si no existe
      const container = document.querySelector("main .container") || document.querySelector("main") || document.body;
      const wrap = document.createElement("div");
      wrap.id = "__medicosTableWrap";
      wrap.style.marginTop = "12px";
      wrap.innerHTML = `
        <div class="card" style="background:#0b1220;border-radius:12px;padding:8px;overflow:auto">
          <table id="__medicosTable" style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="color:#9ab; font-weight:600">
                <th style="text-align:left;padding:8px">Nombre</th>
                <th style="text-align:left;padding:8px">Teléfono</th>
                <th style="text-align:left;padding:8px">Dirección</th>
                <th style="text-align:left;padding:8px">Hospital</th>
                <th style="text-align:left;padding:8px">Especialidad</th>
                <th style="text-align:left;padding:8px">Estado</th>
                <th style="text-align:left;padding:8px">Región</th>
                <th style="text-align:left;padding:8px">KAM</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>`;
      container.appendChild(wrap);
      table = wrap.querySelector("table");
    }
    return table;
  }

  function fmt(x){ return (x==null ? "" : String(x)); }

  function basicRender(docs){
    const table = ensureTableRoot();
    const tbody = table.querySelector("tbody");
    tbody.innerHTML = "";
    // pinta máximo 20 para no saturar
    const rows = (docs||[]).slice(0, 20);
    for(const m of rows){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="padding:8px;color:#e5eefb">${fmt(m.nombre)}</td>
        <td style="padding:8px;color:#cde">${fmt(m.telefono)}</td>
        <td style="padding:8px;color:#cde">${fmt(m.direccion)}</td>
        <td style="padding:8px;color:#cde">${fmt(m.hospital)}</td>
        <td style="padding:8px;color:#cde">${fmt(m.especialidad)}</td>
        <td style="padding:8px;color:#cde">${fmt(m.estado)}</td>
        <td style="padding:8px;color:#cde">${fmt(m.region)}</td>
        <td style="padding:8px;color:#cde">${fmt(m.kam)}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function handleSnapshot(ev){
    const data = ev && ev.detail ? ev.detail.docs : (window.__medicosDocs || []);
    if (typeof window.renderMedicos === "function") return; // tu renderer propio ya se encarga
    basicRender(data);
    // badge pequeño para origen
    const fromCache = ev && ev.detail ? !!ev.detail.fromCache : false;
    let badge = document.getElementById("__rtBadge");
    if(!badge){
      badge = document.createElement("div");
      badge.id = "__rtBadge";
      badge.style.cssText = "position:fixed;left:12px;bottom:12px;background:#0b1220;color:#a6e3d0;border:1px solid #134e4a;padding:6px 10px;border-radius:10px;font:12px system-ui;z-index:9999;opacity:.9";
      document.body.appendChild(badge);
    }
    badge.textContent = (data.length||0) + " médicos " + (fromCache ? "(caché)" : "(red)");
  }

  // primer intento si ya hay docs
  if (Array.isArray(window.__medicosDocs)) {
    handleSnapshot({ detail: { docs: window.__medicosDocs, fromCache: false } });
  }

  // escucha actualizaciones en tiempo real
  document.addEventListener("medicos:snapshot", handleSnapshot);
})();
