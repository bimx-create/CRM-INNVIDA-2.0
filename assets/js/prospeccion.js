// prospeccion.js - Módulo de Prospección Comercial con IA

(function() {
  // La API key ya NO está aquí. Se lee desde Vercel Environment Variables a través del proxy seguro
  const GROQ_URL = '/api/groq';
  
  let currentProspectMed = null;
  let currentProspectData = [];
  let currentPage = 1;
  const pageSizeEl = document.getElementById('pageSizeProsp');
  let PAGE_SIZE = 20;

  // Escuchar navegación
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (el.getAttribute('data-target') === 'prospeccion') {
        setTimeout(() => window.renderProspeccion(), 50);
      }
    });
  });

  // Inicializar filtros y eventos
  setTimeout(() => {
    if (pageSizeEl) {
      pageSizeEl.addEventListener('change', () => {
        PAGE_SIZE = parseInt(pageSizeEl.value, 10);
        currentPage = 1;
        window.renderProspeccion();
      });
    }
    const qEl = document.getElementById('qProsp');
    if (qEl) qEl.addEventListener('input', () => { currentPage = 1; window.renderProspeccion(); });
    
    document.getElementById('prevProsp')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; window.renderProspeccion(); } });
    document.getElementById('nextProsp')?.addEventListener('click', () => { currentPage++; window.renderProspeccion(); });
  }, 1000);

  window.renderProspeccion = function() {
    const medicos = window.MED_BASE || [];
    const q = (document.getElementById('qProsp')?.value || '').toLowerCase();
    
    let filtered = medicos;
    const kamActual = window.__kamSelected || 'Todos';
    
    // Filtro KAM
    if (kamActual !== 'Todos') {
      const norm = (k) => k ? k.trim().toUpperCase() : '';
      filtered = filtered.filter(m => norm(m['GERENTE/KAM'] || m.kam) === norm(kamActual));
    }
    
    // Búsqueda de texto
    if (q) {
      filtered = filtered.filter(m => {
        const nom = (m['Nombre'] || m.nombre || '').toLowerCase();
        const hosp = (m['Hospital'] || m.hospital || '').toLowerCase();
        const esp = (m['Especialidad'] || m.especialidad || '').toLowerCase();
        return nom.includes(q) || hosp.includes(q) || esp.includes(q);
      });
    }

    currentProspectData = filtered;
    
    const countEl = document.getElementById('prospCount');
    if (countEl) {
      countEl.textContent = `${filtered.length} Médicos`;
      countEl.style.display = 'inline-block';
    }

    const tbody = document.getElementById('tbody-prospeccion');
    if (!tbody) return;

    const start = (currentPage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(start, start + PAGE_SIZE);

    if (paginated.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text2);">No hay resultados</td></tr>`;
      return;
    }

    tbody.innerHTML = paginated.map(m => {
      const nom = m['Nombre'] || m.nombre || 'Sin Nombre';
      const esp = m['Especialidad'] || m.especialidad || 'Sin especialidad';
      const hosp = m['Hospital'] || m.hospital || 'Consultorio/Clínica';
      const est = m['Estado'] || m.estado || '';
      const email = m['Email'] || m.email || m['Correo'] || m.correo || '';
      const tel = m['Teléfono'] || m.telefono || m.celular || '';
      
      const contactoHtml = [];
      if (tel) contactoHtml.push(`📱 ${tel}`);
      if (email) contactoHtml.push(`📧 ${email}`);
      
      // Guardamos la info serializada
      const medData = btoa(unescape(encodeURIComponent(JSON.stringify({ nom, esp, hosp, est, email, tel }))));

      return `
        <tr>
          <td><div style="font-weight:600; color:var(--text1);">${nom}</div></td>
          <td>
            <div style="color:var(--text1);">${hosp}</div>
            <div style="font-size:12px; color:var(--text2);">${esp}</div>
          </td>
          <td>${est}</td>
          <td style="font-size:12px; color:var(--text2);">${contactoHtml.join('<br>') || 'Sin datos'}</td>
          <td style="text-align:right;">
            <button class="btn btn-primary btn-sm" onclick="window.openProspeccionIA('${medData}')" style="background:#7C3AED; border:none;">
              🤖 Prospectar
            </button>
          </td>
        </tr>
      `;
    }).join('');
    
    // Configurar botones de paginación
    const btnPrev = document.getElementById('prevProsp');
    const btnNext = document.getElementById('nextProsp');
    if (btnPrev) btnPrev.disabled = currentPage === 1;
    if (btnNext) btnNext.disabled = (start + PAGE_SIZE) >= filtered.length;
  };

  window.openProspeccionIA = function(medDataB64) {
    try {
      const med = JSON.parse(decodeURIComponent(escape(atob(medDataB64))));
      currentProspectMed = med;
      
      document.getElementById('modalProspeccionIA').style.display = 'flex';
      document.getElementById('prospModalSubtitle').innerHTML = `Para: <strong>${med.nom}</strong> (${med.esp})`;
      document.getElementById('prospMessageContent').value = '';
      
      generateMsg(med);
    } catch(e) {
      console.error(e);
      alert("Error al cargar datos del médico");
    }
  };

  async function generateMsg(med) {
    const textEl = document.getElementById('prospMessageContent');
    const btnGen = document.getElementById('btnGenerateMsg');
    
    textEl.value = '🤖 Redactando mensaje con Inteligencia Artificial...\n\nPor favor espera unos segundos.';
    textEl.disabled = true;
    btnGen.disabled = true;

    const prompt = `Eres un asistente de marketing y ventas (KAM) para la farmacéutica INNVIDA (oncología y alta especialidad).
Tu objetivo es escribir un mensaje corto, persuasivo, profesional y amigable de prospección / seguimiento.

DATOS DEL MÉDICO DESTINATARIO:
- Nombre: ${med.nom}
- Especialidad: ${med.esp}
- Hospital/Clínica: ${med.hosp}

REGLAS PARA EL MENSAJE:
1. No uses saludos excesivos, ve al grano pero con cortesía.
2. Menciona INNVIDA y cómo podemos apoyarlo con tratamientos oncológicos o de especialidad para sus pacientes.
3. Termina con un Call to Action (CTA) sutil, como ofrecerle enviarle una cotización, catálogo o tener una breve charla.
4. El mensaje se enviará por WhatsApp o Correo, así que mantenlo relativamente corto (máx. 3-4 párrafos pequeños).
5. Escribe SOLO el mensaje, sin comillas, sin explicaciones tuyas.`;

    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // Authorization la maneja el proxy en /api/groq
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 400
        })
      });

      if (!res.ok) throw new Error('Error en API');
      const data = await res.json();
      const aiMessage = data.choices[0].message.content.trim();
      
      textEl.value = aiMessage;
    } catch (e) {
      console.error(e);
      textEl.value = 'Hola Doctor,\n\nLe escribo de INNVIDA. Nos gustaría apoyarle con opciones terapéuticas para sus pacientes.\n\n¿Le interesaría recibir información de nuestros servicios?';
    } finally {
      textEl.disabled = false;
      btnGen.disabled = false;
    }
  }

  // Event Listeners para modal
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnGenerateMsg')?.addEventListener('click', () => {
      if (currentProspectMed) generateMsg(currentProspectMed);
    });

    document.getElementById('btnSendWa')?.addEventListener('click', () => {
      if (!currentProspectMed) return;
      const telRaw = currentProspectMed.tel || '';
      const num = telRaw.replace(/[^0-9]/g, '');
      const msg = encodeURIComponent(document.getElementById('prospMessageContent').value);
      
      if (!num) {
        alert("Este médico no tiene un teléfono registrado.");
        return;
      }
      
      const phone = num.length <= 10 ? '52' + num : num;
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
    });

    document.getElementById('btnSendEmail')?.addEventListener('click', () => {
      if (!currentProspectMed) return;
      const email = currentProspectMed.email || '';
      const msg = encodeURIComponent(document.getElementById('prospMessageContent').value);
      
      if (!email || !email.includes('@')) {
        alert("Este médico no tiene un correo válido registrado.");
        return;
      }
      
      // Intentar abrir Gmail web por defecto si se prefiere, o mailto nativo
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=Seguimiento INNVIDA&body=${msg}`, '_blank');
    });
  });

})();
