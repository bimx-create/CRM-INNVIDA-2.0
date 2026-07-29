// cotizaciones-view.js - Vista Global de Cotizaciones

(async function() {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const { getFirestore, doc, getDoc, setDoc, collection, addDoc, onSnapshot, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");
  const { getAuth, signInAnonymously } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");

  // Configuración de la NUEVA base de datos exclusiva para cotizaciones
  const cotizaFirebaseConfig = {
    apiKey: "AIzaSyDo3Leti8hcUDQpS7YAGI7VJLZEKuFjISM",
    authDomain: "directorio-cotizaciones-crm.firebaseapp.com",
    projectId: "directorio-cotizaciones-crm",
    storageBucket: "directorio-cotizaciones-crm.firebasestorage.app",
    messagingSenderId: "45552893337",
    appId: "1:45552893337:web:8c8794b10f5270c47be708"
  };

  const appCotiza = initializeApp(cotizaFirebaseConfig, "CotizaApp");
  const db = getFirestore(appCotiza);
  const auth = getAuth(appCotiza);
  
  // Iniciar sesión anónima por si hay reglas de auth
  signInAnonymously(auth).catch(e => console.warn("[Cotiza Auth] Error:", e));

  // Helper UI
  function el(html){ const d=document.createElement("div"); d.innerHTML=html.trim(); return d.firstElementChild; }
  
  // Crear modal dinámicamente
  const modalHTML = `
  <div id="segCotModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;align-items:center;justify-content:center;">
    <div style="background:#0f172a;color:#e5e7eb;width:min(740px,92vw);border-radius:14px;padding:18px;border:1px solid #1e293b;box-shadow:0 14px 34px rgba(0,0,0,.5)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3 style="margin:0">Seguimiento Cotización — <span id="segCotMedicoNombre"></span></h3>
        <button id="segCotClose" class="btn btn-ghost" style="color:var(--text2);">Cerrar</button>
      </div>
      <div style="margin-bottom:12px; font-size:13px; color:#9ca3af;">
        Origen: <b id="segCotOrigen"></b> | Monto: <b id="segCotMonto"></b>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <input type="hidden" id="segCotId">
        <input type="hidden" id="segCotOrigenVal">
        <label>Estatus Cotización<select id="segCotEstado" class="form-input" style="padding:10px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:#fff;">
          <option value="PENDIENTE">Pendiente</option>
          <option value="ACEPTADA">Aceptada / Cerrada</option>
          <option value="CANCELADA">Cancelada</option>
        </select></label>
        <label>KAM<input id="segCotKAM" class="form-input" style="padding:10px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:#fff;" placeholder="Nombre KAM"></label>
        <label style="grid-column:1/-1;">Nuevo Comentario<textarea id="segCotComentarios" rows="3" class="form-input" style="width:100%;padding:10px;border-radius:10px;border:1px solid #334155;background:#0b1220;color:#fff;" placeholder="Escribe aquí los avances..."></textarea></label>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
        <button id="segCotSave" class="btn btn-primary">Guardar</button>
      </div>
      <div id="segCotHist" style="margin-top:14px;padding-top:8px;border-top:1px solid #1f2937;"></div>
    </div>
  </div>`;
  
  document.body.appendChild(el(modalHTML));

  const modal = document.getElementById("segCotModal");
  document.getElementById("segCotClose").addEventListener("click", () => modal.style.display = "none");

  // Estado Local para cruzar estatus y pintar la tabla
  let overridesStatus = {}; 
  let allCots = [];

  // Escuchar overrides de la nueva base de datos
  onSnapshot(collection(db, "cotizaciones_seguimientos"), (snap) => {
    overridesStatus = {};
    snap.forEach(doc => {
      const data = doc.data();
      if (data.estatusGlobal) {
        overridesStatus[doc.id] = data.estatusGlobal;
      }
    });
    if (!document.getElementById('view-cotizaciones').classList.contains('hidden')) {
      renderTable();
    }
  });

  function getGlobalData() {
    const data = [];
    
    // CRM Local
    if (window.COTIZACIONES_DATA) {
      window.COTIZACIONES_DATA.forEach(c => {
        if (!c.MEDICO && !c.VALOR) return;
        const kam = c.KAM || "";
        const id = btoa(unescape(encodeURIComponent((c.MEDICO + c.VALOR + kam).slice(0, 50)))).replace(/=/g, '');
        // Fecha del CRM local viene como nombre de mes en español (ej: "JULIO"). Filtrar solo julio en adelante no aplica a texto.
        data.push({
          id: `LOCAL_${id}`,
          origen: 'CRM Local',
          fecha: c.FECHA || 'N/A',
          fechaTs: null, // Sin timestamp real en CRM local
          medico: c.MEDICO || 'Sin nombre',
          paciente: c.PACIENTE || 'N/A',
          esquema: c.ESQUEMA || c.PACIENTE || 'N/A',
          monto: parseFloat((c.VALOR || '0').toString().replace(/[^0-9.-]+/g, '')) || 0,
          kam: kam,
          estatusOriginal: (c.STATUS || '').toUpperCase()
        });
      });
    }

    // Helper para parsear timestamp de Firebase
    const getTs = (val) => {
      if (!val) return null;
      if (typeof val === 'string') return new Date(val);
      if (val.seconds) return new Date(val.seconds * 1000);
      if (typeof val.toDate === 'function') return val.toDate();
      return new Date(val);
    };

    // Filtro: solo registros desde julio 2025 en adelante
    const DESDE = new Date(2025, 6, 1); // 1 julio 2025
    const esReciente = (ts) => {
      if (!ts) return false;
      return ts >= DESDE;
    };

    // SANARE
    if (window.SANARE_COTS) {
      window.SANARE_COTS.forEach(c => {
        const ts = getTs(c.fechaEmision || c.createdAt || c.fechaAtencion);
        if (!esReciente(ts)) return; // Solo julio 2025+
        data.push({
          id: `SANARE_${c.id}`,
          origen: 'Sanaré',
          fecha: ts ? ts.toLocaleDateString('es-MX') : 'N/A',
          fechaTs: ts,
          medico: c.medico || c.nombre || 'Sin nombre',
          paciente: c.paciente || c.nombrePaciente || 'N/A',
          esquema: c.medicamento || c.producto || 'N/A',
          monto: parseFloat((c.total || c.subtotal || c.monto || '0').toString().replace(/[^0-9.-]+/g, '')) || 0,
          kam: c.kam || c.KAM || '',
          estatusOriginal: (c.status1 || c.status || c.estatus || 'PENDIENTE').toUpperCase()
        });
      });
    }

    // NOMAD
    if (window.NOMAD_COTS) {
      window.NOMAD_COTS.forEach(c => {
        const ts = getTs(c.fechaEmision || c.createdAt || c.fechaAtencion);
        if (!esReciente(ts)) return; // Solo julio 2025+
        data.push({
          id: `NOMAD_${c.id}`,
          origen: 'Nomad',
          fecha: ts ? ts.toLocaleDateString('es-MX') : 'N/A',
          fechaTs: ts,
          medico: c.medico || c.nombre || 'Sin nombre',
          paciente: c.paciente || c.nombrePaciente || 'N/A',
          esquema: c.medicamento || c.producto || 'N/A',
          monto: parseFloat((c.total || c.subtotal || c.monto || '0').toString().replace(/[^0-9.-]+/g, '')) || 0,
          kam: c.kam || c.KAM || '',
          estatusOriginal: (c.status1 || c.status || c.estatus || 'PENDIENTE').toUpperCase()
        });
      });
    }
    
    return data;
  }

  function renderTable() {
    allCots = getGlobalData();
    
    const tbody = document.getElementById("cotListTbody");
    const q = (document.getElementById("cotSearchInput").value || '').toLowerCase();
    
    let filtered = allCots;
    if (q) {
      filtered = allCots.filter(c => 
        c.medico.toLowerCase().includes(q) || 
        c.paciente.toLowerCase().includes(q) ||
        c.kam.toLowerCase().includes(q) || 
        c.esquema.toLowerCase().includes(q) ||
        c.origen.toLowerCase().includes(q)
      );
    }
    
    // Sort por fecha descendente (más recientes primero)
    filtered.sort((a,b) => {
      if (b.fechaTs && a.fechaTs) return b.fechaTs - a.fechaTs;
      if (b.fechaTs) return 1;
      if (a.fechaTs) return -1;
      return a.medico.localeCompare(b.medico);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="padding:24px; text-align:center; color:var(--text2);">No hay cotizaciones</td></tr>`;
      return;
    }

    const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

    let html = '';
    filtered.forEach(c => {
      const finalStatus = overridesStatus[c.id] || c.estatusOriginal;
      
      let badgeColor = 'gray';
      if (finalStatus.includes('ACEPTADA') || finalStatus.includes('CONFIRMAD')) badgeColor = 'green';
      else if (finalStatus.includes('PENDIENTE')) badgeColor = 'yellow';
      else if (finalStatus.includes('CANCELAD')) badgeColor = 'red';

      const sOrigen = c.origen === 'Sanaré' ? '<span style="color:#22c55e">Sanaré</span>' : 
                      c.origen === 'Nomad' ? '<span style="color:#0ea5e9">Nomad</span>' : 'CRM Local';
      
      html += `
        <tr style="border-bottom:1px solid var(--border2); transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='none'">
          <td style="padding:12px 16px; white-space:nowrap;">${c.fecha}</td>
          <td style="padding:12px 16px; font-weight:600;">${sOrigen}</td>
          <td style="padding:12px 16px;">${c.medico}</td>
          <td style="padding:12px 16px;">${c.paciente}</td>
          <td style="padding:12px 16px; font-weight:600; color:#10B981;">${fmt.format(c.monto)}</td>
          <td style="padding:12px 16px;">${c.kam}</td>
          <td style="padding:12px 16px;"><span class="badge badge-${badgeColor}">${finalStatus}</span></td>
          <td style="padding:12px 16px;">
            <button class="btn btn-primary btn-sm" onclick="window.openSegCotizacion('${c.id}', '${c.medico.replace(/'/g, "\\'")}', '${c.origen}', ${c.monto}, '${c.kam.replace(/'/g, "\\'")}', '${finalStatus}')">Seguimiento</button>
          </td>
        </tr>
      `;
    });
    
    tbody.innerHTML = html;
  }


  // ====== HOOK DIRECTO EN EL NAV ======
  function setupCotizacionesView() {
    const view = document.getElementById('view-cotizaciones');
    const searchInp = document.getElementById('cotSearchInput');
    
    if (view) {
      // Observar cambios de clase (cuando nav lo muestra)
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (!mutation.target.classList.contains('hidden')) {
            renderTable();
          }
        });
      });
      observer.observe(view, { attributes: true, attributeFilter: ['class'] });
    }

    // También hookeamos el click en el link del nav directamente
    const navLink = document.querySelector('[data-target="cotizaciones"]');
    if (navLink) {
      navLink.addEventListener('click', () => {
        setTimeout(renderTable, 50); // pequeño delay para que el nav termine de mostrar la vista
      });
    }
    
    if (searchInp) {
      searchInp.addEventListener('input', renderTable);
    }
  }

  // Ejecutar setup inmediatamente (el DOM ya está listo cuando los scripts se cargan al final del body)
  setupCotizacionesView();

  // ======= LÓGICA DEL MODAL DE SEGUIMIENTO ========
  let unsubCotHist = null;
  window.openSegCotizacion = async function(id, medico, origen, monto, kam, currentStatus) {
    document.getElementById("segCotId").value = id;
    document.getElementById("segCotOrigenVal").value = origen;
    document.getElementById("segCotMedicoNombre").innerText = medico;
    document.getElementById("segCotOrigen").innerText = origen;
    document.getElementById("segCotMonto").innerText = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto);
    document.getElementById("segCotKAM").value = kam || '';
    document.getElementById("segCotComentarios").value = "";
    
    // Match currentStatus with options
    const select = document.getElementById("segCotEstado");
    if (currentStatus.includes('ACEPT') || currentStatus.includes('CONFIRM') || currentStatus.includes('CERRAD')) select.value = 'ACEPTADA';
    else if (currentStatus.includes('CANCEL')) select.value = 'CANCELADA';
    else select.value = 'PENDIENTE';

    modal.style.display = "flex";

    if (unsubCotHist) { try{unsubCotHist();}catch(e){} }
    
    // Cargar historial
    const qy = query(collection(db, "cotizaciones_seguimientos", id, "comentarios"), orderBy("createdAt","desc"));
    unsubCotHist = onSnapshot(qy, (s) => {
      const cont = document.getElementById("segCotHist");
      const items = s.docs.map(d => {
        const v = d.data();
        const dt = v.createdAt && v.createdAt.toDate ? v.createdAt.toDate() : new Date();
        const f  = dt.toLocaleString();
        return `<div style="padding:8px 0;border-bottom:1px solid #1f2937">
                  <div style="font-size:12px; color:var(--primary); margin-bottom:4px;"><strong>${f}</strong> — ${v.kam||"-"} — Estatus: ${v.estatus}</div>
                  <div style="opacity:.9; font-size:14px;">${v.comentario}</div>
                </div>`;
      }).join("") || "<em style='color:var(--text2);'>Sin seguimientos registrados.</em>";
      cont.innerHTML = items;
    });
  };

  document.getElementById("segCotSave").addEventListener("click", async () => {
    const id = document.getElementById("segCotId").value;
    const comentario = document.getElementById("segCotComentarios").value;
    const estatus = document.getElementById("segCotEstado").value;
    const kam = document.getElementById("segCotKAM").value;
    
    if (!comentario && !estatus) {
      alert("Por favor escribe un comentario o cambia el estatus.");
      return;
    }

    const btn = document.getElementById("segCotSave");
    btn.disabled = true;
    btn.innerText = "Guardando...";

    try {
      // Guardar el comentario
      await addDoc(collection(db, "cotizaciones_seguimientos", id, "comentarios"), {
        comentario,
        estatus,
        kam,
        createdAt: new Date()
      });

      // Actualizar el documento principal con el estatus global
      await setDoc(doc(db, "cotizaciones_seguimientos", id), {
        estatusGlobal: estatus,
        updatedAt: new Date()
      }, { merge: true });

      document.getElementById("segCotComentarios").value = "";
      // alert("Seguimiento guardado correctamente."); // Removing alert to make it smoother
    } catch(e) {
      console.error(e);
      alert("Error al guardar: " + e.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "Guardar";
    }
  });

})();
