// firebase_medicos.js — realtime, mobile-safe, sin JSON (R2)
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, collection, collectionGroup, query, onSnapshot, getDocsFromServer
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getAuth, signInAnonymously, setPersistence, inMemoryPersistence
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// --- Init (una sola vez)
const app = getApps()[0] || initializeApp(window.FIREBASE_CONFIG);
const db  = getFirestore(app);

// Auth anónima solo para escribir; las lecturas son públicas por tus rules
(async () => {
  try {
    const auth = getAuth(app);
    await setPersistence(auth, inMemoryPersistence);
    await signInAnonymously(auth);
    console.log("[medicos] auth anon listo");
  } catch (e) {
    console.warn("[medicos] auth anon opcional:", e);
  }
})();

// --- Helper contador
function updateCounter(total, fromCache) {
  const el = document.querySelector("#medCount") || document.querySelector("#badgeMedicos, .badge-medicos");
  if (el) {
    el.textContent = `${total} médicos${fromCache ? " (caché)" : ""}`;
    el.title = fromCache ? "Mostrando datos en caché" : "Datos desde la red";
  }
}

// --- Render helper (si tu app expone renderMedicos, lo usamos)
function renderIfAvailable(docs) {
  if (typeof window.renderMedicos === "function") {
    try { window.renderMedicos(docs); } catch {}
  }
  window.__medicosDocs = docs; // por si otros módulos lo consumen
}

// --- Realtime (onSnapshot) — SIEMPRE Firestore
const q = query(collectionGroup(db, "medicos"));
onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  updateCounter(snap.size, snap.metadata.fromCache === true);
  renderIfAvailable(docs);
  document.dispatchEvent(new CustomEvent("medicos:snapshot", { detail: { docs, fromCache: snap.metadata.fromCache === true } }));
});

// --- Forzar lectura de RED (para botón Refrescar)
window.forceMedicosFromServer = async function () {
  const snap = await getDocsFromServer(q);
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  updateCounter(snap.size, false);
  renderIfAvailable(docs);
};
