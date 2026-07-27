
// assets/js/realtime_medicos_v2.js
// Lectura unificada (raíz + subcolecciones) y visibilidad en tiempo real para "medicos".

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getFirestore, collection, collectionGroup, addDoc, serverTimestamp,
  onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

let app, db, auth;

async function ensureFirebase(firebaseConfig = {}) {
  if (!getApps().length) app = initializeApp(firebaseConfig);
  auth = getAuth();
  db = getFirestore();
  await new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (u) => (u ? resolve() : signInAnonymously(auth).then(resolve).catch(reject)));
  });
  console.info("[medicos] auth anónimo listo");
}

function toRow(m, id) {
  const tr = document.createElement("tr");
  tr.dataset.id = id || "";
  tr.innerHTML = `
    <td>${m.nombre ?? "-"}</td>
    <td>${m.telefono ?? "-"}</td>
    <td>${m.direccion ?? "-"}</td>
    <td>${m.hospital ?? "-"}</td>
    <td>${m.redSocial ?? "-"}</td>
    <td>${m.especialidad ?? "-"}</td>
    <td>${m.base ?? "-"}</td>
    <td>${m.estado ?? "-"}</td>
    <td>${m.region ?? "-"}</td>
    <td>${m.kam ?? "-"}</td>
    <td><button class="btn btn-sm btn-primary" data-action="seguimiento" data-id="${id || ""}">+ Seguimiento</button></td>
  `;
  return tr;
}

export async function initRealtimeMedicos({
  firebaseConfig = {},
  tableBody = "#tbodyMedicos",
  badgeTotal = "#countTotal",
  badgeFiltered = "#countFiltrados",
  listenMode = "collectionGroup",   // "root" | "collectionGroup"
  pageSize = 5000                   // sin paginar para que el total coincida
} = {}) {
  await ensureFirebase(firebaseConfig);
  const tbody = document.querySelector(tableBody);
  const bTotal = badgeTotal ? document.querySelector(badgeTotal) : null;
  const bFilt  = badgeFiltered ? document.querySelector(badgeFiltered) : null;
  if (!tbody) {
    console.warn("[medicos] No se encontró tbody:", tableBody);
    return;
  }

  let qListen;
  if (listenMode === "root") {
    qListen = query(collection(db, "medicos"), orderBy("createdAt", "desc"));
  } else {
    qListen = query(collectionGroup(db, "medicos"), orderBy("createdAt", "desc"));
  }

  let all = []; // fuente única para filtros/paginación
  const rows = new Map();

  onSnapshot(qListen, (snap) => {
    all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (bTotal) bTotal.textContent = `${snap.size} médicos (vivo)`;

    // Render plano (sin filtros) o ajustable vía applyFilters
    tbody.innerHTML = "";
    const slice = all.slice(0, pageSize);
    for (const m of slice) tbody.appendChild(toRow(m, m.id));

    if (bFilt) bFilt.textContent = `${tbody.querySelectorAll("tr").length} visibles`;
  }, (err) => console.error("[medicos] onSnapshot error:", err));

  function applyFilters({ texto = "", estado = "todos", region = "todas", kam = "todos" } = {}) {
    const t = texto.trim().toLowerCase();
    const filtered = all.filter(m => {
      const okTexto = !t || [
        m.nombre, m.telefono, m.direccion, m.hospital, m.especialidad, m.kam
      ].some(v => String(v || "").toLowerCase().includes(t));
      const okEstado = (estado === "todos") || (String(m.estado || "").toLowerCase() === String(estado).toLowerCase());
      const okRegion = (region === "todas") || (String(m.region || "").toLowerCase() === String(region).toLowerCase());
      const okKam    = (kam === "todos") || (String(m.kam || "").toLowerCase() === String(kam).toLowerCase());
      return okTexto && okEstado && okRegion && okKam;
    });
    tbody.innerHTML = "";
    for (const m of filtered.slice(0, pageSize)) tbody.appendChild(toRow(m, m.id));
    if (bFilt) bFilt.textContent = `${tbody.querySelectorAll("tr").length} visibles`;
  }

  return { applyFilters };
}

export async function saveMedicoFromForm({ map = {}, saveMode = "root" } = {}) {
  if (!db || !auth) throw new Error("Firebase no inicializado. Llama a initRealtimeMedicos primero.");
  const get = (sel) => (sel ? (document.querySelector(sel)?.value || "").trim() : "");

  const payload = {
    nombre: get(map.nombre),
    telefono: get(map.telefono),
    direccion: get(map.direccion),
    hospital: get(map.hospital),
    redSocial: get(map.redSocial),
    especialidad: get(map.especialidad),
    base: get(map.base),
    estado: get(map.estado),
    region: get(map.region),
    kam: get(map.kam),
    createdAt: serverTimestamp()
  };

  let ref;
  if (saveMode === "scoped" && auth.currentUser) {
    ref = collection(getFirestore(), "medicos", auth.currentUser.uid, "medicos");
  } else {
    ref = collection(getFirestore(), "medicos");
  }
  const docRef = await addDoc(ref, payload);
  console.info("[save_med:v2] listo", docRef.path);
  return docRef;
}
