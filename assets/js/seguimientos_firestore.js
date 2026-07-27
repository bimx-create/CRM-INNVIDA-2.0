
import { db } from "./firebase_init.js";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

export async function guardarSeguimientoDesdeUI() {
  const medicoId = window.__seg_docId;
  if (!medicoId) { alert("No tengo el ID del médico."); return; }

  const estado = document.querySelector("#estadoSeg")?.value || "Contactado";
  const fechaProx = document.querySelector("#fechaSeg")?.value || null;
  const comentarios = document.querySelector("#comentSeg")?.value?.trim() || "";
  const kam = document.querySelector("#kamSeg")?.value?.trim() || "";

  try {
    await addDoc(collection(db, "medicos", medicoId, "seguimientos"), {
      estado,
      fechaProxima: fechaProx,
      comentarios,
      kam,
      createdAt: serverTimestamp(),
    });
    console.log("[seguimiento] guardado");
  } catch (e) {
    console.error(e);
    alert("No se pudo guardar el seguimiento: " + (e?.message || e));
  }
}

export function attachSeguimientos(medicoId) {
  const cont = document.getElementById("historialSeguimiento");
  if (!cont) return () => {};
  cont.innerHTML = "Cargando…";
  const q = query(collection(db, "medicos", medicoId, "seguimientos"), orderBy("createdAt", "desc"));
  const unsub = onSnapshot(q, (snap) => {
    const rows = [];
    snap.forEach(doc => {
      const s = doc.data();
      const fecha = (s.createdAt?.toDate?.() || new Date());
      rows.push(`<div class="seguimiento-item" style="margin:8px 0;padding:8px;border-left:4px solid #38bdf8;background:#0b2536;border-radius:6px;">
          <div><b>${fecha.toLocaleDateString()}</b> — ${s.estado || "-"}</div>
          ${s.comentarios ? `<div>${s.comentarios}</div>` : ""}
          ${s.kam ? `<div style="opacity:.8"><i>${s.kam}</i></div>` : ""}
          ${s.fechaProxima ? `<div style="opacity:.8">Próx. acción: ${s.fechaProxima}</div>` : ""}
        </div>`);
    });
    cont.innerHTML = rows.join("") || "<em>Sin seguimientos</em>";
  }, (err) => {
    cont.innerHTML = `<span style="color:#f88">Error: ${err?.message || err}</span>`;
  });
  return unsub;
}

const saveBtn = document.getElementById("saveModal");
if (saveBtn) {
  saveBtn.addEventListener("click", async () => {
    await guardarSeguimientoDesdeUI();
  });
}
