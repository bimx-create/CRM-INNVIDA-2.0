
// hist_realtime_renderer.js — Render del panel de historial con fallback automático
(function(){
  let _unsubscribe = null;

  function ensureListContainer(){
    // Intenta varios selectores conocidos
    let el = document.querySelector("#segList, #seg-hist-list, #historial-seg, #histContent");
    if (el) return el;
    // Fallback: busca el aside por su heading
    const allAsides = Array.from(document.querySelectorAll("aside, .sidebar, #sidebar, [data-sidebar]"));
    for (const a of allAsides){
      const h = a.querySelector("h3,h4,h5");
      if (h && /historial\s+de\s+seguimiento/i.test(h.textContent || "")){
        const ul = a.querySelector("ul, ol");
        if (ul) return ul;
        const nu = document.createElement("ul"); a.appendChild(nu); return nu;
      }
    }
    // Última opción: crea un aside a la derecha
    const aside = document.createElement("aside");
    aside.style.cssText = "position:fixed;right:0;top:0;bottom:0;width:360px;overflow:auto;padding:16px;background:rgba(0,0,0,.2)";
    const h4 = document.createElement("h4"); h4.textContent = "Historial de Seguimiento";
    const ul  = document.createElement("ul"); ul.id = "segList";
    aside.appendChild(h4); aside.appendChild(ul);
    document.body.appendChild(aside);
    return ul;
  }

  function dotColor(estado){
    const s = (estado||"").toLowerCase();
    if (s.includes("cerrado")) return "#00d084";
    if (s.includes("cita")) return "#2bb0ff";
    if (s.includes("negoc")) return "#ffd000";
    if (s.includes("sin respu") || s.includes("no contesta")) return "#ff6f00";
    return "#9aa0a6";
  }

  window.watchSeguimientos = async function(docId){
    if (!docId) return;
    // Corta listener anterior
    try { _unsubscribe && _unsubscribe(); } catch(_){}
    const [appMod, fsMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js"),
    ]);
    const app = (window.firebaseApp) || appMod.initializeApp(window.FIREBASE_CONFIG);
    window.firebaseApp = app;
    const db  = (window.firebaseDb) || fsMod.getFirestore(app);
    window.firebaseDb = db;

    const ul = ensureListContainer();
    ul.innerHTML = '<li style="opacity:.7">Cargando historial…</li>';

    const q = fsMod.query(fsMod.collection(db, "medicos", docId, "seguimientos"), fsMod.orderBy("createdAt", "desc"));
    _unsubscribe = fsMod.onSnapshot(q, (snap)=>{
      ul.innerHTML = "";
      if (snap.empty){
        ul.innerHTML = '<li style="opacity:.7">Sin seguimientos registrados.</li>';
        return;
      }
      snap.forEach(d=>{
        const s = d.data()||{};
        const li = document.createElement("li");
        const fecha = s.createdAt && s.createdAt.toDate ? s.createdAt.toDate() : null;
        const f = fecha ? fecha.toLocaleDateString("es-MX", {year:"numeric",month:"2-digit",day:"2-digit"}) : "";
        li.innerHTML = `
          <div style="display:flex;gap:.5rem;align-items:center">
            <span style="width:.6rem;height:.6rem;border-radius:9999px;background:${dotColor(s.estado)}"></span>
            <strong>${f || ""}</strong> — ${s.estado || ""} <em>(${s.kam || "—"})</em>
          </div>
          <small>${(s.comentarios || "").replace(/</g,"&lt;")}</small>
        `;
        ul.appendChild(li);
      });
    }, (err)=>{
      ul.innerHTML = '<li style="color:#ff6f00">No se pudo cargar el historial.</li>';
      console.error("[hist watch] ", err);
    });
  }
})();
