
// table_fallback_renderer.js — pinta la tabla si el renderer original no lo hace
(function(){
  function q(sel){ return document.querySelector(sel); }
  function tbody(){ return q('#tableMedicos tbody, #tbody-medicos'); }
  function rowCount(){ const tb = tbody(); return tb ? tb.querySelectorAll('tr').length : 0; }

  function renderFallback(){
    const tb = tbody();
    if (!tb) return;
    const rows = Array.isArray(window.MED_BASE) ? window.MED_BASE : [];
    if (!rows.length) return;

    // Limpia
    tb.innerHTML = "";
    const cols = ['Nombre','Teléfono','Dirección','Hospital','Red Social','Especialidad','Base','Estado','Región','GERENTE/KAM','Seguimiento'];

    rows.forEach(r => {
      const tr = document.createElement('tr');
      cols.forEach(c => {
        const td = document.createElement('td');
        if (c === 'Seguimiento'){
          td.innerHTML = `<button type="button" class="btn btn-seg" data-id="${r._id||''}">+ Seguimiento</button>`;
        } else {
          td.textContent = (r[c] ?? '').toString();
        }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });

    // Contador
    try{
      const badge = document.getElementById('medCount');
      if (badge) badge.textContent = rows.length + ' médicos';
    }catch(_){}
  }

  function tryRender(){
    if (!Array.isArray(window.MED_BASE) || window.MED_BASE.length === 0) return;
    const anyRenderer = (typeof window.applyMedFilters === 'function') || (typeof window.renderMedicos === 'function');
    if (anyRenderer){
      // Deja al renderer original una oportunidad; si no pinta, pintamos nosotros
      setTimeout(() => { if (rowCount() === 0) renderFallback(); }, 250);
    } else {
      renderFallback();
    }
  }

  // al llegar MED_BASE desde firebase_medicos.js
  const obs = new MutationObserver(() => {
    tryRender();
  });
  window.addEventListener('load', tryRender);
  setInterval(tryRender, 800); // watchdog suave
})();
