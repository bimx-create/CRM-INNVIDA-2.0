// kam-drilldown.js — Modal de detalle individual de KAM con gráficas y tabla de médicos

(function() {
  let _drillEspChart = null;
  let _drillSegChart = null;
  let _currentKam = null;
  let _allMedicos = [];

  const STAGE_LABELS = {
    'nuevo':       'Nuevo contacto',
    'contactado':  'Contactado',
    'cita':        'Cita agendada',
    'presentacion':'Presentación',
    'seguimiento': 'En seguimiento',
    'cerrado':     'Cerrado / Ganado',
    'perdido':     'Perdido'
  };

  const STAGE_COLORS = {
    'nuevo':       '#06b6d4',
    'contactado':  '#3b82f6',
    'cita':        '#8b5cf6',
    'presentacion':'#f59e0b',
    'seguimiento': '#10b981',
    'cerrado':     '#22c55e',
    'perdido':     '#ef4444'
  };

  function mapEstadoToStage(estado) {
    const s = (estado || '').toLowerCase();
    if (s.includes('cerr') || s.includes('acept') || s.includes('confirm')) return 'cerrado';
    if (s.includes('perdi') || s.includes('cancel')) return 'perdido';
    if (s.includes('cita')) return 'cita';
    if (s.includes('present')) return 'presentacion';
    if (s.includes('seguim')) return 'seguimiento';
    if (s.includes('contact')) return 'contactado';
    return 'nuevo';
  }

  function destroyChart(ref) {
    if (ref) { try { ref.destroy(); } catch(_) {} }
    return null;
  }

  window.openKamDrilldown = function() {
    // Leer el KAM seleccionado del panel lateral
    const kamNameEl = document.getElementById('kdName');
    if (!kamNameEl || !kamNameEl.textContent.trim()) {
      alert('Por favor selecciona un KAM primero.');
      return;
    }
    const displayName = kamNameEl.textContent.trim();
    const norm = (k) => window.normalizeKAM ? window.normalizeKAM(k) : (k||'').trim().toUpperCase();
    const kamNorm = norm(displayName);
    _currentKam = { displayName, kamNorm };

    // Obtener datos
    const allMedicos = window.MED_BASE || [];
    const hist = window.__hist_cache__ || [];

    const myMedicos = allMedicos.filter(m => norm(m['GERENTE/KAM'] || m.kam) === kamNorm);
    const mySegs = hist.filter(s => norm(s.kam) === kamNorm);

    _allMedicos = myMedicos;

    // KPIs resumen
    const kpiPills = [
      { icon: '🩺', label: 'Médicos en Cartera', value: myMedicos.length, color: '#0A6EBD' },
      { icon: '📋', label: 'Seguimientos', value: mySegs.length, color: '#7C3AED' },
      { icon: '🏥', label: 'Hospitales únicos', value: new Set(myMedicos.map(m => m['Hospital'] || m.hospital || '').filter(Boolean)).size, color: '#10B981' }
    ];

    document.getElementById('drilldownKamName').textContent = displayName;
    document.getElementById('drilldownKamSubtitle').textContent =
      `${myMedicos.length} médicos · ${mySegs.length} seguimientos registrados`;

    document.getElementById('drilldownKPIs').innerHTML = kpiPills.map(p => `
      <div style="background:rgba(255,255,255,0.04); border:1px solid var(--border2); border-radius:14px; padding:16px 18px; display:flex; align-items:center; gap:14px;">
        <div style="font-size:28px;">${p.icon}</div>
        <div>
          <div style="font-size:26px; font-weight:800; color:${p.color}; line-height:1;">${p.value}</div>
          <div style="font-size:12px; color:var(--text2); margin-top:3px;">${p.label}</div>
        </div>
      </div>
    `).join('');

    // Mostrar modal
    const modal = document.getElementById('modalKamDrilldown');
    modal.style.display = 'flex';

    // Gráfica 1: Médicos por Especialidad (top 7 horizontal bars)
    setTimeout(() => {
      const espMap = {};
      myMedicos.forEach(m => {
        const e = m['Especialidad'] || m.especialidad || 'Sin especialidad';
        espMap[e] = (espMap[e] || 0) + 1;
      });
      const sortedEsp = Object.entries(espMap).sort((a,b) => b[1]-a[1]).slice(0, 7);
      const espLabels = sortedEsp.map(e => e[0].length > 20 ? e[0].slice(0,20)+'…' : e[0]);
      const espValues = sortedEsp.map(e => e[1]);

      _drillEspChart = destroyChart(_drillEspChart);
      const ctxEsp = document.getElementById('drillChartEsp');
      if (ctxEsp) {
        _drillEspChart = new Chart(ctxEsp, {
          type: 'bar',
          data: {
            labels: espLabels,
            datasets: [{
              label: 'Médicos',
              data: espValues,
              backgroundColor: 'rgba(10,110,189,0.7)',
              borderColor: '#0A6EBD',
              borderWidth: 1,
              borderRadius: 6
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: '#8492a6', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
              y: { ticks: { color: '#c1c9d2', font: { size: 10 } }, grid: { display: false } }
            }
          }
        });
      }

      // Gráfica 2: Seguimientos por Etapa Kanban (donut)
      const segStages = {};
      myMedicos.forEach(m => {
        const nombre = m['Nombre'] || m.nombre || '';
        const regs = hist.filter(h => h.medico === nombre || h.medicoId === m.id);
        const last = regs.length ? regs[regs.length - 1] : null;
        const stage = last ? mapEstadoToStage(last.estado) : 'nuevo';
        segStages[stage] = (segStages[stage] || 0) + 1;
      });
      const segLabels = Object.keys(segStages).map(s => STAGE_LABELS[s] || s);
      const segValues = Object.values(segStages);
      const segColors = Object.keys(segStages).map(s => STAGE_COLORS[s] || '#8492a6');

      _drillSegChart = destroyChart(_drillSegChart);
      const ctxSeg = document.getElementById('drillChartSeg');
      if (ctxSeg) {
        _drillSegChart = new Chart(ctxSeg, {
          type: 'doughnut',
          data: {
            labels: segLabels,
            datasets: [{
              data: segValues,
              backgroundColor: segColors,
              borderWidth: 2,
              borderColor: 'rgba(0,0,0,0.3)'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
              legend: {
                position: 'right',
                labels: { color: '#c1c9d2', font: { size: 11 }, padding: 10, boxWidth: 12 }
              }
            }
          }
        });
      }

      // Tabla de médicos
      renderDrillTable(myMedicos, hist);

    }, 100);
  };

  function renderDrillTable(medicos, hist, q = '') {
    const norm = (v) => (v||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
    const filtered = q
      ? medicos.filter(m => {
          const txt = [m['Nombre'], m.nombre, m['Hospital'], m.hospital, m['Especialidad'], m.especialidad].join(' ');
          return norm(txt).includes(norm(q));
        })
      : medicos;

    const tbody = document.getElementById('drillTbodyMedicos');
    if (!tbody) return;

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text2);">Sin resultados</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(m => {
      const nombre = m['Nombre'] || m.nombre || '—';
      const hosp = m['Hospital'] || m.hospital || '—';
      const esp = m['Especialidad'] || m.especialidad || '—';
      const est = m['Estado'] || m.estado || '—';
      const tel = m['Teléfono'] || m.telefono || '—';

      // Última etapa kanban
      const regs = hist.filter(h => h.medico === nombre || h.medicoId === m.id);
      const last = regs.length ? regs[regs.length - 1] : null;
      const stage = last ? mapEstadoToStage(last.estado) : 'nuevo';
      const stageLabel = STAGE_LABELS[stage] || stage;
      const stageColor = STAGE_COLORS[stage] || '#8492a6';

      return `<tr>
        <td><div style="font-weight:600;color:var(--text1);">${nombre}</div></td>
        <td>
          <div style="color:var(--text1);">${hosp}</div>
          <div style="font-size:12px;color:var(--text2);">${esp}</div>
        </td>
        <td>${est}</td>
        <td style="font-size:13px;color:var(--text2);">${tel}</td>
        <td>
          <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${stageColor}22;color:${stageColor};border:1px solid ${stageColor}55;">
            ${stageLabel}
          </span>
        </td>
      </tr>`;
    }).join('');
  }

  // Buscador en la tabla del modal
  document.addEventListener('DOMContentLoaded', () => {
    const searchEl = document.getElementById('drillSearchMed');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        if (_currentKam) {
          renderDrillTable(_allMedicos, window.__hist_cache__ || [], searchEl.value);
        }
      });
    }

    // Cerrar al click fuera del contenido
    const modal = document.getElementById('modalKamDrilldown');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }
  });

})();
