// kam-videos.js
(function() {
  const KAM_VIDEOS = {
    'DR. ALAIN RAMÍREZ': 'alain.mp4',
    'MARICARMEN CASTILLO': 'maricarmen.mp4',
    'ANAYELY TAPIA': 'anayely.mp4',
    'BERENICE ORDAZ': 'berenice.mp4',
    'DAYANA': 'dayana.mp4',
    'OSCAR RANGEL': 'oscar.mp4',
    'MARYMAR': 'marymar.mp4'
  };

  const KAM_DISPLAY_NAMES = {
    'DR. ALAIN RAMÍREZ': 'Dr. Alain Ramírez',
    'MARICARMEN CASTILLO': 'Maricarmen Castillo',
    'ANAYELY TAPIA': 'Anayely Tapia',
    'BERENICE ORDAZ': 'Berenice Ordaz',
    'DAYANA': 'Dayana',
    'OSCAR RANGEL': 'Oscar Rangel',
    'MARYMAR': 'Marymar'
  };

  // ----- INTEGRACIÓN FIREBASE SANARÉ & NOMAD -----
  window.SANARE_COTS = [];
  window.NOMAD_COTS = [];

  async function initExternalFirebase() {
    try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const { getFirestore, collection, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

    const firebaseConfigSanare = {
      apiKey: "AIzaSyAX1AA7tTnlnApVZlnnuMkB42k3W5IlwoM",
      authDomain: "sanare-cotizador.firebaseapp.com",
      projectId: "sanare-cotizador",
      storageBucket: "sanare-cotizador.firebasestorage.app",
      messagingSenderId: "902613920907",
      appId: "1:902613920907:web:0e73bd5def3cf4396a788e"
    };

    const firebaseConfigNomad = {
      apiKey: "AIzaSyDhtKZlWpHdhFcnVzWovB93bRSVRkC1sDI",
      authDomain: "cotizador-nomad.firebaseapp.com",
      projectId: "cotizador-nomad",
      storageBucket: "cotizador-nomad.firebasestorage.app",
      messagingSenderId: "736481537624",
      appId: "1:736481537624:web:6f06667cf34bccc532642d"
    };

    const firebaseConfigEmbudo = {
      apiKey: "AIzaSyBqQywIlbMo9nSOC3zI3u7nRshs4rDedMM",
      authDomain: "embudo-innvida.firebaseapp.com",
      projectId: "embudo-innvida",
      storageBucket: "embudo-innvida.firebasestorage.app",
      messagingSenderId: "988847530129",
      appId: "1:988847530129:web:fd89909a969431df329f30"
    };

    const appSanare = initializeApp(firebaseConfigSanare, "sanareAppExt");
    const appNomad  = initializeApp(firebaseConfigNomad, "nomadAppExt");
    const appEmbudo = initializeApp(firebaseConfigEmbudo, "embudoAppExt");

    const dbSanare = getFirestore(appSanare);
    const dbNomad  = getFirestore(appNomad);
    const dbEmbudo = getFirestore(appEmbudo);

    onSnapshot(collection(dbSanare, "cotizaciones"), (snap) => {
      window.SANARE_COTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const view = document.getElementById('view-kam-videos');
      if (view && !view.classList.contains('hidden')) {
        window.renderKamVideosGrid();
      }
    });

    onSnapshot(collection(dbNomad, "cotizaciones"), (snap) => {
      window.NOMAD_COTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const view = document.getElementById('view-kam-videos');
      if (view && !view.classList.contains('hidden')) {
        window.renderKamVideosGrid();
      }
    });

    onSnapshot(collection(dbEmbudo, "seguimiento_operativo"), (snap) => {
      window.EMBUDO_COTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const view = document.getElementById('view-kam-videos');
      if (view && !view.classList.contains('hidden')) {
        window.renderKamVideosGrid();
      }
    });

  } catch(e) {
    console.error("[kam-videos] Error inicializando Firebase externo:", e);
  }
  }

  // Llamamos a la inicialización diferida para no bloquear la carga principal del CRM
  setTimeout(initExternalFirebase, 3500);
  // ------------------------------------------------

  window.renderKamVideosGrid = function() {
    const grid = document.getElementById('kamVideosGrid');
    if (!grid) return;

    grid.innerHTML = ''; // Limpiar

    Object.keys(KAM_VIDEOS).forEach(kamNorm => {
      const videoFile = KAM_VIDEOS[kamNorm];
      const displayName = KAM_DISPLAY_NAMES[kamNorm] || kamNorm;

      // Calcular KPIs para este KAM
      const kpis = calcKamKPIs(kamNorm);

      const card = document.createElement('div');
      card.className = 'kam-video-card card';
      card.style.cssText = `
        overflow: hidden; 
        cursor: pointer; 
        transition: transform 0.2s, box-shadow 0.2s;
        border: 1px solid rgba(255,255,255,0.05);
        display: flex;
        flex-direction: column;
        background: var(--bg2);
      `;
      
      card.onmouseover = () => {
        card.style.transform = 'translateY(-4px)';
        card.style.boxShadow = '0 12px 24px rgba(0,0,0,0.4)';
        card.style.borderColor = 'var(--blue)';
      };
      card.onmouseout = () => {
        card.style.transform = 'none';
        card.style.boxShadow = 'var(--shadow)';
        card.style.borderColor = 'rgba(255,255,255,0.05)';
      };

      card.innerHTML = `
        <div class="video-wrapper" style="position: relative; width: 100%; aspect-ratio: 9/16; background: #000; overflow: hidden;">
          <video src="assets/videos/kam/${videoFile}" autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>
          <div class="video-overlay" style="position: absolute; bottom: 0; left: 0; right: 0; padding: 40px 16px 16px; background: linear-gradient(transparent, rgba(0,0,0,0.9));">
            <h4 style="margin: 0; color: #fff; font-size: 18px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${displayName}</h4>
          </div>
        </div>
        <div class="card-mini-stats" style="padding: 12px 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: rgba(0,0,0,0.2);">
          <div style="text-align: center;">
            <div style="font-size: 10px; color: var(--text2); text-transform: uppercase;">Médicos</div>
            <div style="font-size: 14px; font-weight: bold; color: var(--blue-light);">${kpis.medicos}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: var(--text2); text-transform: uppercase;">Efectividad</div>
            <div style="font-size: 14px; font-weight: bold; color: #f59e0b;">${kpis.efectividadFmt}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: var(--text2); text-transform: uppercase;">Cotiz (Mes)</div>
            <div style="font-size: 14px; font-weight: bold; color: var(--text);">${kpis.cotizadoMesFmt}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 10px; color: var(--text2); text-transform: uppercase;">Factur (Mes)</div>
            <div style="font-size: 14px; font-weight: bold; color: var(--green);">${kpis.facturadoMesFmt}</div>
          </div>
        </div>
        <div style="padding: 0 10px 12px; background: rgba(0,0,0,0.2);">
          <button class="btn btn-outline" style="width:100%; border-color:var(--blue); color:var(--blue-light); display:flex; align-items:center; justify-content:center; gap:6px; font-size:12px; padding:6px;" onclick="event.stopPropagation(); window.openKamSkills('${kamNorm}')">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            Ver Habilidades
          </button>
        </div>
      `;

      card.onclick = () => {
        // Recalcular KPIs en el momento del clic para capturar datos Firebase actualizados
        const freshKpis = calcKamKPIs(kamNorm);
        showKamDetails(kamNorm, displayName, freshKpis);
      };

      grid.appendChild(card);
    });
  };

  let currentSelectedKam = null;

  function calcKamKPIs(kamNorm) {
    const medicos = window.MED_BASE || [];
    const localCots = window.COT_BASE || [];
    const sanareCots = window.SANARE_COTS || [];
    const nomadCots = window.NOMAD_COTS || [];
    const segs = window.__hist_cache__ || [];

    // Función de normalización auxiliar con aliases locales (fallback si normalizeKAM aún no está lista)
    const KAM_ALIASES = {
      'ANAYELY': 'ANAYELY TAPIA', 'ANAYELI': 'ANAYELY TAPIA',
      'BERENICE': 'BERENICE ORDAZ',
      'DAYAN': 'DAYANA',
      'OSCAR': 'OSCAR RANGEL',
      'MARYMAR': 'MARYMAR',
      'MARICARMEN': 'MARICARMEN CASTILLO',
      'ALAIN': 'DR. ALAIN RAMÍREZ',
    };
    const norm = (k) => {
      if (window.normalizeKAM) return window.normalizeKAM(k);
      const upper = (k || '').replace(/\s+/g, ' ').trim().toUpperCase();
      for (const [alias, full] of Object.entries(KAM_ALIASES)) {
        if (upper.includes(alias)) return full;
      }
      return upper;
    };

    // Normalizar también el nombre canónico del KAM de la tarjeta (por si viene sin alias)
    const kamCanon = norm(kamNorm);

    // Filtramos médicos y seguimientos (CRM local)
    const myMedicos = medicos.filter(m => norm(m['GERENTE/KAM'] || m.kam) === kamCanon);
    const mySegs = segs.filter(s => norm(s.kam) === kamCanon);

    // Separamos las cotizaciones
    const myLocalCots = localCots.filter(c => norm(c['KAM']) === kamCanon);
    const mySanareCots = sanareCots.filter(c => norm(c.kam) === kamCanon);
    const myNomadCots = nomadCots.filter(c => norm(c.kam) === kamCanon);

    if (kamNorm.includes('ANAYELY')) {
       console.log(`[DEBUG ANAYELY] kamCanon: ${kamCanon}`);
       console.log(`[DEBUG ANAYELY] Sanare Total: ${sanareCots.length} | Nomad Total: ${nomadCots.length}`);
       console.log(`[DEBUG ANAYELY] Found Local: ${myLocalCots.length} | Sanare: ${mySanareCots.length} | Nomad: ${myNomadCots.length}`);
       // Imprimir qué nombres vienen en Sanare para ver por qué no hacen match
       const sampleSanare = Array.from(new Set(sanareCots.map(c => c.kam))).join(', ');
       console.log(`[DEBUG ANAYELY] KAMs en Sanare: ${sampleSanare}`);
    }


    const embudoCots = window.EMBUDO_COTS || [];

    // Fechas actuales para "del mes"
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    const getTimestamp = (val) => {
      if (!val) return null;
      if (typeof val === 'string') return new Date(val);
      if (val.seconds) return new Date(val.seconds * 1000);
      if (typeof val.toDate === 'function') return val.toDate();
      return new Date(val);
    };

    const isCurrentMonth = (dateVal) => {
      const d = getTimestamp(dateVal);
      if (!d || isNaN(d.getTime())) return false;
      return d.getFullYear() === curYear && d.getMonth() === curMonth;
    };

    let cotizadoHist = 0;
    let cotizadoMes = 0;
    let facturadoMes = 0;

    // === COTIZADO (HISTÓRICO Y MES) ===
    const sumVal = (c) => parseFloat((c.total || c.VALOR || '0').toString().replace(/[^0-9.-]+/g,"")) || 0;
    const isCotAceptada = (s) => {
      const u = (s || '').toUpperCase();
      return u.includes('CERRAD') || u.includes('ACEPT') || u.includes('CONFIRM');
    };

    myLocalCots.forEach(c => {
      const val = sumVal(c);
      cotizadoHist += val;
      if (isCurrentMonth(c.fechaEmision || c.createdAt || c.FECHA) && isCotAceptada(c['STATUS'])) {
        cotizadoMes += val;
      }
    });
    mySanareCots.forEach(c => {
      const val = sumVal(c);
      cotizadoHist += val;
      if (isCurrentMonth(c.fechaEmision || c.createdAt) && isCotAceptada(c.status1 || c.status)) {
        cotizadoMes += val;
      }
    });
    myNomadCots.forEach(c => {
      const val = sumVal(c);
      cotizadoHist += val;
      if (isCurrentMonth(c.fechaEmision || c.createdAt) && isCotAceptada(c.status1 || c.status)) {
        cotizadoMes += val;
      }
    });

    // === FACTURADO DEL MES ===
    // Lógica idéntica al embudo: para cada cotización del KAM,
    // buscar si tiene overlay en el embudo y usar ese estatus de pago.
    // Si el embudo muestra "Pendiente de pago", aquí también saldrá $0.
    const PAGADOS = ["Pago confirmado", "Pago parcial", "Anticipo recibido"];

    const processCotFacturado = (c, srcProject) => {
      // Buscar el overlay del embudo SOLO por sourceDocId (ID único de Firebase).
      // NO usar folio como fallback — el folio puede repetirse entre cotizaciones de distintos KAMs.
      const srcId = c.id || "";
      if (!srcId) return; // Sin ID no podemos hacer un match confiable

      const op = embudoCots.find(e =>
        e.sourceDocId && e.sourceDocId === srcId && e.sourceProject === srcProject
      );

      // Prioridad: overlay del embudo → raw de Sanare/Nomad
      const embudoPay = (op || {}).payment || {};
      const rawPay = c.payment || {};
      const status = embudoPay.status || rawPay.status || "";

      if (!PAGADOS.includes(status)) return;

      // Fecha de pago
      const datePago = embudoPay.fechaPago || rawPay.fechaPago || c.createdAt || c.fechaEmision;
      if (!isCurrentMonth(datePago)) return;

      const montoPagado = Number(
        embudoPay.montoPagado !== undefined ? embudoPay.montoPagado :
        rawPay.montoPagado  !== undefined ? rawPay.montoPagado :
        (c.total || 0)
      );
      if (montoPagado > 0) facturadoMes += montoPagado;
    };

    mySanareCots.forEach(c => processCotFacturado(c, "sanare-cotizador"));
    myNomadCots.forEach(c => processCotFacturado(c, "cotizador-nomad"));

    
    let efectividad = 0;
    if (cotizadoMes > 0) {
       efectividad = (facturadoMes / cotizadoMes) * 100;
    }

    return {
      medicos: myMedicos.length,
      cotizacionesCount: myLocalCots.length + mySanareCots.length + myNomadCots.length,
      cotizacionesMonto: cotizadoHist,
      cotizacionesMontoMes: cotizadoMes,
      facturadoMes: facturadoMes,
      efectividad: efectividad,
      cotizacionesFmt: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(cotizadoHist),
      cotizadoMesFmt: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(cotizadoMes),
      facturadoMesFmt: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(facturadoMes),
      efectividadFmt: efectividad.toFixed(1) + '%',
      seguimientos: mySegs.length,
      rawQuotes: { local: myLocalCots, sanare: mySanareCots, nomad: myNomadCots, embudo: embudoCots }
    };
  }

  function showKamDetails(kamNorm, displayName, kpis) {
    currentSelectedKam = { kamNorm, displayName, kpis };
    
    const panel = document.getElementById('kamDetailsPanel');
    document.getElementById('kdName').textContent = displayName;
    
    // Animar contadores básicos
    animateValue(document.getElementById('kdMedicos'), 0, kpis.medicos, 800);
    animateValue(document.getElementById('kdSeguimientos'), 0, kpis.seguimientos, 800);
    
    // Resetear filtro a mes actual y calcular desglose
    const filterSelect = document.getElementById('kdMonthFilter');
    if (filterSelect) filterSelect.value = 'current';
    window.updateQuoteBreakdown();

    panel.style.display = 'flex';
    
    // Pequeño efecto de entrada
    panel.style.opacity = '0';
    panel.style.transform = 'translateX(20px)';
    setTimeout(() => {
      panel.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      panel.style.opacity = '1';
      panel.style.transform = 'translateX(0)';
    }, 10);
  }

  window.updateQuoteBreakdown = function() {
    if (!currentSelectedKam) return;
    const { rawQuotes } = currentSelectedKam.kpis;
    const filterSelect = document.getElementById('kdMonthFilter');
    const filter = filterSelect ? filterSelect.value : 'all';

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    function isInFilter(dateStr) {
      if (filter === 'all') return true;
      if (!dateStr) return false;
      // Parsear fecha, asumiendo formato ISO o similar
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      
      if (filter === 'current') {
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
      } else if (filter === 'last') {
        let lastMonth = curMonth - 1;
        let lastYear = curYear;
        if (lastMonth < 0) { lastMonth = 11; lastYear--; }
        return d.getFullYear() === lastYear && d.getMonth() === lastMonth;
      }
      return true;
    }

    let tSanare = 0, tNomad = 0, tLocal = 0;
    let counts = 0;
    let statusMap = {};

    function addQuote(monto, status, source) {
      if (isNaN(monto)) monto = 0;
      counts++;
      if (source === 'Sanaré') tSanare += monto;
      if (source === 'Nomad') tNomad += monto;
      if (source === 'Local') tLocal += monto;

      status = (status || 'SIN ESTATUS').toUpperCase().trim();
      if (!statusMap[status]) statusMap[status] = 0;
      statusMap[status] += monto;
    }

    rawQuotes.local.forEach(c => {
      if (isInFilter(c.FECHA || c.fecha)) {
        const valStr = (c['VALOR'] || '0').toString().replace(/[^0-9.-]+/g,"");
        addQuote(parseFloat(valStr), c.STATUS || c.status, 'Local');
      }
    });

    rawQuotes.sanare.forEach(c => {
      if (isInFilter(c.fechaEmision || c.createdAt)) {
        addQuote(parseFloat(c.total || 0), c.status1 || c.status, 'Sanaré');
      }
    });

    rawQuotes.nomad.forEach(c => {
      if (isInFilter(c.fechaEmision || c.createdAt)) {
        addQuote(parseFloat(c.total || 0), c.status1 || c.status, 'Nomad');
      }
    });

    const total = tSanare + tNomad + tLocal;
    
    // Actualizar Totales en UI
    const countEl = document.getElementById('kdCotizacionesCount');
    if (countEl) countEl.textContent = counts;
    
    const montoEl = document.getElementById('kdCotizacionesMonto');
    animateValueCurrency(montoEl, 0, total, 400);

    const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits:0 }).format(v);

    // Actualizar desglose Empresa
    const empresaEl = document.getElementById('kdCotsEmpresa');
    if (empresaEl) {
      empresaEl.innerHTML = `
        <div><span style="color:var(--text2)">Sanaré:</span> <span style="font-weight:600">${fmt(tSanare)}</span></div>
        <div><span style="color:var(--text2)">Nomad:</span> <span style="font-weight:600">${fmt(tNomad)}</span></div>
        <div style="grid-column: 1/-1"><span style="color:var(--text2)">CRM Local:</span> <span style="font-weight:600">${fmt(tLocal)}</span></div>
      `;
    }

    // Actualizar desglose Estatus
    const estatusEl = document.getElementById('kdCotsEstatus');
    if (estatusEl) {
      let stHtml = '';
      const sortedStatus = Object.keys(statusMap).sort((a,b) => statusMap[b] - statusMap[a]);
      sortedStatus.forEach(st => {
        stHtml += `<div style="display:flex; justify-content:space-between;">
          <span style="color:var(--text2)">${st}</span>
          <span style="font-weight:600">${fmt(statusMap[st])}</span>
        </div>`;
      });
      if (!stHtml) stHtml = '<span style="color:var(--text2)">Sin cotizaciones registradas</span>';
      estatusEl.innerHTML = stHtml;
    }

    // === Lógica de Facturado (Pagado) para el Panel ===
    let fSanare = 0, fNomad = 0;
    const embudoCots = window.EMBUDO_COTS || [];
    const PAGADOS = ["Pago confirmado", "Pago parcial", "Anticipo recibido"];

    const processCotForPanel = (c, srcProject) => {
      const srcId = c.id || "";
      if (!srcId) return 0;
      
      const op = embudoCots.find(e => e.sourceDocId === srcId && e.sourceProject === srcProject);
      
      const embudoPay = (op || {}).payment || {};
      const rawPay = c.payment || {};
      const status = embudoPay.status || rawPay.status || "";
      
      if (!PAGADOS.includes(status)) return 0;
      
      const datePago = embudoPay.fechaPago || rawPay.fechaPago || c.createdAt || c.fechaEmision;
      if (!isInFilter(datePago)) return 0;
      
      const montoPagado = Number(
        embudoPay.montoPagado !== undefined ? embudoPay.montoPagado :
        rawPay.montoPagado  !== undefined ? rawPay.montoPagado :
        (c.total || 0)
      );
      
      return isNaN(montoPagado) ? 0 : montoPagado;
    };

    rawQuotes.sanare.forEach(c => { fSanare += processCotForPanel(c, "sanare-cotizador"); });
    rawQuotes.nomad.forEach(c => { fNomad += processCotForPanel(c, "cotizador-nomad"); });
    
    const totalFacturado = fSanare + fNomad;

    const factMontoEl = document.getElementById('kdFacturadoMonto');
    if (factMontoEl) animateValueCurrency(factMontoEl, 0, totalFacturado, 400);

    const factEmpresaEl = document.getElementById('kdFacturadoEmpresa');
    if (factEmpresaEl) {
      factEmpresaEl.innerHTML = `
        <div><span style="color:var(--text2)">Sanaré:</span> <span style="font-weight:600">${fmt(fSanare)}</span></div>
        <div><span style="color:var(--text2)">Nomad:</span> <span style="font-weight:600">${fmt(fNomad)}</span></div>
      `;
    }
  };

  window.closeKamDetails = function() {
    const panel = document.getElementById('kamDetailsPanel');
    panel.style.opacity = '0';
    panel.style.transform = 'translateX(20px)';
    setTimeout(() => {
      panel.style.display = 'none';
    }, 300);
  };

  function animateValue(obj, start, end, duration) {
    if(!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      obj.innerHTML = Math.floor(progress * (end - start) + start);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        obj.innerHTML = end;
      }
    };
    window.requestAnimationFrame(step);
  }

  function animateValueCurrency(obj, start, end, duration) {
    if(!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const val = progress * (end - start) + start;
      obj.innerHTML = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        obj.innerHTML = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(end);
      }
    };
    window.requestAnimationFrame(step);
  }

  // Interceptar la navegación para inicializar esta vista
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.target.id === 'view-kam-videos') {
        if (!mutation.target.classList.contains('hidden')) {
          window.renderKamVideosGrid();
        }
      }
    });
  });

  document.addEventListener('DOMContentLoaded', () => {
    const view = document.getElementById('view-kam-videos');
    if (view) {
      observer.observe(view, { attributes: true, attributeFilter: ['class'] });
    }
    
    // Escuchar cambios en el filtro de mes
    const filterSelect = document.getElementById('kdMonthFilter');
    if (filterSelect) {
      filterSelect.addEventListener('change', () => {
        window.updateQuoteBreakdown();
      });
    }
  });

  window.openKamSkills = function(kamNorm) {
    const kpis = calcKamKPIs(kamNorm);
    const displayName = window.kamDisplayNames ? window.kamDisplayNames[kamNorm] : kamNorm;
    
    document.getElementById('kamSkillsModal').style.display = 'flex';
    document.getElementById('skillsModalTitle').innerText = 'Habilidades de ' + (displayName || kamNorm);
    
    // Generamos puntajes del 1 al 100 basados en sus KPIs reales
    const cierre = Math.min(100, Math.max(50, kpis.efectividad * 2 + 50)); 
    const seguimiento = Math.min(100, Math.max(50, (kpis.seguimientos / (kpis.medicos || 1)) * 20 + 50));
    const prospeccion = Math.min(100, Math.max(50, (kpis.medicos / 50) * 30 + 40));
    const convencimiento = Math.min(100, Math.max(50, (kpis.cotizacionesMonto > 0 ? 85 : 55) + (kpis.efectividad / 2)));
    const nameLen = displayName ? displayName.length : 10;
    const aprendizaje = 75 + (nameLen * 3 % 20); // Valor semi-fijo basado en su nombre
    
    if (window.kamSkillsChartInstance) {
      window.kamSkillsChartInstance.destroy();
    }
    
    const ctx = document.getElementById('kamSkillsChart').getContext('2d');
    window.kamSkillsChartInstance = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Cierre', 'Seguimiento', 'Prospección', 'Convencimiento', 'Aprendizaje'],
        datasets: [{
          label: 'Nivel',
          data: [Math.round(cierre), Math.round(seguimiento), Math.round(prospeccion), Math.round(convencimiento), Math.round(aprendizaje)],
          backgroundColor: 'rgba(56, 189, 248, 0.2)',
          borderColor: 'rgba(56, 189, 248, 1)',
          pointBackgroundColor: 'rgba(56, 189, 248, 1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(56, 189, 248, 1)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            pointLabels: { color: '#9ca3af', font: { size: 12, family: 'Inter', weight: '600' } },
            ticks: { display: false, min: 0, max: 100 }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#fff',
            bodyColor: '#38BDF8',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: { label: function(context) { return ' Nivel: ' + context.raw + '%'; } }
          }
        }
      }
    });
  };

})();
