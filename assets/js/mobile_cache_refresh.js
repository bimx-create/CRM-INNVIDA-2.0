
// mobile_cache_refresh.js — v6
// - Muestra si el snapshot viene de caché o red
// - El botón "Refrescar" fuerza lectura desde el servidor (getDocsFromServer)
// - Si no hay botón, agrega uno flotante
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, collection, query, onSnapshot,
  getDocsFromServer
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getAuth, signInAnonymously, setPersistence, inMemoryPersistence
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

(async function(){
  try {
    const app = getApps()[0] || initializeApp(window.FIREBASE_CONFIG);
    const auth = getAuth(app);
    try { await setPersistence(auth, inMemoryPersistence); } catch {}
    try { await signInAnonymously(auth); } catch {}

    const db = getFirestore(app);

    // UI helpers
    function ensureInfoBar(){
      let bar = document.getElementById("__cacheInfo");
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "__cacheInfo";
        bar.style.cssText = "position:fixed;left:12px;bottom:12px;background:#0b1220;color:#a6e3d0;border:1px solid #134e4a;padding:6px 10px;border-radius:10px;font:12px system-ui;z-index:9999;opacity:.9";
        bar.textContent = "Cargando médicos…";
        document.body.appendChild(bar);
      }
      return bar;
    }

    const bar = ensureInfoBar();
    const q = query(collection(db, "medicos"));

    onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      const fromCache = snap.metadata.fromCache === true;
      const total = snap.size;
      bar.textContent = fromCache ? `${total} médicos (caché)` : `${total} médicos (red)`;
      window.__medicosTotal = total;
      window.__medicosFromCache = fromCache;
    });

    // Hook "Refrescar" button
    function findRefreshBtn(){
      const all = Array.from(document.querySelectorAll("button,.btn"));
      return all.find(b => (b.textContent || "").trim().toLowerCase() === "refrescar");
    }

    async function forceNetworkRefresh(){
      try {
        const snap = await getDocsFromServer(query(collection(db,"medicos")));
        // Update bar immediately
        bar.textContent = `${snap.size} médicos (red)`;
        // prefer not to fully reload if tu renderer expone una función global; por seguridad recargamos
        setTimeout(()=>location.reload(), 150);
      } catch (e) {
        console.error("[mobile_cache_refresh] getDocsFromServer error:", e);
        alert("No pude refrescar desde el servidor: " + (e && e.message ? e.message : e));
      }
    }

    let btn = findRefreshBtn();
    if (btn) {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        forceNetworkRefresh();
      }, { capture: true });
    } else {
      // add floating button if not present
      const flo = document.createElement("button");
      flo.textContent = "Refrescar";
      flo.style.cssText = "position:fixed;right:12px;bottom:12px;background:#0ea5e9;color:#fff;border:none;border-radius:999px;padding:10px 14px;font:12px system-ui;box-shadow:0 10px 24px rgba(0,0,0,.35);z-index:9999";
      flo.addEventListener("click", forceNetworkRefresh);
      document.body.appendChild(flo);
    }
  } catch (e) {
    console.error("[mobile_cache_refresh] init error:", e);
  }
})();
