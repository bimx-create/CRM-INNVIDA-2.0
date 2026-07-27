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

    const appSanare = initializeApp(firebaseConfigSanare, "sanareAppExt");
    const appNomad  = initializeApp(firebaseConfigNomad, "nomadAppExt");

    const dbSanare = getFirestore(appSanare);
    const dbNomad  = getFirestore(appNomad);

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

  } catch(e) {
    console.error("[kam-videos] Error inicializando Firebase externo:", e);
  }
  }

  // Llamamos a la inicialización sin bloquear el resto del script
  initExternalFirebase();
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
        <div class="card-mini-stats" style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2);">
          <div style="text-align: center;">
            <div style="font-size: 11px; color: var(--text2); text-transform: uppercase;">Médicos</div>
            <div style="font-size: 16px; font-weight: bold; color: var(--blue-light);">${kpis.medicos}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 11px; color: var(--text2); text-transform: uppercase;">Cotizado</div>
            <div style="font-size: 16px; font-weight: bold; color: var(--green);">${kpis.cotizacionesFmt}</div>
          </div>
        </div>
      `;

      card.onclick = () => {
        showKamDetails(kamNorm, displayName, kpis);
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

    // Función de normalización auxiliar
    const norm = (k) => window.normalizeKAM ? window.normalizeKAM(k) : (k||'').trim().toUpperCase();

    // Filtramos médicos y seguimientos (CRM local)
    const myMedicos = medicos.filter(m => norm(m['GERENTE/KAM'] || m.kam) === kamNorm);
    const mySegs = segs.filter(s => norm(s.kam) === kamNorm);

    // Separamos las cotizaciones
    const myLocalCots = localCots.filter(c => norm(c['KAM']) === kamNorm);
    const mySanareCots = sanareCots.filter(c => norm(c.kam) === kamNorm);
    const myNomadCots = nomadCots.filter(c => norm(c.kam) === kamNorm);

    // Sumamos cotizaciones (Total Histórico para la tarjeta principal del Grid)
    let monto = 0;
    myLocalCots.forEach(c => {
      const valStr = (c['VALOR'] || '0').toString().replace(/[^0-9.-]+/g,"");
      const val = parseFloat(valStr);
      if (!isNaN(val)) monto += val;
    });
    mySanareCots.forEach(c => {
      const val = parseFloat(c.total || 0);
      if (!isNaN(val)) monto += val;
    });
    myNomadCots.forEach(c => {
      const val = parseFloat(c.total || 0);
      if (!isNaN(val)) monto += val;
    });

    return {
      medicos: myMedicos.length,
      cotizacionesCount: myLocalCots.length + mySanareCots.length + myNomadCots.length,
      cotizacionesMonto: monto,
      cotizacionesFmt: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(monto),
      seguimientos: mySegs.length,
      rawQuotes: { local: myLocalCots, sanare: mySanareCots, nomad: myNomadCots }
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

})();
