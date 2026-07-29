// kam-dashboard.js — KPIs en tiempo real por KAM desde Firestore + datos locales

(function () {
  'use strict';

  /* ── Helpers ────────────────────────────────────────────────────── */
  const fmt  = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
  const pct  = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(1) : '0.0') + '%';
  const safe = (v) => (isNaN(v) || !isFinite(v) ? 0 : v);

  /* ── Color de estado seguimiento ─────────────────────────────── */
  function statusColor(s) {
    const v = (s || '').toLowerCase();
    if (v.includes('cerrado') || v.includes('confirm')) return 'green';
    if (v.includes('negoci') || v.includes('cita') || v.includes('seguimiento') || v.includes('contact')) return 'amber';
    if (v.includes('sin respuesta') || v.includes('cancel') || v.includes('perdido')) return 'red';
    return 'gray';
  }

  /* ── KAMs ocultos (administradores / cuentas internas) ──────────────────── */
  const HIDDEN_KAMS = new Set([
    'ALEXIS', 'AMÉRICA GÓMEZ', 'AMERICA GOMEZ', 'EFRAIN',
    'JOAN SERRANO', 'KAM@EMPRESA.COM', 'LEONEL CASTILLEJOS',
    'MANUEL AGUIRRE', 'MONICA', 'MÓNICA', 'RAYMUNDO ACUÑA'
  ]);

  /* ── Mapa de aliases: variantes → nombre canónico ────────────────
     Agrega aquí cualquier nombre que esté capturado diferente en
     Firebase / cotizaciones vs el CRM.
  ──────────────────────────────────────────────────────────────── */
  const KAM_ALIAS = {
    'ANAYELI':          'ANAYELY TAPIA',
    'ANAYELI TAPIA':    'ANAYELY TAPIA',
    'ANAYELY':          'ANAYELY TAPIA',
    // Agrega más alias aquí si hay otros nombres mal capturados, ej:
    // 'BERENICE': 'BERENICE ORDAZ',
  };

  /* Normaliza un nombre de KAM a su forma canónica */
  window.normalizeKAM = function(k) {
    const upper = (k || '').trim().toUpperCase();
    return KAM_ALIAS[upper] || upper;
  };



  /* ── Extraer KAMs únicos ─────────────────────────────────────── */
  window.getKAMs = function () {
    const medicos = window.MED_BASE || [];
    const cots    = window.COT_BASE || [];
    const set = new Set();
    const norm = (k) => window.normalizeKAM ? window.normalizeKAM(k) : (k||'').trim().toUpperCase();
    medicos.forEach(m => { const k = norm(m['GERENTE/KAM'] || m.kam || ''); if (k) set.add(k); });
    cots.forEach(c    => { const k = norm(c['KAM'] || ''); if (k) set.add(k); });
    return Array.from(set)
      .filter(k => !HIDDEN_KAMS.has(k.toUpperCase()))
      .sort((a, b) => a.localeCompare(b, 'es'));
  };

  /* ── Filtrar datos por KAM y Tiempo ──────────────────────────── */
  window.filterData = function(kamName, timeFilter = 'all') {
    let medicos = window.MED_BASE || [];
    let localCots = window.COT_BASE || [];
    let sanareCots = window.SANARE_COTS || [];
    let nomadCots = window.NOMAD_COTS || [];

    // Filtrar por tiempo
    if (timeFilter !== 'all') {
      const now = new Date();
      let targetMonth, targetYear;
      if (timeFilter === 'current') {
        targetMonth = now.getMonth();
        targetYear = now.getFullYear();
      } else if (timeFilter === 'last') {
        targetMonth = now.getMonth() - 1;
        targetYear = now.getFullYear();
        if (targetMonth < 0) { targetMonth = 11; targetYear--; }
      }

      const isMatch = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d)) return false;
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
      };

      medicos = medicos.filter(m => isMatch(m['FECHA'] || m.fecha || m.createdAt));
      localCots = localCots.filter(c => isMatch(c['FECHA']));
      sanareCots = sanareCots.filter(c => isMatch(c.fechaEmision || c.createdAt));
      nomadCots = nomadCots.filter(c => isMatch(c.fechaEmision || c.createdAt));
    }

    // Filtrar por KAM
    if (kamName && kamName !== 'Todos') {
      const norm = (k) => window.normalizeKAM ? window.normalizeKAM(k) : (k||'').trim().toUpperCase();
      const target = norm(kamName);
      medicos = medicos.filter(m => norm(m['GERENTE/KAM'] || m.kam || '') === target);
      localCots = localCots.filter(c => norm(c['KAM'] || '') === target);
      sanareCots = sanareCots.filter(c => norm(c.kam || '') === target);
      nomadCots = nomadCots.filter(c => norm(c.kam || '') === target);
    }

    return { medicos, localCots, sanareCots, nomadCots };
  }

  /* ── Calcular KPIs Globales (Local + Sanare + Nomad) ───────────────────────────────────────────── */
  function calcKPIs(data) {
    const medicos = data.medicos || [];
    const localCots = data.localCots || [];
    const sanareCots = data.sanareCots || [];
    const nomadCots = data.nomadCots || [];

    const totalMed = medicos.length;
    let totalCot = localCots.length + sanareCots.length + nomadCots.length;
    
    let confirmadas = 0;
    let pendientes = 0;
    let totalValor = 0;
    let valorConf = 0;

    // Helper para limpiar valor
    const parseMonto = (v) => {
      const p = parseFloat((v || '0').toString().replace(/[^0-9.-]/g, ''));
      return isNaN(p) ? 0 : p;
    };
    
    const isConfirm = (s) => (s||'').toUpperCase().includes('CONFIRM') || (s||'').toUpperCase().includes('ACEPT');
    const isPend = (s) => (s||'').toUpperCase().includes('PENDIENT') || (s||'').toUpperCase().includes('PROCES');

    // Procesar Local
    localCots.forEach(c => {
      const v = parseMonto(c['VALOR']);
      const st = c['STATUS'];
      totalValor += v;
      if (isConfirm(st)) { confirmadas++; valorConf += v; }
      else if (isPend(st)) { pendientes++; }
    });

    // Procesar Sanaré
    sanareCots.forEach(c => {
      const v = parseMonto(c.total);
      const st = c.status1 || c.status;
      totalValor += v;
      if (isConfirm(st)) { confirmadas++; valorConf += v; }
      else if (isPend(st)) { pendientes++; }
    });

    // Procesar Nomad
    nomadCots.forEach(c => {
      const v = parseMonto(c.total);
      const st = c.status1 || c.status;
      totalValor += v;
      if (isConfirm(st)) { confirmadas++; valorConf += v; }
      else if (isPend(st)) { pendientes++; }
    });

    // Médicos con seguimiento reciente (≤30 días)
    const hist = window.__hist_cache__ || [];
    const now = Date.now();
    const recientemente = new Set(
      hist
        .filter(h => { try { return (now - new Date(h.fecha || h.createdAt || 0).getTime()) < 30 * 86400000; } catch { return false; } })
        .map(h => h.medicoId || h.medico)
    );
    const medActivos = medicos.filter(m => recientemente.has(m.id) || recientemente.has(m['Nombre'] || m.nombre || '')).length;

    return { totalMed, totalCot, confirmadas, pendientes, totalValor, valorConf, medActivos, 
             raw: { medicos, localCots, sanareCots, nomadCots } };
  }

  /* ── Renderizar KPI cards (Clickables) ─────────────────────────────────────── */
  window.renderKPIs = function (kamName) {
    const container = document.getElementById('kpiGrid');
    if (!container) return;

    // Obtener el valor del filtro de tiempo general del dashboard
    const filterEl = document.getElementById('chartTimeFilter');
    const timeFilter = filterEl ? filterEl.value : 'all';

    const data = filterData(kamName, timeFilter);
    const k = calcKPIs(data);
    const conv = pct(k.confirmadas, k.totalCot);

    // Guardamos la info raw en el window para el modal de drill-down
    window.__currentKpiData = k;
    window.__currentKamData = data;

    // Helper para generar el card interactivo
    const makeCard = (color, icon, val, title, sub, modalType) => `
      <div class="kpi-card ${color}" style="cursor: pointer; transition: transform 0.2s; position:relative;"
           onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.3)'"
           onmouseout="this.style.transform='none'; this.style.boxShadow=''"
           onclick="window.openKpiModal('${modalType}')">
        <div class="kpi-icon">${icon}</div>
        <div class="kpi-value">${val}</div>
        <div class="kpi-label">${title}</div>
        <div class="kpi-sub">${sub}</div>
        <div style="position:absolute; top:8px; right:8px; opacity:0.3;">
           <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8zm15 0A8 8 0 1 0 0 8a8 8 0 0 0 16 0zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>
        </div>
      </div>
    `;

    container.innerHTML = 
      makeCard('blue', '👨‍⚕️', k.totalMed.toLocaleString('es-MX'), 'Médicos en Cartera', `<span class="kpi-delta up">↑ ${k.medActivos} activos (30d)</span>`, 'medicos') +
      makeCard('green', '💰', fmt(k.totalValor), 'Pipeline Total', `Confirmado: ${fmt(k.valorConf)}`, 'pipeline') +
      makeCard('amber', '📋', k.totalCot.toLocaleString('es-MX'), 'Cotizaciones', `${k.pendientes} pendientes · ${k.confirmadas} confirmadas`, 'cotizaciones') +
      makeCard('violet', '📈', conv, 'Conversión', `${k.confirmadas} de ${k.totalCot} cotizaciones`, 'conversion') +
      makeCard('cyan', '🏥', [...new Set(k.raw.medicos.map(m => m['Hospital'] || m.hospital || '').filter(Boolean))].length, 'Hospitales Únicos', `${[...new Set(k.raw.medicos.map(m => m['Estado'] || m.estado || '').filter(Boolean))].length} estados`, 'hospitales');
  };

  /* ── Modal Drill-down por KPI ─────────────────────────────────────────────── */
  window.refreshKpiModal = function() {
    if (window.__currentModalType) {
      window.openKpiModal(window.__currentModalType, false);
    }
  };

  window.openKpiModal = function(type, resetFilter = true) {
    window.__currentModalType = type;
    
    const filterEl = document.getElementById('kpiModalTimeFilter');
    if (resetFilter && filterEl) {
      const mainFilter = document.getElementById('chartTimeFilter');
      filterEl.value = mainFilter ? mainFilter.value : 'all'; 
    }
    const timeFilter = filterEl ? filterEl.value : 'all';
    
    // Recalcular data fresca para el modal usando el filtro local del modal
    const data = filterData(window.__kamSelected || 'Todos', timeFilter);
    const k = calcKPIs(data);

    const modal   = document.getElementById('kpiDetailModal');
    const iconEl  = document.getElementById('kpiModalIcon');
    const titleEl = document.getElementById('kpiModalTitle');
    const subEl   = document.getElementById('kpiModalSubtitle');
    const bodyEl  = document.getElementById('kpiModalBody');
    if (!modal) return;

    const fmtV = (v) => new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', maximumFractionDigits:0 }).format(v || 0);
    const fmtN = (v) => (v || 0).toLocaleString('es-MX');

    // Helper para generar una fila de resumen con barra visual
    const row = (label, value, total, color) => {
      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
      return `<div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="color:var(--text2);font-size:13px;">${label}</span>
          <span style="font-weight:600;font-size:13px;color:var(--text1);">${value} <span style="color:var(--text2);font-size:11px;">(${pct}%)</span></span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,0.07);border-radius:99px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:width 0.4s;"></div>
        </div>
      </div>`;
    };

    const rowMoney = (label, value, total, color) => {
      const pct = total > 0 ? Math.round((value / total) * 100) : 0;
      return `<div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="color:var(--text2);font-size:13px;">${label}</span>
          <span style="font-weight:600;font-size:13px;color:var(--text1);">${fmtV(value)} <span style="color:var(--text2);font-size:11px;">(${pct}%)</span></span>
        </div>
        <div style="height:4px;background:rgba(255,255,255,0.07);border-radius:99px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:width 0.4s;"></div>
        </div>
      </div>`;
    };

    const section = (title, content) => `
      <div style="margin-bottom:20px;">
        <div style="font-size:11px;font-weight:700;color:var(--text2);letter-spacing:0.8px;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.07);">${title}</div>
        ${content}
      </div>`;

    let icon, title, subtitle, body = '';

    if (type === 'pipeline') {
      icon = '💰'; title = 'Pipeline Total'; subtitle = 'Desglose por empresa y estatus de cotizaciones';

      const { localCots, sanareCots, nomadCots } = k.raw;
      const parseMonto = (v) => { const p = parseFloat((v||'0').toString().replace(/[^0-9.-]/g,'')); return isNaN(p)?0:p; };

      // Calcular totales por empresa
      let tLocal=0, tSanare=0, tNomad=0;
      localCots.forEach(c => tLocal += parseMonto(c['VALOR']));
      sanareCots.forEach(c => tSanare += parseMonto(c.total));
      nomadCots.forEach(c => tNomad += parseMonto(c.total));
      const grand = tLocal + tSanare + tNomad;

      // Colores por estatus genérico
      const statusColor = (s) => {
        const u = (s||'').toUpperCase();
        if (u.includes('ACEPT') || u.includes('CONFIRM') || u.includes('CERRAD')) return '#10B981';
        if (u.includes('CANCEL') || u.includes('PERDI') || u.includes('RECHAZ')) return '#EF4444';
        if (u.includes('PENDI') || u.includes('PROCESO') || u.includes('NEGOCI')) return '#F59E0B';
        if (u.includes('ENVIADA') || u.includes('CONTACT')) return '#06b6d4';
        return '#6b7280';
      };

      // Función para generar un bloque de estatus por empresa
      const buildCompanyBlock = (label, cots, total, accentColor, getValFn, getStatusFn) => {
        const compMap = {};
        let compTotal = 0;
        cots.forEach(c => {
          const v = getValFn(c);
          const s = getStatusFn(c);
          if (!compMap[s]) compMap[s] = 0;
          compMap[s] += v;
          compTotal += v;
        });

        const pctComp = grand > 0 ? Math.round((compTotal / grand) * 100) : 0;

        // Mini donut chart inline SVG (simple arc-based)
        const sorted = Object.keys(compMap).sort((a,b) => compMap[b] - compMap[a]);
        const donutRadius = 32;
        const circumference = 2 * Math.PI * donutRadius;
        let svgArcs = '';
        let offset = circumference * 0.25; // start at top
        sorted.forEach(st => {
          const frac = compTotal > 0 ? compMap[st] / compTotal : 0;
          const dash = frac * circumference;
          const gap = circumference - dash;
          const color = statusColor(st);
          svgArcs += `<circle cx="40" cy="40" r="${donutRadius}" fill="none" stroke="${color}" stroke-width="8"
            stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
            stroke-dashoffset="${(-offset + circumference * 0.25).toFixed(2)}"
            style="transform:rotate(-90deg);transform-origin:40px 40px;"/>`;
          offset -= dash;
        });

        const statusRows = sorted.map(st => {
          const v = compMap[st];
          const p = compTotal > 0 ? Math.round((v/compTotal)*100) : 0;
          const color = statusColor(st);
          return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></div>
              <span style="color:var(--text2);font-size:12px;">${st}</span>
            </div>
            <div style="text-align:right;">
              <span style="font-weight:600;font-size:12px;color:var(--text1);">${fmtV(v)}</span>
              <span style="color:var(--text2);font-size:11px;margin-left:4px;">${p}%</span>
            </div>
          </div>`;
        }).join('');

        return `<div style="border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;margin-bottom:14px;background:rgba(255,255,255,0.02);">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <div style="width:12px;height:12px;border-radius:3px;background:${accentColor};flex-shrink:0;"></div>
            <div style="flex:1;">
              <span style="font-size:13px;font-weight:700;color:var(--text1);">${label}</span>
              <span style="font-size:11px;color:var(--text2);margin-left:8px;">${fmtV(compTotal)} · ${pctComp}% del total</span>
            </div>
          </div>
          <div style="display:flex;gap:16px;align-items:center;">
            <div style="flex-shrink:0;">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="${donutRadius}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
                ${svgArcs}
                <text x="40" y="44" text-anchor="middle" fill="var(--text1)" font-size="11" font-weight="700">${pctComp}%</text>
              </svg>
            </div>
            <div style="flex:1;">${statusRows || '<span style="color:var(--text2);font-size:12px;">Sin datos</span>'}</div>
          </div>
        </div>`;
      };

      const sectionSanare = buildCompanyBlock('Sanaré', sanareCots, grand, '#10B981',
        c => parseMonto(c.total),
        c => ((c.status1 || c.status || 'SIN ESTATUS')).toUpperCase().trim()
      );
      const sectionNomad = buildCompanyBlock('Nomad', nomadCots, grand, '#7C3AED',
        c => parseMonto(c.total),
        c => ((c.status1 || c.status || 'SIN ESTATUS')).toUpperCase().trim()
      );
      const sectionLocal = buildCompanyBlock('CRM Local', localCots, grand, '#0A6EBD',
        c => parseMonto(c['VALOR']),
        c => (c['STATUS'] || 'SIN ESTATUS').toUpperCase().trim()
      );

      // Mini chart de barras comparativo entre empresas
      const barChart = `
        <div style="margin-bottom:14px;">
          <div style="height:28px;border-radius:8px;overflow:hidden;display:flex;margin-bottom:8px;">
            <div title="Sanaré" style="width:${grand>0?Math.round(tSanare/grand*100):0}%;background:#10B981;transition:width 0.5s;"></div>
            <div title="Nomad" style="width:${grand>0?Math.round(tNomad/grand*100):0}%;background:#7C3AED;transition:width 0.5s;"></div>
            <div title="CRM Local" style="width:${grand>0?Math.round(tLocal/grand*100):0}%;background:#0A6EBD;transition:width 0.5s;"></div>
          </div>
          <div style="display:flex;gap:16px;font-size:11px;color:var(--text2);">
            <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#10B981;margin-right:4px;"></span>Sanaré ${grand>0?Math.round(tSanare/grand*100):0}%</span>
            <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#7C3AED;margin-right:4px;"></span>Nomad ${grand>0?Math.round(tNomad/grand*100):0}%</span>
            <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#0A6EBD;margin-right:4px;"></span>Local ${grand>0?Math.round(tLocal/grand*100):0}%</span>
          </div>
        </div>`;

      body = section('Resumen', `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:var(--text2);">TOTAL PIPELINE</div>
            <div style="font-size:20px;font-weight:700;color:#10B981;margin-top:4px;">${fmtV(grand)}</div>
          </div>
          <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:var(--text2);">CONFIRMADO</div>
            <div style="font-size:20px;font-weight:700;color:#10B981;margin-top:4px;">${fmtV(k.valorConf)}</div>
          </div>
        </div>
        ${barChart}
      `) +
      section('Desglose por empresa y estatus', sectionSanare + sectionNomad + sectionLocal);
    }

    else if (type === 'cotizaciones') {
      icon = '📋'; title = 'Cotizaciones'; subtitle = 'Desglose de cotizaciones registradas en todas las plataformas';
      const { localCots, sanareCots, nomadCots } = k.raw;
      const total = localCots.length + sanareCots.length + nomadCots.length;

      const empresaHTML = row('Sanaré', sanareCots.length, total, '#10B981') +
                          row('Nomad', nomadCots.length, total, '#7C3AED') +
                          row('CRM Local', localCots.length, total, '#0A6EBD');

      // Por estatus (conteo)
      const allCots = [
        ...localCots.map(c => (c['STATUS']||'SIN ESTATUS').toUpperCase().trim()),
        ...sanareCots.map(c => ((c.status1||c.status||'SIN ESTATUS')).toUpperCase().trim()),
        ...nomadCots.map(c => ((c.status1||c.status||'SIN ESTATUS')).toUpperCase().trim()),
      ];
      const stMap = {};
      allCots.forEach(s => { if(!stMap[s]) stMap[s]=0; stMap[s]++; });
      const statusHTML = Object.keys(stMap).sort((a,b)=>stMap[b]-stMap[a])
        .map(s => row(s, stMap[s], total, '#F59E0B')).join('');

      body = section('Resumen', `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:8px;">
        <div style="background:rgba(10,110,189,0.1);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:var(--text2);">LOCAL</div>
          <div style="font-size:22px;font-weight:700;color:#0A6EBD;">${localCots.length}</div>
        </div>
        <div style="background:rgba(34,197,94,0.1);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:var(--text2);">SANARÉ</div>
          <div style="font-size:22px;font-weight:700;color:#10B981;">${sanareCots.length}</div>
        </div>
        <div style="background:rgba(124,58,237,0.1);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:var(--text2);">NOMAD</div>
          <div style="font-size:22px;font-weight:700;color:#7C3AED;">${nomadCots.length}</div>
        </div>
      </div>`) +
      section('Por empresa', empresaHTML) +
      section('Por estatus', statusHTML);
    }

    else if (type === 'medicos') {
      icon = '👨‍⚕️'; title = 'Médicos en Cartera'; subtitle = 'Distribución de la cartera médica';
      const medicos = k.raw.medicos;
      const total = medicos.length;
      
      // Normalizadores
      const normEspecialidad = (raw) => {
        const str = raw || 'Sin especialidad';
        const u = str.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (u.includes('ONCO') || u.includes('ONCOL')) return 'Oncología';
        if (u.includes('HEMA') || u.includes('HEMAT')) return 'Hematología';
        if (u.includes('REUMA') || u.includes('REUMAT')) return 'Reumatología';
        if (u.includes('NEURO')) return 'Neurología';
        return str.split(' ').slice(0,2).join(' '); // Default behavior
      };

      const normEstado = (raw) => {
        const str = raw || 'Sin estado';
        const u = str.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (u === 'CDMX' || u === 'CIUDAD DE MEXICO' || u === 'DF' || u.includes('CIUDAD DE MEX')) return 'CDMX';
        if (u === 'EDOMEX' || u === 'ESTADO DE MEXICO' || u === 'MEXICO' || u === 'EDO MEX' || u === 'EDO DE MEX') return 'Estado de México';
        if (u === 'NUEVO LEON' || u === 'NL') return 'Nuevo León';
        // Capitalizar de forma bonita el resto
        return (raw || 'Sin estado').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      };

      // Por especialidad
      const espMap = {};
      medicos.forEach(m => {
        const esp = normEspecialidad(m['Especialidad'] || m.especialidad);
        if (!espMap[esp]) espMap[esp] = 0; espMap[esp]++;
      });
      const espHTML = Object.keys(espMap).sort((a,b)=>espMap[b]-espMap[a]).slice(0,8)
        .map(e => row(e, espMap[e], total, '#0A6EBD')).join('');

      // Por estado geográfico
      const stateMap = {};
      medicos.forEach(m => {
        const st = normEstado(m['Estado'] || m.estado);
        if (!stateMap[st]) stateMap[st]=0; stateMap[st]++;
      });
      const stateHTML = Object.keys(stateMap).sort((a,b)=>stateMap[b]-stateMap[a]).slice(0,8)
        .map(s => row(s, stateMap[s], total, '#06b6d4')).join('');

      body = section(`Top especialidades (${total} total)`, espHTML || '<span style="color:var(--text2)">Sin datos</span>') +
             section('Top estados', stateHTML || '<span style="color:var(--text2)">Sin datos</span>');
    }

    else if (type === 'conversion') {
      icon = '📈'; title = 'Tasa de Conversión'; subtitle = 'Cotizaciones cerradas vs totales por plataforma';
      const { localCots, sanareCots, nomadCots } = k.raw;

      const calcConv = (arr) => {
        const total = arr.length;
        const conf = arr.filter(c => {
          const s = (c['STATUS'] || c.status1 || c.status || '').toUpperCase();
          return s.includes('CONFIRM') || s.includes('ACEPT');
        }).length;
        return { total, conf, pct: total > 0 ? ((conf/total)*100).toFixed(1) : '0.0' };
      };

      const cLocal = calcConv(localCots), cSanare = calcConv(sanareCots), cNomad = calcConv(nomadCots);
      const global = { total: k.totalCot, conf: k.confirmadas, pct: pct(k.confirmadas, k.totalCot) };

      body = section('Conversión Global', `<div style="text-align:center;padding:12px 0;">
        <div style="font-size:48px;font-weight:800;color:#7C3AED;">${global.pct}</div>
        <div style="font-size:13px;color:var(--text2);margin-top:4px;">${global.conf} confirmadas de ${global.total} totales</div>
      </div>`) +
      section('Por plataforma', `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
          <div style="background:rgba(10,110,189,0.1);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:var(--text2);">LOCAL</div>
            <div style="font-size:22px;font-weight:700;color:#0A6EBD;">${cLocal.pct}%</div>
            <div style="font-size:11px;color:var(--text2);">${cLocal.conf}/${cLocal.total}</div>
          </div>
          <div style="background:rgba(34,197,94,0.1);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:var(--text2);">SANARÉ</div>
            <div style="font-size:22px;font-weight:700;color:#10B981;">${cSanare.pct}%</div>
            <div style="font-size:11px;color:var(--text2);">${cSanare.conf}/${cSanare.total}</div>
          </div>
          <div style="background:rgba(124,58,237,0.1);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:11px;color:var(--text2);">NOMAD</div>
            <div style="font-size:22px;font-weight:700;color:#7C3AED;">${cNomad.pct}%</div>
            <div style="font-size:11px;color:var(--text2);">${cNomad.conf}/${cNomad.total}</div>
          </div>
        </div>`);
    }

    else if (type === 'hospitales') {
      icon = '🏥'; title = 'Hospitales Únicos'; subtitle = 'Presencia por hospital y estado';
      const medicos = k.raw.medicos;
      const hospMap = {};
      medicos.forEach(m => {
        const h = m['Hospital'] || m.hospital;
        if (h) { if(!hospMap[h])hospMap[h]=0; hospMap[h]++; }
      });
      const total = Object.keys(hospMap).length;
      const hospHTML = Object.keys(hospMap).sort((a,b)=>hospMap[b]-hospMap[a]).slice(0,10)
        .map(h => row(h, hospMap[h], medicos.length, '#06b6d4')).join('');

      body = section(`Top 10 hospitales (${total} únicos, ${medicos.length} médicos)`, hospHTML || '<span style="color:var(--text2)">Sin datos</span>');
    }

    // Mostrar modal
    iconEl.textContent  = icon;
    titleEl.textContent = title;
    subEl.textContent   = subtitle;
    bodyEl.innerHTML    = body;
    modal.style.display = 'flex';
  };

  /* ── Renderizar gráficas Chart.js ─────────────────────────────── */
  let chartInstances = {};
  function destroyChart(id) {
    if (chartInstances[id]) { try { chartInstances[id].destroy(); } catch (_) {} delete chartInstances[id]; }
  }

  const CHART_COLORS = ['#0A6EBD','#7C3AED','#10B981','#F59E0B','#EF4444','#06b6d4','#f472b6'];
  const CHART_OPTIONS_BASE = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } },
      tooltip: { bodyFont: { family: 'Inter' }, titleFont: { family: 'Inter' } }
    },
    scales: {
      x: { ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }, grid: { color: 'rgba(255,255,255,0.06)' } }
    }
  };

  window.renderCharts = function (kamName) {
    const filterEl = document.getElementById('chartTimeFilter');
    const timeFilter = filterEl ? filterEl.value : 'all';
    const data = filterData(kamName, timeFilter);
    const { medicos, localCots, sanareCots, nomadCots } = data;

    const parseMonto = (v) => { const p = parseFloat((v||'0').toString().replace(/[^0-9.-]/g,'')); return isNaN(p)?0:p; };
    
    // Preparar totales por empresa
    let tLocal=0, tSanare=0, tNomad=0;
    localCots.forEach(c => tLocal += parseMonto(c['VALOR']));
    sanareCots.forEach(c => tSanare += parseMonto(c.total));
    nomadCots.forEach(c => tNomad += parseMonto(c.total));

    // Preparar estatus general (agrupando las 3 empresas)
    const statusMap = {};
    const addStatus = (arr, valFn, statusFn) => {
      arr.forEach(c => {
        const v = valFn(c);
        const s = statusFn(c).toUpperCase().trim();
        let group = 'OTROS';
        if (s.includes('ACEPT') || s.includes('CONFIRM') || s.includes('CERRAD')) group = 'CONFIRMADA';
        else if (s.includes('CANCEL') || s.includes('PERDI') || s.includes('RECHAZ')) group = 'CANCELADA/PERDIDA';
        else if (s.includes('PENDI') || s.includes('PROCESO') || s.includes('NEGOCI')) group = 'EN NEGOCIACIÓN';
        else if (s.includes('ENVIADA') || s.includes('CONTACT')) group = 'ENVIADA';
        
        if (!statusMap[group]) statusMap[group] = 0;
        statusMap[group] += v;
      });
    };
    addStatus(localCots, c => parseMonto(c['VALOR']), c => c['STATUS'] || 'SIN ESTATUS');
    addStatus(sanareCots, c => parseMonto(c.total), c => c.status1 || c.status || 'SIN ESTATUS');
    addStatus(nomadCots, c => parseMonto(c.total), c => c.status1 || c.status || 'SIN ESTATUS');

    /* 1. Pipeline por Empresa (Barra simple) */
    const ctxPipeline = document.getElementById('chartPipelineEmpresa');
    if (ctxPipeline) {
      destroyChart('pipeline');
      chartInstances['pipeline'] = new Chart(ctxPipeline.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Sanaré', 'Nomad', 'CRM Local'],
          datasets: [{
            data: [tSanare, tNomad, tLocal],
            backgroundColor: ['#10B981', '#7C3AED', '#0A6EBD'],
            borderRadius: 6,
            borderWidth: 0
          }]
        },
        options: {
          ...CHART_OPTIONS_BASE,
          plugins: {
            ...CHART_OPTIONS_BASE.plugins,
            legend: { display: false },
            tooltip: {
              callbacks: { label: (ctx) => ' ' + fmt(ctx.raw) }
            }
          },
          scales: {
            x: CHART_OPTIONS_BASE.scales.x,
            y: { ...CHART_OPTIONS_BASE.scales.y, ticks: { ...CHART_OPTIONS_BASE.scales.y.ticks, callback: (v) => '$' + (v/1000000).toFixed(1) + 'M' } }
          }
        }
      });
    }

    /* 2. Estatus del Pipeline (Doughnut) */
    const ctxStatus = document.getElementById('chartStatus');
    if (ctxStatus) {
      destroyChart('status');
      const labels = Object.keys(statusMap);
      const vals = Object.values(statusMap);
      const colors = labels.map(l => {
        if (l === 'CONFIRMADA') return '#10B981';
        if (l === 'CANCELADA/PERDIDA') return '#EF4444';
        if (l === 'EN NEGOCIACIÓN') return '#F59E0B';
        if (l === 'ENVIADA') return '#06b6d4';
        return '#6b7280';
      });

      chartInstances['status'] = new Chart(ctxStatus.getContext('2d'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
        options: {
          ...CHART_OPTIONS_BASE,
          scales: undefined,
          cutout: '65%',
          plugins: {
            ...CHART_OPTIONS_BASE.plugins,
            legend: { position: 'right', labels: { color: '#94a3b8', boxWidth: 12, font: { family: 'Inter', size: 11 } } },
            tooltip: { callbacks: { label: (ctx) => ' ' + fmt(ctx.raw) } }
          }
        }
      });
    }

    /* 3. Médicos por Estado (Top 10) */
    const ctxEstado = document.getElementById('chartEstado');
    if (ctxEstado) {
      destroyChart('estado');
      const counts = {};
      medicos.forEach(m => { const e = (m['Estado'] || m.estado || 'No definido').trim(); counts[e] = (counts[e] || 0) + 1; });
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
      chartInstances['estado'] = new Chart(ctxEstado.getContext('2d'), {
        type: 'bar',
        data: {
          labels: sorted.map(([k]) => k.substring(0, 15) + (k.length > 15 ? '...' : '')),
          datasets: [{ data: sorted.map(([, v]) => v), backgroundColor: '#06b6d488', borderColor: '#06b6d4', borderWidth: 1, borderRadius: 4 }]
        },
        options: {
          ...CHART_OPTIONS_BASE,
          indexAxis: 'y',
          plugins: { ...CHART_OPTIONS_BASE.plugins, legend: { display: false } }
        }
      });
    }

    /* 4. Tendencia Mensual (Línea de los últimos 6 meses) */
    const ctxTendencia = document.getElementById('chartTendencia');
    if (ctxTendencia) {
      destroyChart('tendencia');
      
      // Generar últimos 6 meses
      const months = [];
      const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`, m: d.getMonth(), y: d.getFullYear() });
      }

      const getMonthlyData = (arr, valFn, dateFn) => {
        const res = [0,0,0,0,0,0];
        arr.forEach(c => {
          const dStr = dateFn(c);
          if (!dStr) return;
          const d = new Date(dStr);
          if (isNaN(d)) return;
          months.forEach((mo, idx) => {
            if (d.getMonth() === mo.m && d.getFullYear() === mo.y) {
              res[idx] += valFn(c);
            }
          });
        });
        return res;
      };

      // Si el filtro de tiempo está en 'current' o 'last', la tendencia histórica completa (todos los datos)
      // es mejor mostrarla sin filtrar por tiempo, así que pasamos la data global.
      const allData = filterData(kamName, 'all'); 
      const tendSanare = getMonthlyData(allData.sanareCots, c => parseMonto(c.total), c => c.fechaEmision || c.createdAt);
      const tendNomad = getMonthlyData(allData.nomadCots, c => parseMonto(c.total), c => c.fechaEmision || c.createdAt);
      const tendLocal = getMonthlyData(allData.localCots, c => parseMonto(c['VALOR']), c => c['FECHA']);

      chartInstances['tendencia'] = new Chart(ctxTendencia.getContext('2d'), {
        type: 'line',
        data: {
          labels: months.map(m => m.label),
          datasets: [
            { label: 'Sanaré', data: tendSanare, borderColor: '#10B981', backgroundColor: '#10B98122', fill: true, tension: 0.4 },
            { label: 'Nomad', data: tendNomad, borderColor: '#7C3AED', backgroundColor: '#7C3AED22', fill: true, tension: 0.4 },
            { label: 'CRM Local', data: tendLocal, borderColor: '#0A6EBD', backgroundColor: '#0A6EBD22', fill: true, tension: 0.4 }
          ]
        },
        options: {
          ...CHART_OPTIONS_BASE,
          plugins: {
            ...CHART_OPTIONS_BASE.plugins,
            tooltip: { mode: 'index', intersect: false, callbacks: { label: (ctx) => ' ' + ctx.dataset.label + ': ' + fmt(ctx.raw) } }
          },
          scales: {
            x: CHART_OPTIONS_BASE.scales.x,
            y: { ...CHART_OPTIONS_BASE.scales.y, ticks: { ...CHART_OPTIONS_BASE.scales.y.ticks, callback: (v) => '$' + (v/1000000).toFixed(1) + 'M' } }
          }
        }
      });
    }

    /* 5. Ranking KAMs (solo en modo Todos) */
    renderKamRanking(kamName, timeFilter);
  };

  /* ── Ranking KAMs ─────────────────────────────────────────────── */
  window.renderKamRanking = function (kamName, timeFilter = 'all') {
    const container = document.getElementById('kamRanking');
    if (!container) return;
    
    // Update title to "Facturación"
    const titleEl = document.querySelector('#kamRanking').previousElementSibling;
    if (titleEl && titleEl.innerHTML.includes('Top Pipeline')) {
      titleEl.innerHTML = '🏆 Ranking KAM (Facturación)';
    }

    const kams = getKAMs();
    const kamActual = kamName || window.__kamSelected || 'Todos';
    if (!kams.length) { container.innerHTML = '<p class="text-muted text-sm">Sin datos de KAMs</p>'; return; }

    const embudoCots = window.EMBUDO_COTS || [];
    const PAGADOS = ["Pago confirmado", "Pago parcial", "Anticipo recibido"];

    const kamData = kams.map(k => {
      // Obtenemos todas las cotizaciones del KAM sin filtrar por fecha aún
      const { sanareCots, nomadCots } = filterData(k, 'all'); 
      
      // Helper local para checar fechas
      const isDateInTimeFilter = (dateStr) => {
        if (timeFilter === 'all') return true;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d)) return false;
        const now = new Date();
        if (timeFilter === 'current') {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        } else if (timeFilter === 'last') {
          let tm = now.getMonth() - 1;
          let ty = now.getFullYear();
          if (tm < 0) { tm = 11; ty--; }
          return d.getMonth() === tm && d.getFullYear() === ty;
        }
        return true;
      };
      
      let facturado = 0;

      const processCotForRanking = (c, srcProject) => {
        const srcId = c.id || "";
        if (!srcId) return;
        const op = embudoCots.find(e => e.sourceDocId === srcId && e.sourceProject === srcProject);
        const embudoPay = (op || {}).payment || {};
        const rawPay = c.payment || {};
        const status = embudoPay.status || rawPay.status || "";
        if (!PAGADOS.includes(status)) return;
        
        // Verificar filtro de tiempo en la FECHA DE PAGO
        const datePago = embudoPay.fechaPago || rawPay.fechaPago || c.createdAt || c.fechaEmision;
        if (!isDateInTimeFilter(datePago)) return;

        const montoPagado = Number(
          embudoPay.montoPagado !== undefined ? embudoPay.montoPagado :
          rawPay.montoPagado !== undefined ? rawPay.montoPagado :
          (c.total || 0)
        );
        if (!isNaN(montoPagado) && montoPagado > 0) facturado += montoPagado;
      };

      sanareCots.forEach(c => processCotForRanking(c, "sanare-cotizador"));
      nomadCots.forEach(c => processCotForRanking(c, "cotizador-nomad"));

      return { kam: k, valor: facturado };
    }).sort((a, b) => b.valor - a.valor);

    const maxValor = kamData[0]?.valor || 1;
    const medals = ['gold', 'silver', 'bronze'];

    const getMotivation = (index, totalKams, valor) => {
      if (valor === 0 && index > 2) return "¡Vamos, tú puedes! Es momento de cerrar esos tratos.";
      if (index === 0) return "¡Imparable! Liderando el mes con todo.";
      if (index === 1) return "¡Excelente trabajo! A un paso de la cima.";
      if (index === 2) return "¡Gran esfuerzo! Mantente en el Top 3.";
      if (index === totalKams - 1 && valor === 0) return "¡Es tu momento de brillar, no te rindas!";
      if (index === totalKams - 1 && valor > 0) return "Sigue empujando, ¡cada venta cuenta!";
      return "";
    };

    container.innerHTML = kamData.map((d, i) => {
      const rankClass = medals[i] || '';
      const isMe = d.kam.toUpperCase() === kamActual.toUpperCase();
      const barPct = safe((d.valor / maxValor) * 100);
      const motivation = getMotivation(i, kamData.length, d.valor);
      
      return `
        <div class="kam-rank-item ${isMe ? 'me' : ''}">
          <div class="rank-num ${rankClass}">${i + 1}</div>
          <div class="rank-bar-wrap">
            <div class="rank-bar-label">${d.kam} ${isMe ? '<span class="badge badge-blue" style="font-size:10px">Tú</span>' : ''}</div>
            <div class="rank-bar-bg">
              <div class="rank-bar-fill" style="width:${barPct}%"></div>
            </div>
            ${motivation ? `<div style="font-size: 11px; color: var(--text2); margin-top: 4px; font-style: italic;">${motivation}</div>` : ''}
          </div>
          <div class="rank-value">${fmt(d.valor)}</div>
        </div>`;
    }).join('');
  };

  /* ── Kanban desde seguimientos ────────────────────────────────── */
  const KANBAN_STAGES = [
    { id: 'nuevo',       label: 'Sin contactar', color: '#64748b' },
    { id: 'contactado',  label: 'Contactado',    color: '#0A6EBD' },
    { id: 'cita',        label: 'Cita Agendada', color: '#F59E0B' },
    { id: 'negociacion', label: 'Negociación',   color: '#7C3AED' },
    { id: 'cerrado',     label: 'Cerrado ✓',     color: '#10B981' },
  ];

  function mapEstadoToStage(estado) {
    const e = (estado || '').toLowerCase();
    if (e.includes('cita') || e.includes('agend')) return 'cita';
    if (e.includes('negoci')) return 'negociacion';
    if (e.includes('cerrado') || e.includes('confirm')) return 'cerrado';
    if (e.includes('contact')) return 'contactado';
    return 'nuevo';
  }

  window.renderKanban = function (kamName) {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;
    const filterEl = document.getElementById('chartTimeFilter');
    const timeFilter = filterEl ? filterEl.value : 'all';
    const { medicos } = filterData(kamName, timeFilter);
    const hist = window.__hist_cache__ || [];

    // Para cada médico, tomar su último estado de seguimiento
    const medWithStage = medicos.map(m => {
      const nombre = m['Nombre'] || m.nombre || '';
      const regs = hist.filter(h => h.medico === nombre || h.medicoId === m.id);
      const last = regs.length ? regs[regs.length - 1] : null;
      const stage = last ? mapEstadoToStage(last.estado) : 'nuevo';
      return { ...m, stage, lastSeg: last };
    });

    // Límite inicial 8 cards, pero renderizamos todas y ocultamos el resto
    board.innerHTML = KANBAN_STAGES.map(col => {
      const allCards = medWithStage.filter(m => m.stage === col.id);
      const total = allCards.length;
      const nombre_field = m => m['Nombre'] || m.nombre || m.name || '—';
      const hospital_field = m => m['Hospital'] || m.hospital || '';
      const esp_field = m => (m['Especialidad'] || m.especialidad || '').split(' ')[0] || '';
      const estado_field = m => m['Estado'] || m.estado || '';

      return `
        <div class="kanban-col" data-stage="${col.id}">
          <div class="kanban-col-header">
            <span class="dot" style="background:${col.color};box-shadow:0 0 6px ${col.color}"></span>
            <span class="kanban-col-title">${col.label}</span>
            <span class="kanban-col-count">${total}</span>
          </div>
          <div class="kanban-cards" data-stage="${col.id}" 
               ondragover="event.preventDefault();this.classList.add('drag-over')"
               ondragleave="this.classList.remove('drag-over')"
               ondrop="window.onKanbanDrop(event,this)">
            ${allCards.map((m, index) => `
              <div class="kanban-card hidden-kcard" draggable="true" data-id="${m.id || ''}" data-nombre="${nombre_field(m)}"
                   ondragstart="window.onKanbanDragStart(event,this)"
                   style="${index >= 8 ? 'display:none;' : ''}">
                <div class="kanban-card-name">${nombre_field(m)}</div>
                <div class="kanban-card-meta">
                  ${hospital_field(m) ? `<span>🏥 ${hospital_field(m)}</span>` : ''}
                  ${esp_field(m) ? `<span>🔬 ${esp_field(m)}</span>` : ''}
                  ${estado_field(m) ? `<span>📍 ${estado_field(m)}</span>` : ''}
                </div>
                <div class="kanban-card-footer">
                  ${m.lastSeg ? `<span class="badge badge-${statusColor(m.lastSeg.estado)}">${m.lastSeg.estado}</span>` : '<span class="badge badge-gray">Sin seguimiento</span>'}
                  <button class="btn btn-ghost btn-sm ml-auto" onclick="window.openKanbanSeg('${m.id || ''}','${nombre_field(m).replace(/'/g, '')}')">+ Seg.</button>
                </div>
              </div>
            `).join('')}
            ${total > 8 ? `<button class="btn btn-ghost w-100 text-xs text-dim" style="padding:8px;text-align:center;width:100%;background:rgba(255,255,255,0.05);border-radius:4px;margin-top:8px;" onclick="window.expandKanban(this)">+${total - 8} más…</button>` : ''}
          </div>
        </div>`;
    }).join('');
  };

  // Función para expandir cards ocultas
  window.expandKanban = function(btn) {
    const parent = btn.parentElement;
    const hiddenCards = parent.querySelectorAll('.hidden-kcard[style*="display:none"]');
    hiddenCards.forEach(c => {
      c.style.display = ''; // Elimina el display:none inline para que tome el del CSS
    });
    btn.style.display = 'none'; // Ocultar el botón
  };

  /* ── Drag & Drop Kanban ────────────────────────────────────────── */
  let draggedEl = null;
  window.onKanbanDragStart = function (e, el) {
    draggedEl = el;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  };
  window.onKanbanDrop = function (e, container) {
    e.preventDefault();
    container.classList.remove('drag-over');
    if (!draggedEl) return;
    draggedEl.classList.remove('dragging');
    const newStage = container.dataset.stage;
    const nombre   = draggedEl.dataset.nombre;
    // Guardar en historial local
    const entry = { medico: nombre, estado: newStage, fecha: new Date().toISOString().slice(0, 10), kam: window.__kamSelected || '', comentario: 'Movido desde Kanban' };
    const arr = JSON.parse(localStorage.getItem('seguimiento_historial') || '[]');
    arr.push(entry);
    localStorage.setItem('seguimiento_historial', JSON.stringify(arr));
    if (window.__hist_cache__) window.__hist_cache__.push(entry);
    // Re-render kanban
    const col = document.querySelector(`.kanban-col[data-stage="${newStage}"] .kanban-cards`);
    if (col && draggedEl) col.appendChild(draggedEl);
    showKanbanToast(`Médico movido a "${KANBAN_STAGES.find(s => s.id === newStage)?.label}"`);
    draggedEl = null;
  };

  function showKanbanToast(msg) {
    let box = document.getElementById('toastBox');
    let t = document.getElementById('toast');
    if (!box) { box = document.createElement('div'); box.id = 'toastBox'; document.body.appendChild(box); }
    if (!t) { t = document.createElement('div'); t.id = 'toast'; box.appendChild(t); }
    t.textContent = '✓ ' + msg;
    box.style.display = 'block';
    setTimeout(() => { box.style.display = 'none'; }, 1800);
  }

  window.openKanbanSeg = function (id, nombre) {
    const el = document.getElementById('segMedicoNombre');
    const idEl = document.getElementById('segMedicoId');
    if (el) el.textContent = nombre;
    if (idEl) idEl.value = id;
    const modal = document.getElementById('segSimpleModal');
    if (modal) modal.style.display = 'flex';
  };

  /* ── Actualizar todo al cambiar KAM ──────────────────────────── */
  window.onKamChange = function (kamName) {
    window.__kamSelected = kamName;
    window.renderKPIs(kamName);
    window.renderCharts(kamName);
    window.renderKanban(kamName);
    // También actualiza filtro de tabla de médicos
    const fKam = document.querySelector('#fKam');
    if (fKam) { fKam.value = kamName === 'Todos' ? '' : kamName; fKam.dispatchEvent(new Event('change')); }
    // Sync header badge
    const badge = document.getElementById('headerBadge');
    if (badge) badge.textContent = kamName ? kamName.slice(0, 2).toUpperCase() : 'AD';
    // Sync IA context
    window.__kamSelected = kamName;
  };

  /* ── Inicialización diferida (espera datos) ───────────────────── */
  window.initDashboard = function () {
    const kam = window.__kamSelected || 'Todos';
    window.renderKPIs(kam);
    window.renderCharts(kam);
    window.renderKanban(kam);
    // Hidratar el selector de KAM
    hydratKamSelector();
  };

  function hydratKamSelector() {
    const sel = document.getElementById('kamSel');
    if (!sel) return;
    // No sobreescribir si ya está bloqueado (KAM específico)
    if (sel.disabled && window.__kamSelected && window.__kamSelected !== 'Todos') return;
    const kams = window.getKAMs ? window.getKAMs() : [];
    if (!kams.length) return; // Sin datos aún
    const current = sel.value || window.__kamSelected || 'Todos';
    sel.innerHTML = '<option value="Todos">— Todos los KAMs —</option>' +
      kams.map(k => `<option value="${k}" ${k === current ? 'selected' : ''}>${k}</option>`).join('');
    sel.value = current;
  }

  // Cuando MED_BASE se actualice desde Firestore, refrescar dashboard
  const _origRenderMed = window.renderMedicos;
  window.renderMedicos = function (docs) {
    if (_origRenderMed) _origRenderMed(docs);
    // Solo actualizar si el login ya terminó (overlay oculto)
    const overlay = document.getElementById('loginOverlay');
    if (overlay && overlay.style.display !== 'none') return;
    setTimeout(() => {
      hydratKamSelector();
      window.initDashboard();
    }, 100);
  };

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => window.initDashboard && window.initDashboard(), 800);

    // Exportar Seguimientos a Excel
    const btnSeg = document.getElementById('downloadSegXLSX');
    if (btnSeg) {
      btnSeg.addEventListener('click', () => {
        if (typeof XLSX === 'undefined') { alert('Librería XLSX no cargada'); return; }
        
        const hist = window.__hist_cache__ || [];
        const medicos = window.MED_BASE || [];
        
        const kamActual = window.__kamSelected || 'Todos';
        const norm = (k) => window.normalizeKAM ? window.normalizeKAM(k) : (k||'').trim().toUpperCase();
        
        let filteredHist = hist;
        if (kamActual !== 'Todos') {
          filteredHist = hist.filter(h => norm(h.kam) === norm(kamActual));
        }

        if (!filteredHist.length) {
          alert('No hay seguimientos para exportar.');
          return;
        }

        // Mapear datos para el Excel
        const exportData = filteredHist.map(h => {
          // Buscar info del médico si es posible
          const med = medicos.find(m => m.id === h.medicoId || m['Nombre'] === h.medico || m.nombre === h.medico) || {};
          return {
            'Fecha': h.fecha || '',
            'Médico': h.medico || med['Nombre'] || med.nombre || '',
            'Especialidad': med['Especialidad'] || med.especialidad || '',
            'Hospital': med['Hospital'] || med.hospital || '',
            'Estado': h.estado || '',
            'KAM': h.kam || med['GERENTE/KAM'] || med.kam || '',
            'Notas': h.notas || ''
          };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Seguimientos");
        XLSX.writeFile(wb, `seguimientos_kanban_${kamActual === 'Todos' ? 'todos' : norm(kamActual)}.xlsx`);
      });
    }
  });

  console.log('[Dashboard] KAM dashboard module loaded');
})();
