
// export_firestore_hist.js — exporta historial de seguimientos desde Firestore (toda la base)
(function(){
  function ready(fn){ if(document.readyState!=="loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  ready(init);

  async function init(){
    try {
      const appMod = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js");
      const fsMod  = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
      const app = (window.firebaseApp) || appMod.initializeApp(window.FIREBASE_CONFIG);
      window.firebaseApp = app;
      const db = (window.firebaseDb) || fsMod.getFirestore(app);
      window.firebaseDb = db;

      async function fetchAllSeguimientos(){
        const rows = [];
        const col = fsMod.collection(db, "medicos");
        const snap = await fsMod.getDocs(col);
        for (const docRef of snap.docs){
          const m = docRef.data()||{};
          const segCol = fsMod.collection(db, "medicos", docRef.id, "seguimientos");
          const segSnap = await fsMod.getDocs(segCol);
          segSnap.forEach(d => {
            const s = d.data()||{};
            rows.push({
              medicoId: docRef.id,
              medicoNombre: m.nombre || m.Nombre || "",
              estado: s.estado || s.estatus || "",
              "Próxima acción / Fecha de visita":  s.proximaAccion ? (s.proximaAccion.toDate ? s.proximaAccion.toDate().toISOString().slice(0,10) : s.proximaAccion) : "",
              comentarios: s.comentarios || s.nota || "",
              kam: s.kam || s.usuario || "",
              creado: s.createdAt ? (s.createdAt.toDate ? s.createdAt.toDate().toISOString().slice(0,19).replace('T',' ') : s.createdAt) : ""
            });
          });
        }
        return rows;
      }

      async function downloadCSV(){
        const rows = await fetchAllSeguimientos();
        if(!rows.length){ alert("Sin historial en Firestore"); return; }
        const headers = Object.keys(rows[0]);
        const csv = [headers.join(",")].concat(rows.map(r => headers.map(h => `"${(r[h]??'').toString().replace(/"/g,'""')}"`).join(","))).join("\n");
        const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "historial_seguimientos_firestore.csv";
        a.click();
        URL.revokeObjectURL(a.href);
      }

      async function downloadXLSX(){
        const rows = await fetchAllSeguimientos();
        if(!rows.length){ alert("Sin historial en Firestore"); return; }
        // SheetJS ya está cargado en index.html
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Seguimientos");
        XLSX.writeFile(wb, "historial_seguimientos_firestore.xlsx");
      }

      const btnCSV = document.getElementById("downloadSegCSV");
      const btnXLSX = document.getElementById("downloadSegXLSX");
      if(btnCSV){ btnCSV.onclick = (e)=>{ e.preventDefault(); downloadCSV(); }; }
      if(btnXLSX){ btnXLSX.onclick = (e)=>{ e.preventDefault(); downloadXLSX(); }; }

    } catch (e) {
      console.error("[export_firestore_hist] error:", e);
    }
  }
})();
