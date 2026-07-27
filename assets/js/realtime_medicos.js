
// CRM-PRAXIS: visibilidad en tiempo real de médicos
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, collectionGroup, addDoc, serverTimestamp,
  onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let app, db, auth;

/**
 * Inicializa Firebase (o reusa la instancia) y hace sign-in anónimo.
 */
async function ensureFirebase(firebaseConfig) {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  }
  auth = getAuth();
  db = getFirestore();

  await new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (u) => {
      if (u) return resolve();
      signInAnonymously(auth).then(resolve).catch(reject);
    });
  });
  console.info("[medicos] auth anónimo listo");
}

/**
 * Convierte un objeto médico en <tr> para la tabla.
 * Ajusta las columnas según tu UI real.
 */
function medicoToTR(m, id) {
  const tr = document.createElement("tr");
  tr.dataset.id = id || "";
  tr.innerHTML = `
    <td>${m.nombre || "-"}</td>
    <td>${m.telefono || "-"}</td>
    <td>${m.direccion || "-"}</td>
    <td>${m.hospital || "-"}</td>
    <td>${m.redSocial || "-"}</td>
    <td>${m.especialidad || "-"}</td>
    <td>${m.base || "-"}</td>
    <td>${m.estado || "-"}</td>
    <td>${m.region || "-"}</td>
    <td>${m.kam || "-"}</td>
    <td>
      <button class="btn btn-sm btn-primary" data-action="seguimiento" data-id="${id || ""}">+ Seguimiento</button>
    </td>
  `;
  return tr;
}

/**
 * Renderiza cambios en vivo en la tabla usando docChanges.
 */
function bindChangesToTable(q, tbodyEl, counterEl) {
  const rows = new Map();
  onSnapshot(q, (snap) => {
    if (counterEl) counterEl.textContent = `${snap.size} médicos (vivo)`;
    snap.docChanges().forEach((ch) => {
      const id = ch.doc.id;
      const data = ch.doc.data();
      if (ch.type === "added") {
        const tr = medicoToTR(data, id);
        rows.set(id, tr);
        tbodyEl.prepend(tr); // arriba primero
      } else if (ch.type === "modified") {
        const tr = rows.get(id) || medicoToTR(data, id);
        tr.replaceWith(medicoToTR(data, id));
        rows.set(id, tr);
      } else if (ch.type === "removed") {
        const tr = rows.get(id);
        if (tr && tr.parentNode) tr.parentNode.removeChild(tr);
        rows.delete(id);
      }
    });
  }, (err) => console.error("[medicos] onSnapshot error:", err));
}

/**
 * Configura la escucha en tiempo real.
 * listenMode: "root" => /medicos
 *              "collectionGroup" => cualquier subcolección llamada "medicos"
 */
export async function setupRealtimeMedicos({
  firebaseConfig,
  tableBodySelector = "#tbodyMedicos",
  counterSelector = "#medicosCount",
  listenMode = "root"
} = {}) {
  await ensureFirebase(firebaseConfig);
  const tbodyEl = document.querySelector(tableBodySelector);
  const counterEl = document.querySelector(counterSelector);
  if (!tbodyEl) {
    console.warn("[medicos] No se encontró tbody para pintar filas:", tableBodySelector);
    return;
  }
  let qListen;
  if (listenMode === "collectionGroup") {
    qListen = query(collectionGroup(db, "medicos"), orderBy("createdAt", "desc"));
  } else {
    qListen = query(collection(db, "medicos"), orderBy("createdAt", "desc"));
  }
  bindChangesToTable(qListen, tbodyEl, counterEl);
}

/**
 * Lee campos desde el DOM y guarda el médico.
 * saveMode: "root" => guarda en /medicos
 *           "scoped" => guarda en /medicos/{uid}/medicos
 */
export async function saveMedicoFromForm({
  map,
  saveMode = "root"
} = {}) {
  if (!db || !auth) throw new Error("Firebase no inicializado. Llama a setupRealtimeMedicos primero.");
  const get = (sel) => (sel ? (document.querySelector(sel)?.value || "").trim() : "");

  const payload = {
    nombre: get(map?.nombre),
    telefono: get(map?.telefono),
    direccion: get(map?.direccion),
    hospital: get(map?.hospital),
    redSocial: get(map?.redSocial),
    especialidad: get(map?.especialidad),
    base: get(map?.base),
    estado: get(map?.estado),
    region: get(map?.region),
    kam: get(map?.kam),
    createdAt: serverTimestamp()
  };

  // Ruta de guardado
  let ref;
  if (saveMode === "scoped" && auth.currentUser) {
    ref = collection(db, "medicos", auth.currentUser.uid, "medicos");
  } else {
    ref = collection(db, "medicos");
  }
  const docRef = await addDoc(ref, payload);
  console.info("[save_med:v1] listo", docRef.path);
  return docRef;
}
