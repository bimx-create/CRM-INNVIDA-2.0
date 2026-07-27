// medico-registro.js — Modal de registro / edición de médicos en Firestore
(async function () {

  /* ─── Esperar a que Firebase esté listo ─────────────────────────── */
  async function getDb() {
    if (window.firebaseDb) return window.firebaseDb;
    return new Promise(resolve => {
      let tries = 0;
      const t = setInterval(() => {
        tries++;
        if (window.firebaseDb) { clearInterval(t); resolve(window.firebaseDb); }
        if (tries > 40) { clearInterval(t); resolve(null); }
      }, 200);
    });
  }

  /* ─── Referencias a elementos del DOM ───────────────────────────── */
  const modal      = document.getElementById('modalRegMed');
  const form       = document.getElementById('formRegMed');
  const title      = document.getElementById('modalRegMedTitle');
  const statusEl   = document.getElementById('regMedStatus');
  const editIdEl   = document.getElementById('editMedId');
  const submitBtn  = document.getElementById('submitRegMed');

  const campos = {
    Nombre:       document.getElementById('regNombre'),
    Teléfono:     document.getElementById('regTelefono'),
    Dirección:    document.getElementById('regDireccion'),
    Hospital:     document.getElementById('regHospital'),
    'Red Social': document.getElementById('regRedSocial'),
    Especialidad: document.getElementById('regEspecialidad'),
    Estado:       document.getElementById('regEstado'),
    Región:       document.getElementById('regRegion'),
    'GERENTE/KAM':document.getElementById('regKAM'),
    Base:         document.getElementById('regBase')
  };

  /* ─── Poblar select de KAMs ──────────────────────────────────────── */
  function populateKamSelect() {
    const sel = campos['GERENTE/KAM'];
    if (!sel) return;
    const kams = window.getKAMs ? window.getKAMs() : [];
    const current = sel.value;
    sel.innerHTML = '<option value="">Seleccionar KAM...</option>' +
      kams.map(k => `<option value="${k}" ${k === current ? 'selected' : ''}>${k}</option>`).join('');
    if (current) sel.value = current;
  }

  /* ─── Abrir modal para NUEVO médico ─────────────────────────────── */
  function openNew() {
    title.textContent = 'Registrar nuevo médico';
    editIdEl.value = '';
    form.reset();
    statusEl.textContent = '';
    submitBtn.textContent = 'Guardar médico';
    submitBtn.disabled = false;
    populateKamSelect();
    // Pre-llenar KAM si hay uno seleccionado
    if (window.__kamSelected && window.__kamSelected !== 'Todos') {
      campos['GERENTE/KAM'].value = window.__kamSelected;
    }
    modal.classList.add('open');
  }

  /* ─── Abrir modal para EDITAR médico ─────────────────────────────── */
  window.openEditMedico = function (id) {
    const med = (window.MED_BASE || []).find(m => m.id === id);
    if (!med) { alert('No se encontró el médico.'); return; }

    title.textContent = 'Editar médico';
    editIdEl.value = id;
    populateKamSelect();

    // Rellenar campos
    campos.Nombre.value       = med.Nombre || med.nombre || '';
    campos.Teléfono.value     = med['Teléfono'] || med.telefono || '';
    campos.Dirección.value    = med['Dirección'] || med.direccion || '';
    campos.Hospital.value     = med.Hospital || med.hospital || '';
    campos['Red Social'].value = med['Red Social'] || med.redSocial || '';
    campos.Especialidad.value = med.Especialidad || med.especialidad || '';
    campos.Estado.value       = med.Estado || med.estado || '';
    campos.Región.value       = med['Región'] || med.Region || med.region || '';
    campos['GERENTE/KAM'].value = med['GERENTE/KAM'] || med.kam || '';
    campos.Base.value         = med.Base || med.base || '';

    statusEl.textContent = '';
    submitBtn.textContent = 'Actualizar médico';
    submitBtn.disabled = false;
    modal.classList.add('open');
  };

  /* ─── Cerrar modal ───────────────────────────────────────────────── */
  function closeModal() {
    modal.classList.remove('open');
    form.reset();
    editIdEl.value = '';
  }

  document.getElementById('closeRegMed')?.addEventListener('click', closeModal);
  document.getElementById('cancelRegMed')?.addEventListener('click', closeModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.getElementById('openRegMed')?.addEventListener('click', openNew);

  /* ─── Guardar en Firestore ───────────────────────────────────────── */
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const db = await getDb();
    if (!db) {
      statusEl.textContent = '❌ Sin conexión a Firestore';
      statusEl.style.color = 'var(--red)';
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = '⏳ Guardando...';
    statusEl.style.color = 'var(--text2)';

    try {
      const { collection, addDoc, doc, setDoc, updateDoc, serverTimestamp } = await import(
        'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'
      );
      const { getAuth } = await import(
        'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'
      );
      
      const auth = getAuth(window.firebaseApp);

      const payload = {
        nombre:       campos.Nombre.value.trim(),
        telefono:     campos.Teléfono.value.trim(),
        direccion:    campos.Dirección.value.trim(),
        hospital:     campos.Hospital.value.trim(),
        redSocial:    campos['Red Social'].value.trim(),
        especialidad: campos.Especialidad.value.trim(),
        estado:       campos.Estado.value.trim(),
        region:       campos.Región.value.trim(),
        kam:          campos['GERENTE/KAM'].value.trim(),
        base:         campos.Base.value.trim(),
        estatus:      "Contactado",
        updatedAt:    serverTimestamp(),
      };

      const editId = editIdEl.value;

      if (editId) {
        // Actualizar médico existente
        await setDoc(doc(db, 'medicos', editId), payload, { merge: true });
        statusEl.textContent = '✓ Médico actualizado exitosamente';
        statusEl.style.color = 'var(--green)';
      } else {
        // Nuevo médico
        payload.createdAt = serverTimestamp();
        payload.createdBy = (auth.currentUser && auth.currentUser.uid) || null;
        
        // Generar slug igual que save_med_index.js, pero agregamos Date.now() para que no choque con uno existente
        const strToSlug = (payload.nombre + " " + payload.direccion).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$|_/g,'');
        const newId = strToSlug ? `${strToSlug}-${Date.now()}` : Date.now().toString();

        await setDoc(doc(db, 'medicos', newId), payload);
        statusEl.textContent = '✓ Médico registrado exitosamente';
        statusEl.style.color = 'var(--green)';
        form.reset();
        populateKamSelect();
        if (window.__kamSelected && window.__kamSelected !== 'Todos') {
          campos['GERENTE/KAM'].value = window.__kamSelected;
        }
      }

      submitBtn.disabled = false;

      // Cerrar modal después de 1.2s
      setTimeout(() => {
        closeModal();
      }, 1200);

    } catch (err) {
      console.error('[medico-registro] Error al guardar:', err);
      statusEl.textContent = '❌ Error: ' + (err.message || 'No se pudo guardar');
      statusEl.style.color = 'var(--red)';
      submitBtn.disabled = false;
    }
  });

  /* ─── Agregar botón "Editar" en cada fila ────────────────────────── */
  // Sobreescribimos la celda de acción para incluir Editar + Seguimiento
  const _paintOrig = window.paintMedicos;

  function patchActionCells() {
    document.querySelectorAll('#tbody-medicos tr').forEach(tr => {
      const btn = tr.querySelector('.btn-seg, .btn-followup');
      if (!btn) return;
      const id     = btn.getAttribute('data-id') || '';
      const nombre = btn.getAttribute('data-nombre') || '';
      const cell   = tr.lastElementChild;
      if (!id || cell.querySelector('.btn-edit-med')) return; // ya parcheada

      // Crear botón editar
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-ghost btn-sm btn-edit-med';
      editBtn.textContent = '✏️ Editar';
      editBtn.style.marginRight = '4px';
      editBtn.addEventListener('click', () => window.openEditMedico(id));

      // Insertar antes del botón de seguimiento
      cell.insertBefore(editBtn, btn);
    });
  }

  // Observar cambios en tbody para parchear botones automáticamente
  const observer = new MutationObserver(patchActionCells);
  const tbody = document.getElementById('tbody-medicos');
  if (tbody) observer.observe(tbody, { childList: true });
  setInterval(patchActionCells, 1000);

  console.log('[medico-registro] Módulo de registro cargado ✓');
})();
