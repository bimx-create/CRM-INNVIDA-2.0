// robust_resolve_docid.js — asegura __seg_docId al hacer click en + Seguimiento
(function(){
  function normalize(s){ return (s||"").toLowerCase().replace(/\s+/g," ").trim(); }

  async function ensureFirebase(){
    const [appMod, fsMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js"),
    ]);
    const app = (window.firebaseApp) || appMod.initializeApp(window.FIREBASE_CONFIG);
    window.firebaseApp = app;
    const db  = (window.firebaseDb) || fsMod.getFirestore(app);
    window.firebaseDb = db;
    return { fs: fsMod, db };
  }

  window.resolveDocIdFromRow = async function resolveDocIdFromRow(btn){
    window.__lastSegButton = btn;
    const row = btn.closest("tr");
    if(!row) return null;
    // se asume primer <td> = nombre, tercero = direccion (según tu tabla)
    const tds = Array.from(row.querySelectorAll("td"));
    const nombre = (tds[0]?.textContent || "").trim();
    const direccion = (tds[2]?.textContent || "").trim();
    const hospital = (tds[3]?.textContent || "").trim();

    const { fs, db } = await ensureFirebase();
    // 1) nombre + direccion
    if (nombre){
      try{
        let q = fs.query(fs.collection(db,"medicos"), fs.where("nombre","==", nombre));
        if (direccion) q = fs.query(fs.collection(db,"medicos"),
                                    fs.where("nombre","==", nombre),
                                    fs.where("direccion","==", direccion));
        const snap = await fs.getDocs(q);
        if(!snap.empty) return snap.docs[0].id;
      }catch(_){}
      // 2) por hospital también
      try{
        if (hospital){
          const q2 = fs.query(fs.collection(db,"medicos"),
                              fs.where("nombre","==", nombre),
                              fs.where("hospital","==", hospital));
          const snap2 = await fs.getDocs(q2);
          if(!snap2.empty) return snap2.docs[0].id;
        }
      }catch(_){}
      // 3) fuzzy: baja 20 docs por nombre exacto capitalizado alterno
      try{
        const snap3 = await fs.getDocs(fs.collection(db,"medicos"));
        let found = null;
        snap3.forEach(d=>{
          const r = d.data()||{};
          if (normalize(r.nombre||r.Nombre) === normalize(nombre)) found = d.id;
        });
        if (found) return found;
      }catch(_){}
    }
    return null;
  }

  function upgradeClicks(){
    document.addEventListener("click", async function(ev){
      const b = ev.target.closest(".btn-seg, .btnSeguimiento, button.btn, button");
      window.__lastSegButton = b;
      if (!b) return;
      const label = (b.textContent||"").toLowerCase();
      if (!label.includes("seguimiento")) return;

      let id = b.getAttribute("data-id") || (b.dataset && b.dataset.id) || "";
      if (id && /^[A-Za-z0-9_-]{20,}$/.test(id)) { window.__seg_docId = id; return; }
      // Firestore auto ids suelen ser 20+ alfanum
      const looksLikeId = /^[A-Za-z0-9_-]{20,}$/.test(id);
      if (!looksLikeId){
        const resolved = await resolveDocIdFromRow(b);
        if (resolved){
          b.setAttribute("data-id", resolved);
          window.__seg_docId = resolved;
        } else {
          // Dejamos el nombre en el modal para que el guardado intente de nuevo
          const row = b.closest("tr");
          const nombre = row ? (row.querySelector("td")?.textContent||"").trim() : "";
          const nombreInput = document.querySelector("#modalMedico, #seg-nombre, #segNombre, input[name='nombre']");
          if (nombreInput && nombre) nombreInput.value = nombre;
          alert("No pude localizar el médico (docId) de forma automática. Intenta guardar: el sistema intentará resolverlo por nombre.");
        }
      } else {
        window.__seg_docId = id;
      }
    }, { capture:true });
  }

  upgradeClicks();
})();
